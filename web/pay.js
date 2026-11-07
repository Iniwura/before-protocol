import {
  WIF_MAINNET_CHAIN_ID, WIF_TOKEN, WIF_RPC, PAYMENT_MAX_LIFETIME,
  isAddress, isHash, sameAddress, parseTokenAmount, formatTokenAmount, normalizeRequest,
  typedDataFor, validateRequest, verifyRequestSignature, encodeSharePayload, decodeSharePayload,
  buildPaymentTransaction, decodeUintResult, decodeSymbolResult, validateRecipientCode,
  validateMinedTransfer, explorerTransactionUrl
} from './pay-core.mjs';

const PAYMENT_STAGE = Object.freeze({
  NOT_SUBMITTED: 'not-submitted',
  WALLET_PENDING: 'wallet-pending',
  SUBMITTED: 'submitted',
  MINED_AWAITING_CONFIRMATIONS: 'mined-awaiting-confirmations',
  VERIFIED: 'verified',
  KNOWN_REVERTED: 'known-reverted',
  UNCERTAIN: 'uncertain'
});
const state = {
  request: null, signature: null, signer: null, payer: null, preflight: null,
  txHash: null, lifecycle: PAYMENT_STAGE.NOT_SUBMITTED, run: 0, sending: false,
  verificationRun: 0, verificationPromise: null
};
const TOKEN_BALANCE_SELECTOR = '0x70a08231';
const TOKEN_DECIMALS_SELECTOR = '0x313ce567';
const TOKEN_SYMBOL_SELECTOR = '0x95d89b41';
const RPC_TIMEOUT = 12_000;
const POLL_DELAYS = [250, 500, 750, 1_000, 1_500, 2_000, 3_000, 4_000, 5_000, 6_000];

const $ = id => document.getElementById(id);
function setText(id, value) { const node = $(id); if (node) node.textContent = String(value); }
function setHidden(id, hidden) { const node = $(id); if (node) node.hidden = hidden; }
function showFeedback(message, kind = 'info') {
  const node = $('pay-feedback');
  if (!node) return;
  node.textContent = message;
  node.dataset.kind = kind;
  node.hidden = false;
}
function clearFeedback() { if ($('pay-feedback')) $('pay-feedback').hidden = true; }
function shortAddress(value) { return value.slice(0, 6) + '…' + value.slice(-4); }
function quantity(value, label = 'RPC quantity') {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]+$/.test(value)) throw new Error(`${label} response is malformed.`);
  return BigInt(value);
}
function timestamp() { return BigInt(Math.floor(Date.now() / 1000)); }
function sleep(milliseconds) { return new Promise(resolve => setTimeout(resolve, milliseconds)); }

async function rpc(method, params = []) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RPC_TIMEOUT);
  try {
    const response = await fetch(WIF_RPC, {
      method: 'POST', cache: 'no-store', signal: controller.signal,
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({jsonrpc: '2.0', id: 1, method, params})
    });
    if (!response.ok) throw new Error(`Public RPC returned HTTP ${response.status}.`);
    const body = await response.json();
    if (body.error || body.result === undefined) throw new Error(body.error?.message || 'Public RPC response was incomplete.');
    return body.result;
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('Public RPC did not respond.');
    throw error;
  } finally { clearTimeout(timer); }
}

function providerOrThrow() {
  if (!window.ethereum || typeof window.ethereum.request !== 'function') throw new Error('No EIP-1193 wallet was detected. Install or open a compatible wallet to continue.');
  return window.ethereum;
}

async function walletChain(provider) {
  const chain = quantity(await provider.request({method: 'eth_chainId'}), 'Wallet chain ID');
  if (chain !== WIF_MAINNET_CHAIN_ID) throw new Error('Wallet is not connected to Robinhood Chain mainnet (4663). No payment request is sent.');
  return chain;
}

async function walletAccount(provider, requestAccounts = true) {
  const accounts = await provider.request({method: requestAccounts ? 'eth_requestAccounts' : 'eth_accounts'});
  if (!Array.isArray(accounts) || !isAddress(accounts[0])) throw new Error('Wallet did not return a valid account.');
  return accounts[0];
}

async function readTokenFacts() {
  const chain = quantity(await rpc('eth_chainId'), 'Public RPC chain ID');
  if (chain !== WIF_MAINNET_CHAIN_ID) throw new Error('Public RPC is not Robinhood Chain mainnet.');
  const code = await rpc('eth_getCode', [WIF_TOKEN, 'latest']);
  if (typeof code !== 'string' || code === '0x') throw new Error('Official WIF contract code was not found.');
  const [symbol, decimals] = await Promise.all([
    rpc('eth_call', [{to: WIF_TOKEN, data: TOKEN_SYMBOL_SELECTOR}, 'latest']),
    rpc('eth_call', [{to: WIF_TOKEN, data: TOKEN_DECIMALS_SELECTOR}, 'latest'])
  ]);
  if (decodeSymbolResult(symbol) !== 'WIF' || decodeUintResult(decimals, 'WIF decimals') !== 18n) throw new Error('Official token metadata did not match WIF with 18 decimals.');
  return {chain, codeBytes: (code.length - 2) / 2, symbol: 'WIF', decimals: 18};
}

function balanceData(address) { return TOKEN_BALANCE_SELECTOR + address.toLowerCase().slice(2).padStart(64, '0'); }

async function runPreflight({sender, request, signature}) {
  const run = ++state.run;
  const normalized = validateRequest(request);
  const facts = await readTokenFacts();
  const recipientCode = await rpc('eth_getCode', [normalized.recipient, 'latest']);
  validateRecipientCode(recipientCode);
  const signatureCheck = await verifyRequestSignature(normalized, signature, rpc);
  if (!sameAddress(signatureCheck.signer, normalized.recipient)) throw new Error('Recipient signature signer changed.');
  const [balanceHex, nativeHex, gasPriceHex, gasHex] = await Promise.all([
    rpc('eth_call', [{to: WIF_TOKEN, data: balanceData(sender)}, 'latest']),
    rpc('eth_getBalance', [sender, 'latest']),
    rpc('eth_gasPrice'),
    rpc('eth_estimateGas', [{from: sender, to: WIF_TOKEN, data: '0xa9059cbb' + normalized.recipient.slice(2).toLowerCase().padStart(64, '0') + normalized.amount.toString(16).padStart(64, '0'), value: '0x0'}])
  ]);
  const balance = decodeUintResult(balanceHex, 'WIF balance');
  const nativeBalance = quantity(nativeHex, 'Native balance');
  const gasPrice = quantity(gasPriceHex, 'Gas price');
  const gas = quantity(gasHex, 'Gas estimate');
  if (balance < normalized.amount) throw new Error(`Insufficient WIF: this wallet has ${formatTokenAmount(balance)} WIF, but the request is ${formatTokenAmount(normalized.amount)} WIF.`);
  if (nativeBalance < gas * gasPrice) throw new Error('Insufficient native ETH for the estimated mainnet gas.');
  if (run !== state.run) throw new Error('Payment check became stale. Retry with the current request.');
  return {request: normalized, signer: signatureCheck.signer, facts, balance, nativeBalance, gasPrice, gas, gasCost: gas * gasPrice};
}

function updatePaymentControls() {
  const button = $('pay-now');
  if (!button) return;
  button.disabled = state.lifecycle !== PAYMENT_STAGE.NOT_SUBMITTED || !state.preflight || state.sending;
}

function renderRequest(request, signature) {
  setText('request-recipient', shortAddress(request.recipient));
  $('request-recipient').title = request.recipient;
  setText('request-amount', formatTokenAmount(request.amount) + ' WIF');
  setText('request-expiry', new Date(Number(request.expiresAt) * 1000).toLocaleString());
  setText('request-id', request.nonce.slice(0, 10) + '…');
  $('request-id').title = request.nonce;
  setText('request-state', signature ? 'Signed · needs check' : 'Unsigned');
  setHidden('request-card', false);
  setHidden('create-card', Boolean(signature));
  setHidden('check-card', !signature);
  setHidden('proof-card', true);
  updatePaymentControls();
}

function setShareLink(link) {
  $('share-link').value = link;
  setHidden('share-card', false);
  $('share-link').focus();
  $('share-link').select();
}

function requestUrl(stage = state.lifecycle) {
  const link = new URL('/app/pay/', location.origin);
  link.searchParams.set('request', encodeSharePayload(state.request, state.signature));
  if (state.txHash) link.searchParams.set('tx', state.txHash);
  if (stage !== PAYMENT_STAGE.NOT_SUBMITTED) link.searchParams.set('status', stage);
  return link;
}

// The URL is the recovery record. It contains only the signed public request and
// transaction hash, never a key or a localStorage success claim.
function persistPaymentUrl(stage = state.lifecycle) {
  if (!state.request || !state.signature) return;
  const link = requestUrl(stage);
  history.replaceState(null, '', link.pathname + link.search);
}

function stageLabel(stage) {
  return {
    [PAYMENT_STAGE.WALLET_PENDING]: 'Wallet pending',
    [PAYMENT_STAGE.SUBMITTED]: 'Submitted · awaiting receipt',
    [PAYMENT_STAGE.MINED_AWAITING_CONFIRMATIONS]: 'Mined · awaiting confirmations',
    [PAYMENT_STAGE.VERIFIED]: 'Verified · final',
    [PAYMENT_STAGE.KNOWN_REVERTED]: 'Known reverted',
    [PAYMENT_STAGE.UNCERTAIN]: 'Uncertain · do not retry'
  }[stage] || 'Not submitted';
}

function renderPending(stage, message) {
  state.lifecycle = stage;
  updatePaymentControls();
  setText('proof-state', stageLabel(stage));
  $('proof-title').innerHTML = stage === PAYMENT_STAGE.KNOWN_REVERTED ? 'The transfer<br><em>did not settle.</em>' : stage === PAYMENT_STAGE.UNCERTAIN ? 'Check before<br><em>retrying.</em>' : 'Payment<br><em>in progress.</em>';
  const description = $('proof-description');
  if (description) description.textContent = message;
  setText('proof-hash', state.txHash ? shortAddress(state.txHash) : 'No hash returned');
  if ($('proof-hash') && state.txHash) $('proof-hash').title = state.txHash;
  setText('proof-block', '—');
  setText('proof-confirmations', stage === PAYMENT_STAGE.MINED_AWAITING_CONFIRMATIONS ? 'Below required depth' : 'Not yet final');
  if (state.txHash) {
    $('proof-explorer').href = explorerTransactionUrl(state.txHash);
    setHidden('proof-explorer', false);
  } else setHidden('proof-explorer', true);
  setHidden('proof-retry', !state.txHash || stage === PAYMENT_STAGE.KNOWN_REVERTED);
  setHidden('proof-card', false);
  setHidden('check-card', true);
  setHidden('request-card', true);
  setHidden('share-card', true);
}

async function createRequest(event) {
  event.preventDefault();
  const button = $('create-request'); button.disabled = true; clearFeedback();
  try {
    const provider = providerOrThrow();
    await walletChain(provider);
    const recipient = await walletAccount(provider);
    const amount = parseTokenAmount($('pay-amount').value);
    const hours = Number.parseInt($('pay-expiry').value, 10);
    if (!Number.isInteger(hours) || hours < 1 || BigInt(hours) * 3600n > PAYMENT_MAX_LIFETIME) throw new Error('Expiry must be between 1 hour and 30 days.');
    await readTokenFacts();
    validateRecipientCode(await rpc('eth_getCode', [recipient, 'latest']));
    if (sameAddress(recipient, WIF_TOKEN)) throw new Error('The WIF token contract cannot be the recipient.');
    const random = new Uint8Array(32);
    if (!window.crypto?.getRandomValues) throw new Error('Secure randomness is unavailable; no request was created.');
    window.crypto.getRandomValues(random);
    const nonce = '0x' + Array.from(random, byte => byte.toString(16).padStart(2, '0')).join('');
    const request = validateRequest({recipient, token: WIF_TOKEN, chainId: WIF_MAINNET_CHAIN_ID, amount, expiresAt: timestamp() + BigInt(hours) * 3600n, nonce});
    const typedData = JSON.stringify(typedDataFor(request));
    showFeedback('Confirm the recipient signature in your wallet. This signs a request only; it does not approve or transfer WIF.');
    const signature = await provider.request({method: 'eth_signTypedData_v4', params: [recipient, typedData]});
    const verified = await verifyRequestSignature(request, signature, rpc);
    if (!sameAddress(verified.signer, recipient)) throw new Error('Wallet signature did not authenticate the connected recipient.');
    state.request = request; state.signature = signature; state.signer = verified.signer; state.payer = null; state.preflight = null; state.txHash = null; state.lifecycle = PAYMENT_STAGE.NOT_SUBMITTED;
    const link = new URL('/app/pay/', location.origin);
    link.searchParams.set('request', encodeSharePayload(request, signature));
    renderRequest(request, signature); setShareLink(link.toString());
    showFeedback('Signed request ready. Share the link; the payer will independently re-check the token and signature before any wallet action.', 'success');
  } catch (error) {
    showFeedback(error?.code === 4001 ? 'The recipient signature was rejected. No request was created.' : error?.message || 'Request creation failed.', 'error');
  } finally { button.disabled = false; }
}

async function checkPayment(event) {
  event?.preventDefault();
  if (state.lifecycle !== PAYMENT_STAGE.NOT_SUBMITTED) {
    showFeedback('This request already has a payment attempt. Verify its receipt before considering any next action.', 'error');
    return;
  }
  const button = $('check-payment'); button.disabled = true; clearFeedback();
  try {
    const provider = providerOrThrow();
    await walletChain(provider);
    const payer = await walletAccount(provider);
    state.payer = payer;
    state.preflight = await runPreflight({sender: payer, request: state.request, signature: state.signature});
    setText('check-sender', shortAddress(payer)); $('check-sender').title = payer;
    setText('check-balance', formatTokenAmount(state.preflight.balance) + ' WIF');
    setText('check-gas', formatTokenAmount(state.preflight.gasCost) + ' ETH estimated');
    setText('check-state', 'Verified · ready for explicit payment');
    setHidden('check-results', false);
    updatePaymentControls();
    showFeedback('All checks passed. The next button is the only action that can open the wallet transfer confirmation.', 'success');
  } catch (error) {
    state.preflight = null; updatePaymentControls(); setHidden('check-results', true);
    showFeedback(error?.code === 4001 ? 'The payer connection was rejected. No payment was requested.' : error?.message || 'Payment checks failed closed.', 'error');
  } finally { button.disabled = false; }
}

async function observePayment(hash, request, sender) {
  const [transaction, receipt, currentBlock] = await Promise.all([
    rpc('eth_getTransactionByHash', [hash]), rpc('eth_getTransactionReceipt', [hash]), rpc('eth_blockNumber')
  ]);
  if (!transaction) return {stage: PAYMENT_STAGE.SUBMITTED, message: 'Transaction hash recorded. Waiting for the public RPC to index the transaction; no second payment will be sent.'};
  if (!receipt) return {stage: PAYMENT_STAGE.SUBMITTED, message: 'Transaction submitted. Waiting for a mined receipt; do not click Pay again.'};
  if (receipt.status !== '0x1') return {stage: PAYMENT_STAGE.KNOWN_REVERTED, message: 'The receipt is mined but reports failure. No successful WIF payment is claimed, and this request remains locked against a duplicate send.'};
  try {
    const proof = validateMinedTransfer({transaction, receipt, request, sender: sender || transaction.from, currentBlock, confirmations: 3});
    return {stage: PAYMENT_STAGE.VERIFIED, proof};
  } catch (error) {
    if (/Waiting for 3 confirmations/.test(error?.message || '')) {
      const head = quantity(currentBlock, 'Current block');
      const block = quantity(receipt.blockNumber, 'Receipt block');
      return {stage: PAYMENT_STAGE.MINED_AWAITING_CONFIRMATIONS, message: `Receipt mined with ${Number(head - block + 1n)} confirmation${head - block === 0n ? '' : 's'}; waiting for 3 confirmations before claiming proof.`};
    }
    throw error;
  }
}

async function waitForReceipt(hash, request = state.request, sender = state.payer) {
  let lastError = null;
  for (let attempt = 0; attempt <= POLL_DELAYS.length; attempt++) {
    try {
      const observation = await observePayment(hash, request, sender);
      if (observation.stage === PAYMENT_STAGE.VERIFIED || observation.stage === PAYMENT_STAGE.KNOWN_REVERTED) return observation;
      renderPending(observation.stage, observation.message);
      showFeedback(observation.message, observation.stage === PAYMENT_STAGE.SUBMITTED ? 'info' : 'error');
    } catch (error) {
      lastError = error;
      renderPending(PAYMENT_STAGE.SUBMITTED, 'Public RPC verification is temporarily unavailable or incomplete. The transaction remains locked; retry verification without sending another transaction.');
      showFeedback(error?.message || 'Public RPC verification failed. No second transaction will be sent.', 'error');
    }
    if (attempt === POLL_DELAYS.length) break;
    await sleep(POLL_DELAYS[attempt]);
  }
  const error = new Error(lastError?.message || 'Verification timed out. The transaction remains pending or unverified; retry verification from the receipt link later.');
  error.code = 'VERIFICATION_TIMEOUT';
  throw error;
}

async function verifyProof(hash, request, sender) {
  const observation = await observePayment(hash, request, sender);
  if (observation.stage === PAYMENT_STAGE.VERIFIED) return observation.proof;
  if (observation.stage === PAYMENT_STAGE.KNOWN_REVERTED) throw new Error('The WIF transfer receipt reports failure.');
  throw new Error(observation.message);
}

function renderProof(proof) {
  state.lifecycle = PAYMENT_STAGE.VERIFIED;
  updatePaymentControls();
  setText('proof-state', stageLabel(PAYMENT_STAGE.VERIFIED));
  $('proof-title').innerHTML = 'A payment<br><em>you can inspect.</em>';
  setText('proof-description', 'Success is claimed only after the public receipt, exact transfer calldata, sender, official WIF destination and matching Transfer event pass again.');
  setText('proof-hash', shortAddress(proof.hash)); $('proof-hash').title = proof.hash;
  setText('proof-block', quantity(proof.blockNumber).toString());
  setText('proof-confirmations', proof.confirmations + ' confirmations');
  $('proof-explorer').href = explorerTransactionUrl(proof.hash);
  setHidden('proof-explorer', false); setHidden('proof-retry', true);
  setHidden('proof-card', false); setHidden('check-card', true); setHidden('request-card', true); setHidden('share-card', true);
}

async function startVerification(hash = state.txHash) {
  if (!isHash(hash)) return;
  state.txHash = hash;
  const run = ++state.verificationRun;
  state.verificationPromise = (async () => {
    try {
      const observation = await waitForReceipt(hash, state.request, state.payer);
      if (run !== state.verificationRun) return;
      if (observation.stage === PAYMENT_STAGE.KNOWN_REVERTED) {
        renderPending(observation.stage, observation.message);
        showFeedback(observation.message, 'error');
        persistPaymentUrl(observation.stage);
      } else {
        renderProof(observation.proof);
        persistPaymentUrl(PAYMENT_STAGE.VERIFIED);
        showFeedback('Payment proof verified from public RPC: sender, exact calldata, success receipt and WIF Transfer log all match.', 'success');
      }
    } catch (error) {
      if (run !== state.verificationRun) return;
      state.lifecycle = PAYMENT_STAGE.SUBMITTED;
      renderPending(PAYMENT_STAGE.SUBMITTED, 'Verification did not finish within the bounded window. The transaction remains recorded and locked; use Retry verification rather than sending again.');
      showFeedback(error?.message || 'Verification did not finish. No second transaction will be sent.', 'error');
      persistPaymentUrl(PAYMENT_STAGE.SUBMITTED);
    }
  })();
  return state.verificationPromise;
}

async function payNow() {
  if (state.sending || state.lifecycle !== PAYMENT_STAGE.NOT_SUBMITTED || !state.payer || !state.preflight) return;
  const button = $('pay-now'); button.disabled = true; state.sending = true; clearFeedback();
  let sendAttempted = false;
  try {
    const provider = providerOrThrow();
    await walletChain(provider);
    const accounts = await provider.request({method: 'eth_accounts'});
    if (!Array.isArray(accounts) || !sameAddress(accounts[0], state.payer)) throw new Error('The connected payer account changed. Re-check before paying.');
    const fresh = await runPreflight({sender: state.payer, request: state.request, signature: state.signature});
    if (!sameAddress(fresh.request.recipient, state.preflight.request.recipient) || fresh.request.amount !== state.preflight.request.amount || fresh.request.nonce !== state.preflight.request.nonce) throw new Error('The payment intent changed. No transaction was requested.');
    const tx = buildPaymentTransaction(state.payer, state.request, fresh.gas);
    state.lifecycle = PAYMENT_STAGE.WALLET_PENDING;
    updatePaymentControls();
    persistPaymentUrl(PAYMENT_STAGE.WALLET_PENDING);
    showFeedback('Confirm the exact WIF transfer in your wallet. BEFORE cannot access your keys.', 'info');
    sendAttempted = true;
    const hash = await provider.request({method: 'eth_sendTransaction', params: [tx]});
    if (!isHash(hash)) throw new Error('Wallet returned an invalid transaction hash. Check wallet history before retrying.');
    // Persist before any receipt or block RPC. A reload from this URL is read-only.
    state.txHash = hash;
    state.lifecycle = PAYMENT_STAGE.SUBMITTED;
    persistPaymentUrl(PAYMENT_STAGE.SUBMITTED);
    showFeedback('Transaction submitted. Waiting for a mined receipt and independent Transfer-log verification…');
    await startVerification(hash);
  } catch (error) {
    if (state.txHash) {
      await startVerification(state.txHash);
    } else if (error?.code === 4001) {
      state.lifecycle = PAYMENT_STAGE.NOT_SUBMITTED;
      state.sending = false;
      updatePaymentControls();
      persistPaymentUrl(PAYMENT_STAGE.NOT_SUBMITTED);
      showFeedback('The payment was rejected in the wallet. No successful payment is claimed; you may re-check before retrying.', 'error');
    } else if (sendAttempted) {
      state.lifecycle = PAYMENT_STAGE.UNCERTAIN;
      renderPending(PAYMENT_STAGE.UNCERTAIN, 'The wallet did not return a usable hash. It may have accepted the request; check wallet history before considering any retry.');
      persistPaymentUrl(PAYMENT_STAGE.UNCERTAIN);
      showFeedback('The wallet response was uncertain. Do not retry until wallet history is checked.', 'error');
    } else {
      state.lifecycle = PAYMENT_STAGE.NOT_SUBMITTED;
      state.preflight = null;
      updatePaymentControls();
      showFeedback(error?.message || 'Payment failed closed before the wallet transfer request.', 'error');
    }
  } finally {
    state.sending = false;
    updatePaymentControls();
  }
}

async function loadFromUrl() {
  const params = new URLSearchParams(location.search);
  const payload = params.get('request');
  const tx = params.get('tx');
  const status = params.get('status');
  if (!payload) { setHidden('create-card', false); return; }
  try {
    const decoded = decodeSharePayload(payload);
    state.request = tx ? normalizeRequest(decoded.request) : validateRequest(decoded.request);
    state.signature = decoded.signature;
    const verified = await verifyRequestSignature(state.request, state.signature, rpc, {allowExpired: Boolean(tx)});
    state.signer = verified.signer;
    renderRequest(state.request, state.signature);
    if (tx) {
      if (!isHash(tx)) throw new Error('Proof transaction hash is malformed.');
      state.txHash = tx;
      state.lifecycle = PAYMENT_STAGE.SUBMITTED;
      renderPending(PAYMENT_STAGE.SUBMITTED, 'Resuming read-only verification for the recorded transaction. The Pay action is permanently disabled for this request.');
      void startVerification(tx);
    } else if (status && status !== PAYMENT_STAGE.NOT_SUBMITTED) {
      // A browser can be closed or refreshed while the wallet confirmation
      // promise is still pending. The wallet may broadcast without returning a
      // hash, so every serialized non-idle status is treated as uncertain when
      // no tx hash is present. Never reconstruct a sendable state from URL text.
      state.lifecycle = PAYMENT_STAGE.UNCERTAIN;
      renderPending(PAYMENT_STAGE.UNCERTAIN, 'Check wallet activity; no second payment from this request. The previous wallet confirmation may still have been accepted, but it returned no transaction hash.');
      persistPaymentUrl(PAYMENT_STAGE.UNCERTAIN);
      showFeedback('Check wallet activity; no second payment from this request.', 'error');
    }
  } catch (error) {
    state.request = null; state.signature = null;
    setHidden('request-card', true); setHidden('check-card', true); setHidden('create-card', false);
    showFeedback(error?.message || 'This shared request failed closed. No payment action is available.', 'error');
  }
}

$('create-form')?.addEventListener('submit', createRequest);
$('check-form')?.addEventListener('submit', checkPayment);
$('pay-now')?.addEventListener('click', payNow);
$('proof-retry')?.addEventListener('click', async () => {
  const button = $('proof-retry');
  button.disabled = true;
  showFeedback('Retrying read-only public receipt verification. No wallet transaction will be requested.', 'info');
  await startVerification(state.txHash);
  button.disabled = false;
});
$('copy-link')?.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('share-link').value); showFeedback('Request link copied. It contains a signed request, never a private key.', 'success'); }
  catch { $('share-link').focus(); $('share-link').select(); showFeedback('Clipboard access was unavailable; the signed link is selected for manual copy.'); }
});
$('new-request')?.addEventListener('click', () => { location.href = '/app/pay/'; });

for (const event of ['accountsChanged', 'chainChanged']) window.ethereum?.on?.(event, () => {
  if (state.txHash || state.lifecycle === PAYMENT_STAGE.WALLET_PENDING || state.lifecycle === PAYMENT_STAGE.UNCERTAIN) {
    if (!state.txHash) {
      state.lifecycle = PAYMENT_STAGE.UNCERTAIN;
      persistPaymentUrl(PAYMENT_STAGE.UNCERTAIN);
    }
    updatePaymentControls();
    showFeedback('Wallet state changed while a payment may be pending. The onchain attempt remains locked; do not send again.', 'error');
    return;
  }
  state.preflight = null; state.payer = null; updatePaymentControls();
  showFeedback('Wallet state changed. Re-run the payment check before any action.', 'error');
});

window.__beforePay = {state, rpc, runPreflight, verifyProof, waitForReceipt, startVerification, PAYMENT_STAGE};
loadFromUrl();
