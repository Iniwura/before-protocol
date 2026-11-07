import {
  WIF_MAINNET_CHAIN_ID, WIF_TOKEN, WIF_RPC, WIF_EXPLORER, PAYMENT_MAX_LIFETIME,
  isAddress, isHash, sameAddress, sameHash, parseTokenAmount, formatTokenAmount, normalizeRequest,
  typedDataFor, validateRequest, verifyRequestSignature, encodeSharePayload, decodeSharePayload,
  buildPaymentTransaction, decodeUintResult, decodeSymbolResult, validateRecipientCode,
  validateMinedTransfer, explorerTransactionUrl
} from './pay-core.mjs';

const $ = id => document.getElementById(id);
const state = {request: null, signature: null, signer: null, payer: null, preflight: null, txHash: null, run: 0, sending: false};
const TOKEN_BALANCE_SELECTOR = '0x70a08231';
const TOKEN_DECIMALS_SELECTOR = '0x313ce567';
const TOKEN_SYMBOL_SELECTOR = '0x95d89b41';
const RPC_TIMEOUT = 12_000;

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
function sameBytes(a, b) { return typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase(); }

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

async function runPreflight({provider, sender, request, signature}) {
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
}

function setShareLink(link) {
  $('share-link').value = link;
  setHidden('share-card', false);
  $('share-link').focus();
  $('share-link').select();
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
    state.request = request; state.signature = signature; state.signer = verified.signer; state.payer = null; state.preflight = null;
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
  const button = $('check-payment'); button.disabled = true; clearFeedback();
  try {
    const provider = providerOrThrow();
    await walletChain(provider);
    const payer = await walletAccount(provider);
    state.payer = payer;
    state.preflight = await runPreflight({provider, sender: payer, request: state.request, signature: state.signature});
    setText('check-sender', shortAddress(payer)); $('check-sender').title = payer;
    setText('check-balance', formatTokenAmount(state.preflight.balance) + ' WIF');
    setText('check-gas', formatTokenAmount(state.preflight.gasCost) + ' ETH estimated');
    setText('check-state', 'Verified · ready for explicit payment');
    setHidden('check-results', false);
    $('pay-now').disabled = false;
    showFeedback('All checks passed. The next button is the only action that can open the wallet transfer confirmation.', 'success');
  } catch (error) {
    state.preflight = null; $('pay-now').disabled = true; setHidden('check-results', true);
    showFeedback(error?.code === 4001 ? 'The payer connection was rejected. No payment was requested.' : error?.message || 'Payment checks failed closed.', 'error');
  } finally { button.disabled = false; }
}

async function waitForReceipt(hash) {
  for (let attempt = 0; attempt < 45; attempt++) {
    const receipt = await rpc('eth_getTransactionReceipt', [hash]);
    if (receipt) return receipt;
    await new Promise(resolve => setTimeout(resolve, 1_400));
  }
  throw new Error('No mined receipt was found yet. Proof remains unverified; retry from the receipt link later.');
}

async function verifyProof(hash, request, sender) {
  const [transaction, receipt, currentBlock] = await Promise.all([
    rpc('eth_getTransactionByHash', [hash]), rpc('eth_getTransactionReceipt', [hash]), rpc('eth_blockNumber')
  ]);
  if (!receipt) throw new Error('No receipt is available for this transaction.');
  const actualSender = sender || transaction?.from;
  if (!isAddress(actualSender)) throw new Error('Mined transaction sender is missing.');
  return validateMinedTransfer({transaction, receipt, request, sender: actualSender, currentBlock, confirmations: 3});
}

function renderProof(proof) {
  setText('proof-hash', shortAddress(proof.hash)); $('proof-hash').title = proof.hash;
  setText('proof-block', quantity(proof.blockNumber).toString());
  setText('proof-confirmations', proof.confirmations + ' confirmations');
  $('proof-explorer').href = explorerTransactionUrl(proof.hash);
  setHidden('proof-card', false); setHidden('check-card', true); setHidden('request-card', true); setHidden('share-card', true);
}

async function payNow() {
  if (state.sending || !state.payer || !state.preflight) return;
  const button = $('pay-now'); button.disabled = true; state.sending = true; clearFeedback();
  try {
    const provider = providerOrThrow();
    await walletChain(provider);
    const accounts = await provider.request({method: 'eth_accounts'});
    if (!Array.isArray(accounts) || !sameAddress(accounts[0], state.payer)) throw new Error('The connected payer account changed. Re-check before paying.');
    const fresh = await runPreflight({provider, sender: state.payer, request: state.request, signature: state.signature});
    if (!sameAddress(fresh.request.recipient, state.preflight.request.recipient) || fresh.request.amount !== state.preflight.request.amount || fresh.request.nonce !== state.preflight.request.nonce) throw new Error('The payment intent changed. No transaction was requested.');
    const tx = buildPaymentTransaction(state.payer, state.request, fresh.gas);
    showFeedback('Confirm the exact WIF transfer in your wallet. BEFORE cannot access your keys.', 'info');
    const hash = await provider.request({method: 'eth_sendTransaction', params: [tx]});
    if (!isHash(hash)) throw new Error('Wallet returned an invalid transaction hash.');
    state.txHash = hash;
    showFeedback('Transaction submitted. Waiting for a mined receipt and independent Transfer-log verification…');
    const proof = await verifyProof(hash, state.request, state.payer);
    const link = new URL('/app/pay/', location.origin);
    link.searchParams.set('request', encodeSharePayload(state.request, state.signature));
    link.searchParams.set('tx', hash);
    history.replaceState(null, '', link.pathname + link.search);
    renderProof(proof);
    showFeedback('Payment proof verified from public RPC: sender, exact calldata, success receipt and WIF Transfer log all match.', 'success');
  } catch (error) {
    $('pay-now').disabled = !state.preflight;
    showFeedback(error?.code === 4001 ? 'The payment was rejected in the wallet. No successful payment is claimed.' : error?.message || 'Payment failed closed.', 'error');
  } finally { state.sending = false; }
}

async function loadFromUrl() {
  const payload = new URLSearchParams(location.search).get('request');
  const tx = new URLSearchParams(location.search).get('tx');
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
      const proof = await verifyProof(tx, state.request);
      renderProof(proof);
      showFeedback('This proof was independently revalidated from public RPC. It is not a localStorage claim.', 'success');
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
$('copy-link')?.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('share-link').value); showFeedback('Request link copied. It contains a signed request, never a private key.', 'success'); }
  catch { $('share-link').focus(); $('share-link').select(); showFeedback('Clipboard access was unavailable; the signed link is selected for manual copy.'); }
});
$('new-request')?.addEventListener('click', () => { location.href = '/app/pay/'; });

for (const event of ['accountsChanged', 'chainChanged']) window.ethereum?.on?.(event, () => {
  state.preflight = null; state.payer = null; if ($('pay-now')) $('pay-now').disabled = true;
  showFeedback('Wallet state changed. Re-run the payment check before any action.', 'error');
});

window.__beforePay = {state, rpc, runPreflight, verifyProof};
loadFromUrl();
