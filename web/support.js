import {
  WIF_MAINNET_CHAIN_ID, WIF_TOKEN, WIF_RPC, SUPPORT_INTERVALS,
  isAddress, isHash, sameAddress, parseTokenAmount, formatTokenAmount,
  validateSupportOffer, normalizeSupportOffer, supportTypedDataFor,
  verifySupportSignature, encodeSupportPayload, decodeSupportPayload,
  supportPaymentRequest, buildPaymentTransaction, decodeUintResult,
  decodeSymbolResult, validateRecipientCode, validateMinedTransfer,
  explorerTransactionUrl
} from './support-core.mjs';

const SUPPORT_STAGE = Object.freeze({
  NOT_SUBMITTED: 'not-submitted', WALLET_PENDING: 'wallet-pending',
  SUBMITTED: 'submitted', MINED_AWAITING_CONFIRMATIONS: 'mined-awaiting-confirmations',
  VERIFIED: 'verified', KNOWN_REVERTED: 'known-reverted', UNCERTAIN: 'uncertain'
});
const state = {
  offer: null, signature: null, signer: null, payer: null, preflight: null,
  cycleId: null, txHash: null, lifecycle: SUPPORT_STAGE.NOT_SUBMITTED,
  run: 0, sending: false, verificationRun: 0, verificationPromise: null
};
const TOKEN_BALANCE_SELECTOR = '0x70a08231';
const TOKEN_DECIMALS_SELECTOR = '0x313ce567';
const TOKEN_SYMBOL_SELECTOR = '0x95d89b41';
const RPC_TIMEOUT = 12_000;
const POLL_DELAYS = [250, 500, 750, 1_000, 1_500, 2_000, 3_000, 4_000, 5_000, 6_000];
const HISTORY_LIMIT = 12;

const $ = id => document.getElementById(id);
function setText(id, value) { const node = $(id); if (node) node.textContent = String(value); }
function setHidden(id, hidden) { const node = $(id); if (node) node.hidden = hidden; }
function showFeedback(message, kind = 'info') {
  const node = $('support-feedback');
  if (!node) return;
  node.textContent = message; node.dataset.kind = kind; node.hidden = false;
}
function clearFeedback() { if ($('support-feedback')) $('support-feedback').hidden = true; }
function shortAddress(value) { return value.slice(0, 6) + '…' + value.slice(-4); }
function shortHash(value) { return value.slice(0, 10) + '…' + value.slice(-8); }
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
  if (!window.ethereum || typeof window.ethereum.request !== 'function') throw new Error('No EIP-1193 wallet was detected. Open a compatible wallet to continue.');
  return window.ethereum;
}
async function walletChain(provider) {
  const chain = quantity(await provider.request({method: 'eth_chainId'}), 'Wallet chain ID');
  if (chain !== WIF_MAINNET_CHAIN_ID) throw new Error('Wallet is not connected to Robinhood Chain mainnet (4663). No support payment is requested.');
  return chain;
}
async function walletAccount(provider, requestAccounts = true) {
  const accounts = await provider.request({method: requestAccounts ? 'eth_requestAccounts' : 'eth_accounts'});
  if (!Array.isArray(accounts) || !isAddress(accounts[0])) throw new Error('Wallet did not return a valid account.');
  return accounts[0];
}
function balanceData(address) { return TOKEN_BALANCE_SELECTOR + address.toLowerCase().slice(2).padStart(64, '0'); }

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

function ensureCycle() {
  if (state.cycleId) return state.cycleId;
  if (!window.crypto?.getRandomValues) throw new Error('Secure randomness is unavailable; no support cycle was created.');
  const bytes = new Uint8Array(32); window.crypto.getRandomValues(bytes);
  state.cycleId = '0x' + Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return state.cycleId;
}

async function runPreflight({sender, offer, cycleId, signature}) {
  const run = ++state.run;
  const normalized = validateSupportOffer(offer);
  const request = supportPaymentRequest(normalized, cycleId);
  const facts = await readTokenFacts();
  const recipientCode = await rpc('eth_getCode', [normalized.recipient, 'latest']);
  validateRecipientCode(recipientCode);
  const signatureCheck = await verifySupportSignature(normalized, signature, rpc);
  if (!sameAddress(signatureCheck.signer, normalized.recipient)) throw new Error('Support recipient signature signer changed.');
  const [balanceHex, nativeHex, gasPriceHex, gasHex] = await Promise.all([
    rpc('eth_call', [{to: WIF_TOKEN, data: balanceData(sender)}, 'latest']),
    rpc('eth_getBalance', [sender, 'latest']), rpc('eth_gasPrice'),
    rpc('eth_estimateGas', [{from: sender, to: WIF_TOKEN, data: requestData(request), value: '0x0'}])
  ]);
  const balance = decodeUintResult(balanceHex, 'WIF balance');
  const nativeBalance = quantity(nativeHex, 'Native balance');
  const gasPrice = quantity(gasPriceHex, 'Gas price');
  const gas = quantity(gasHex, 'Gas estimate');
  if (balance < normalized.amount) throw new Error(`Insufficient WIF: this wallet has ${formatTokenAmount(balance)} WIF, but this support offer is ${formatTokenAmount(normalized.amount)} WIF.`);
  if (nativeBalance < gas * gasPrice) throw new Error('Insufficient native ETH for the estimated mainnet gas.');
  if (run !== state.run) throw new Error('Support check became stale. Retry with the current offer.');
  return {offer: normalized, request, signer: signatureCheck.signer, facts, balance, nativeBalance, gasPrice, gas, gasCost: gas * gasPrice};
}

function requestData(request) {
  return '0xa9059cbb' + request.recipient.slice(2).toLowerCase().padStart(64, '0') + request.amount.toString(16).padStart(64, '0');
}
function stageLabel(stage) {
  return {
    [SUPPORT_STAGE.WALLET_PENDING]: 'Wallet pending',
    [SUPPORT_STAGE.SUBMITTED]: 'Submitted · awaiting receipt',
    [SUPPORT_STAGE.MINED_AWAITING_CONFIRMATIONS]: 'Mined · awaiting confirmations',
    [SUPPORT_STAGE.VERIFIED]: 'Verified · final',
    [SUPPORT_STAGE.KNOWN_REVERTED]: 'Known reverted',
    [SUPPORT_STAGE.UNCERTAIN]: 'Uncertain · do not retry'
  }[stage] || 'Not submitted';
}

function supportUrl(stage = state.lifecycle) {
  const link = new URL('/app/support/', location.origin);
  link.searchParams.set('offer', encodeSupportPayload(state.offer, state.signature));
  if (state.cycleId) link.searchParams.set('cycle', state.cycleId);
  if (state.txHash) link.searchParams.set('tx', state.txHash);
  if (stage !== SUPPORT_STAGE.NOT_SUBMITTED) link.searchParams.set('status', stage);
  return link;
}
function persistSupportUrl(stage = state.lifecycle) {
  if (!state.offer || !state.signature) return;
  const link = supportUrl(stage);
  history.replaceState(null, '', link.pathname + link.search);
}
function updateControls() {
  const button = $('support-now');
  if (button) button.disabled = state.lifecycle !== SUPPORT_STAGE.NOT_SUBMITTED || !state.preflight || state.sending;
  const check = $('check-support');
  if (check) check.disabled = state.lifecycle !== SUPPORT_STAGE.NOT_SUBMITTED || state.sending;
}
function renderOffer() {
  if (!state.offer) return;
  const offer = normalizeSupportOffer(state.offer);
  setText('support-recipient', offer.recipient); $('support-recipient').title = offer.recipient;
  setText('support-amount-display', formatTokenAmount(offer.amount) + ' WIF');
  setText('support-interval-display', SUPPORT_INTERVALS[offer.interval].label);
  setText('support-expiry-display', new Date(Number(offer.expiresAt) * 1000).toLocaleString());
  setText('support-campaign-display', offer.campaignId.slice(0, 10) + '…');
  $('support-campaign-display').title = offer.campaignId;
  setHidden('create-support-card', true); setHidden('open-support-card', true);
  setHidden('offer-card', false); setHidden('history-card', false);
  if (state.lifecycle === SUPPORT_STAGE.NOT_SUBMITTED) {
    setHidden('check-card', false); setHidden('proof-card', true);
  }
  updateControls();
}
function setShareLink(link) {
  $('support-share-link').value = link;
  setHidden('share-card', false);
}
function renderPending(stage, message) {
  state.lifecycle = stage; updateControls();
  setText('support-proof-state', stageLabel(stage));
  const title = $('support-proof-title');
  if (title) title.innerHTML = stage === SUPPORT_STAGE.KNOWN_REVERTED ? 'The contribution<br><em>did not settle.</em>' : stage === SUPPORT_STAGE.UNCERTAIN ? 'Check before<br><em>retrying.</em>' : 'Contribution<br><em>in progress.</em>';
  setText('support-proof-description', message);
  setText('support-proof-hash', state.txHash ? shortHash(state.txHash) : 'No hash returned');
  if ($('support-proof-hash') && state.txHash) $('support-proof-hash').title = state.txHash;
  setText('support-proof-block', '—');
  setText('support-proof-confirmations', stage === SUPPORT_STAGE.MINED_AWAITING_CONFIRMATIONS ? 'Below required depth' : 'Not yet final');
  if (state.txHash) { $('support-proof-explorer').href = explorerTransactionUrl(state.txHash); setHidden('support-proof-explorer', false); }
  else setHidden('support-proof-explorer', true);
  setHidden('support-proof-retry', !state.txHash || stage === SUPPORT_STAGE.KNOWN_REVERTED);
  setHidden('support-again', true); setHidden('support-next-suggestion', true);
  setHidden('proof-card', false); setHidden('check-card', true); setHidden('offer-card', true); setHidden('share-card', true);
}
function renderProof(proof) {
  state.lifecycle = SUPPORT_STAGE.VERIFIED; updateControls();
  setText('support-proof-state', stageLabel(SUPPORT_STAGE.VERIFIED));
  $('support-proof-title').innerHTML = 'Support with<br><em>proof.</em>';
  setText('support-proof-description', 'This contribution passed a fresh public receipt check for the exact payer, recipient, WIF calldata and Transfer event. A new contribution always needs a new wallet confirmation.');
  setText('support-proof-hash', shortHash(proof.hash)); $('support-proof-hash').title = proof.hash;
  setText('support-proof-block', quantity(proof.blockNumber).toString());
  setText('support-proof-confirmations', proof.confirmations + ' confirmations');
  $('support-proof-explorer').href = explorerTransactionUrl(proof.hash); setHidden('support-proof-explorer', false);
  setHidden('support-proof-retry', true); setHidden('support-again', false);
  const next = $('support-next-suggestion');
  if (next) {
    const intervalDays = SUPPORT_INTERVALS[state.offer.interval]?.days;
    if (intervalDays) {
      // This is a local suggestion, NOT a notification or onchain subscription.
      // Re-verification preserves the previously saved local date rather than moving it forward.
      const saved = readStoredHistory().find(entry => entry.hash?.toLowerCase() === proof.hash.toLowerCase());
      const prior = Number(saved?.createdAt);
      const verifiedAt = Number.isSafeInteger(prior) && prior > 0 ? prior : Math.floor(Date.now() / 1000);
      const returnAt = verifiedAt + intervalDays * 86400;
      const expiry = Number(state.offer.expiresAt);
      next.textContent = returnAt >= expiry
        ? 'This offer will expire before the suggested return date. Ask the recipient for a renewed signed link. No payment is scheduled.'
        : 'Suggested return date: ' + new Date(returnAt * 1000).toLocaleDateString() + '. No notification or automatic payment will occur.';
      next.hidden = false;
    } else next.hidden = true;
  }
  setHidden('proof-card', false); setHidden('check-card', true); setHidden('offer-card', true); setHidden('share-card', true);
}

function historyKey() { return state.offer ? 'before-support-history-v1:' + state.offer.campaignId.toLowerCase() : null; }
function readStoredHistory() {
  try {
    const value = JSON.parse(localStorage.getItem(historyKey()) || '[]');
    return Array.isArray(value) ? value.slice(0, HISTORY_LIMIT) : [];
  } catch { return []; }
}
function writeStoredHistory(entries) {
  try { localStorage.setItem(historyKey(), JSON.stringify(entries.slice(0, HISTORY_LIMIT))); } catch { /* Private browsing may disable storage. */ }
}
async function refreshHistory() {
  if (!state.offer || !$('history-list')) return;
  const valid = [];
  for (const entry of readStoredHistory()) {
    if (!entry || !isHash(entry.hash) || !isAddress(entry.payer) || !isHash(entry.cycleId)) continue;
    try {
      const request = supportPaymentRequest(state.offer, entry.cycleId);
      const [transaction, receipt, currentBlock] = await Promise.all([
        rpc('eth_getTransactionByHash', [entry.hash]), rpc('eth_getTransactionReceipt', [entry.hash]), rpc('eth_blockNumber')
      ]);
      if (!transaction || !receipt) continue;
      const proof = validateMinedTransfer({transaction, receipt, request, sender: entry.payer, currentBlock, confirmations: 3});
      valid.push({...entry, proof});
    } catch { /* A local record is not a proof until public RPC revalidation succeeds. */ }
  }
  writeStoredHistory(valid.map(({proof, ...entry}) => entry));
  const list = $('history-list'); list.replaceChildren();
  setHidden('history-empty', valid.length !== 0);
  if (!valid.length) { setHidden('history-empty', false); $('history-empty').textContent = 'No verified contributions saved on this device yet.'; return; }
  for (const entry of valid) {
    const item = document.createElement('li');
    const text = document.createElement('span');
    text.textContent = `${formatTokenAmount(state.offer.amount)} WIF · ${new Date(Number(entry.createdAt || 0) * 1000).toLocaleDateString()}`;
    const link = document.createElement('a'); link.href = explorerTransactionUrl(entry.hash); link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'Verified receipt ↗';
    item.append(text, link); list.append(item);
  }
}
function rememberHistory(proof, payer) {
  const current = readStoredHistory().filter(entry => entry.hash.toLowerCase() !== proof.hash.toLowerCase() && entry.cycleId.toLowerCase() !== state.cycleId.toLowerCase());
  current.unshift({hash: proof.hash, payer, cycleId: state.cycleId, createdAt: Math.floor(Date.now() / 1000)});
  writeStoredHistory(current);
}

async function createSupportOffer(event) {
  event.preventDefault();
  const button = $('create-support'); button.disabled = true; clearFeedback();
  try {
    const provider = providerOrThrow(); await walletChain(provider);
    const recipient = await walletAccount(provider);
    const amount = parseTokenAmount($('support-amount').value);
    const interval = $('support-interval').value;
    if (!SUPPORT_INTERVALS[interval]) throw new Error('Choose a supported contribution cadence.');
    const days = Number.parseInt($('support-expiry').value, 10);
    if (!Number.isInteger(days) || days < 1 || BigInt(days) * 24n * 60n * 60n > 120n * 24n * 60n * 60n) throw new Error('Support offer expiry must be between 1 and 120 days.');
    await readTokenFacts(); validateRecipientCode(await rpc('eth_getCode', [recipient, 'latest']));
    if (!window.crypto?.getRandomValues) throw new Error('Secure randomness is unavailable; no support offer was created.');
    const campaignBytes = new Uint8Array(32); window.crypto.getRandomValues(campaignBytes);
    const campaignId = '0x' + Array.from(campaignBytes, byte => byte.toString(16).padStart(2, '0')).join('');
    const offer = validateSupportOffer({recipient, token: WIF_TOKEN, chainId: WIF_MAINNET_CHAIN_ID, amount, interval, expiresAt: timestamp() + BigInt(days) * 24n * 60n * 60n, campaignId});
    showFeedback('Confirm the support offer in your wallet. This signs a public offer only; it never approves or transfers WIF.');
    const signature = await provider.request({method: 'eth_signTypedData_v4', params: [recipient, JSON.stringify(supportTypedDataFor(offer))]});
    const verified = await verifySupportSignature(offer, signature, rpc);
    if (!sameAddress(verified.signer, recipient)) throw new Error('Wallet signature did not authenticate the support recipient.');
    state.offer = offer; state.signature = signature; state.signer = verified.signer; state.payer = null; state.preflight = null; state.cycleId = null; state.txHash = null; state.lifecycle = SUPPORT_STAGE.NOT_SUBMITTED;
    renderOffer(); setShareLink(supportUrl(SUPPORT_STAGE.NOT_SUBMITTED).toString());
    await refreshHistory();
    showFeedback('Support page ready. Share it; each contribution will be checked and confirmed separately in the supporter’s wallet.', 'success');
  } catch (error) {
    showFeedback(error?.code === 4001 ? 'The support offer signature was rejected. No offer was created.' : error?.message || 'Support offer creation failed.', 'error');
  } finally { button.disabled = false; }
}

async function checkSupport(event) {
  event?.preventDefault();
  if (state.lifecycle !== SUPPORT_STAGE.NOT_SUBMITTED) { showFeedback('This support cycle already has a wallet attempt. Verify it before considering any next action.', 'error'); return; }
  const button = $('check-support'); button.disabled = true; clearFeedback();
  try {
    const provider = providerOrThrow(); await walletChain(provider);
    const payer = await walletAccount(provider); state.cycleId = ensureCycle(); persistSupportUrl(SUPPORT_STAGE.NOT_SUBMITTED);
    state.payer = payer; state.preflight = await runPreflight({sender: payer, offer: state.offer, cycleId: state.cycleId, signature: state.signature});
    setText('support-payer', payer); $('support-payer').title = payer;
    setText('support-balance', formatTokenAmount(state.preflight.balance) + ' WIF');
    setText('support-gas', formatTokenAmount(state.preflight.gasCost) + ' ETH estimated');
    setText('support-cycle', shortHash(state.cycleId)); $('support-cycle').title = state.cycleId;
    setText('support-check-state', 'Verified · ready for explicit support');
    setHidden('check-results', false); updateControls();
    showFeedback('The offer, recipient, WIF contract, balance and gas passed. The next button opens one explicit wallet transfer.', 'success');
  } catch (error) {
    state.preflight = null; updateControls(); setHidden('check-results', true);
    showFeedback(error?.code === 4001 ? 'The supporter connection was rejected. No payment was requested.' : error?.message || 'Support checks failed closed.', 'error');
  } finally { button.disabled = false; }
}

async function observeSupport(hash, offer, cycleId, sender) {
  const request = supportPaymentRequest(offer, cycleId);
  const [transaction, receipt, currentBlock] = await Promise.all([
    rpc('eth_getTransactionByHash', [hash]), rpc('eth_getTransactionReceipt', [hash]), rpc('eth_blockNumber')
  ]);
  if (!transaction) return {stage: SUPPORT_STAGE.SUBMITTED, message: 'Transaction hash recorded. Waiting for public RPC indexing; this support cycle is locked.'};
  if (!receipt) return {stage: SUPPORT_STAGE.SUBMITTED, message: 'Transaction submitted. Waiting for a mined receipt; do not click Support again for this cycle.'};
  if (receipt.status !== '0x1') return {stage: SUPPORT_STAGE.KNOWN_REVERTED, message: 'The receipt is mined but reports failure. No successful WIF contribution is claimed, and this cycle remains locked.'};
  try {
    const proof = validateMinedTransfer({transaction, receipt, request, sender: sender || transaction.from, currentBlock, confirmations: 3});
    return {stage: SUPPORT_STAGE.VERIFIED, proof, payer: sender || transaction.from};
  } catch (error) {
    if (/Waiting for 3 confirmations/.test(error?.message || '')) {
      const head = quantity(currentBlock, 'Current block'); const block = quantity(receipt.blockNumber, 'Receipt block');
      return {stage: SUPPORT_STAGE.MINED_AWAITING_CONFIRMATIONS, message: `Receipt mined with ${Number(head - block + 1n)} confirmation${head - block === 0n ? '' : 's'}; waiting for 3 confirmations before claiming proof.`};
    }
    throw error;
  }
}
async function waitForReceipt(hash, offer = state.offer, cycleId = state.cycleId, sender = state.payer) {
  let lastError = null;
  for (let attempt = 0; attempt <= POLL_DELAYS.length; attempt++) {
    try {
      const observation = await observeSupport(hash, offer, cycleId, sender);
      if (observation.stage === SUPPORT_STAGE.VERIFIED || observation.stage === SUPPORT_STAGE.KNOWN_REVERTED) return observation;
      renderPending(observation.stage, observation.message); showFeedback(observation.message, observation.stage === SUPPORT_STAGE.SUBMITTED ? 'info' : 'error');
    } catch (error) {
      lastError = error; renderPending(SUPPORT_STAGE.SUBMITTED, 'Public RPC verification is temporarily unavailable or incomplete. The cycle remains locked; retry verification without sending another transaction.'); showFeedback(error?.message || 'Public RPC verification failed. No second transaction will be sent.', 'error');
    }
    if (attempt === POLL_DELAYS.length) break;
    await sleep(POLL_DELAYS[attempt]);
  }
  const error = new Error(lastError?.message || 'Verification timed out. The cycle remains pending or unverified; retry receipt verification later.');
  error.code = 'VERIFICATION_TIMEOUT'; throw error;
}
async function startVerification(hash = state.txHash) {
  if (!isHash(hash) || !state.cycleId) return;
  state.txHash = hash; const run = ++state.verificationRun;
  state.verificationPromise = (async () => {
    try {
      const observation = await waitForReceipt(hash, state.offer, state.cycleId, state.payer);
      if (run !== state.verificationRun) return;
      if (observation.stage === SUPPORT_STAGE.KNOWN_REVERTED) {
        renderPending(observation.stage, observation.message); showFeedback(observation.message, 'error'); persistSupportUrl(observation.stage);
      } else {
        renderProof(observation.proof); rememberHistory(observation.proof, observation.payer); await refreshHistory(); persistSupportUrl(SUPPORT_STAGE.VERIFIED); showFeedback('Contribution proof verified from public RPC: payer, exact WIF transfer, success receipt and Transfer log all match.', 'success');
      }
    } catch (error) {
      if (run !== state.verificationRun) return;
      state.lifecycle = SUPPORT_STAGE.SUBMITTED; renderPending(SUPPORT_STAGE.SUBMITTED, 'Verification did not finish within the bounded window. The transaction remains recorded and locked; retry verification rather than sending again.'); showFeedback(error?.message || 'Verification did not finish. No second transaction will be sent.', 'error'); persistSupportUrl(SUPPORT_STAGE.SUBMITTED);
    }
  })();
  return state.verificationPromise;
}

async function supportNow() {
  if (state.sending || state.lifecycle !== SUPPORT_STAGE.NOT_SUBMITTED || !state.payer || !state.preflight) return;
  const button = $('support-now'); button.disabled = true; state.sending = true; clearFeedback();
  let sendAttempted = false;
  try {
    const provider = providerOrThrow(); await walletChain(provider);
    const accounts = await provider.request({method: 'eth_accounts'});
    if (!Array.isArray(accounts) || !sameAddress(accounts[0], state.payer)) throw new Error('The connected supporter account changed. Re-check before supporting.');
    const fresh = await runPreflight({sender: state.payer, offer: state.offer, cycleId: state.cycleId, signature: state.signature});
    if (!sameAddress(fresh.request.recipient, state.preflight.request.recipient) || fresh.request.amount !== state.preflight.request.amount || fresh.request.nonce !== state.preflight.request.nonce) throw new Error('The support intent changed. No transaction was requested.');
    const tx = buildPaymentTransaction(state.payer, fresh.request);
    state.lifecycle = SUPPORT_STAGE.WALLET_PENDING; updateControls(); persistSupportUrl(SUPPORT_STAGE.WALLET_PENDING);
    showFeedback('Confirm the exact WIF contribution in your wallet. BEFORE cannot access your keys.', 'info');
    sendAttempted = true;
    const hash = await provider.request({method: 'eth_sendTransaction', params: [tx]});
    if (!isHash(hash)) throw new Error('Wallet returned an invalid transaction hash. Check wallet history before retrying.');
    state.txHash = hash; state.lifecycle = SUPPORT_STAGE.SUBMITTED; persistSupportUrl(SUPPORT_STAGE.SUBMITTED);
    showFeedback('Contribution submitted. Waiting for a mined receipt and independent Transfer-log verification…'); await startVerification(hash);
  } catch (error) {
    if (state.txHash) await startVerification(state.txHash);
    else if (sendAttempted) {
      state.lifecycle = SUPPORT_STAGE.UNCERTAIN; renderPending(SUPPORT_STAGE.UNCERTAIN, 'The wallet response was not conclusive. Check wallet activity; this cycle is locked so a reload or repeated click cannot send another contribution.'); persistSupportUrl(SUPPORT_STAGE.UNCERTAIN); showFeedback('Check wallet activity; this support cycle is locked against a duplicate send.', 'error');
    } else {
      state.lifecycle = SUPPORT_STAGE.NOT_SUBMITTED; state.preflight = null; updateControls(); showFeedback(error?.message || 'Support failed closed before the wallet transfer request.', 'error');
    }
  } finally { state.sending = false; updateControls(); }
}

function beginNewCycle() {
  if (state.lifecycle !== SUPPORT_STAGE.VERIFIED) return;
  state.cycleId = null; state.txHash = null; state.payer = null; state.preflight = null; state.lifecycle = SUPPORT_STAGE.NOT_SUBMITTED; state.sending = false;
  persistSupportUrl(SUPPORT_STAGE.NOT_SUBMITTED); renderOffer(); setHidden('share-card', true); showFeedback('New support cycle created. Check the exact offer, then confirm a fresh wallet transfer when you choose.', 'info');
  void refreshHistory(); $('check-card')?.scrollIntoView({block: 'start'});
}

async function loadFromUrl() {
  const params = new URLSearchParams(location.search); const payload = params.get('offer'); const tx = params.get('tx'); const status = params.get('status'); const cycle = params.get('cycle');
  if (!payload) { setHidden('create-support-card', false); setHidden('open-support-card', false); return; }
  try {
    const decoded = decodeSupportPayload(payload); state.offer = tx ? normalizeSupportOffer(decoded.offer) : validateSupportOffer(decoded.offer); state.signature = decoded.signature;
    const verified = await verifySupportSignature(state.offer, state.signature, rpc, {allowExpired: Boolean(tx)}); state.signer = verified.signer;
    if (cycle && !/^0x[0-9a-fA-F]{64}$/.test(cycle)) throw new Error('Support cycle ID is malformed.');
    state.cycleId = cycle || null; renderOffer(); void refreshHistory();
    if (tx) {
      if (!isHash(tx) || !state.cycleId) throw new Error('Support proof must include a valid cycle ID and transaction hash.');
      state.txHash = tx; state.lifecycle = SUPPORT_STAGE.SUBMITTED; renderPending(SUPPORT_STAGE.SUBMITTED, 'Resuming read-only verification for the recorded contribution. Support is permanently disabled for this cycle.'); void startVerification(tx);
    } else if (status && status !== SUPPORT_STAGE.NOT_SUBMITTED) {
      state.lifecycle = SUPPORT_STAGE.UNCERTAIN; renderPending(SUPPORT_STAGE.UNCERTAIN, 'Check wallet activity; this cycle was interrupted before a hash was recorded. No second contribution from this cycle is available.'); persistSupportUrl(SUPPORT_STAGE.UNCERTAIN); showFeedback('Check wallet activity; this support cycle is locked against a duplicate send.', 'error');
    }
  } catch (error) {
    state.offer = null; state.signature = null; setHidden('offer-card', true); setHidden('check-card', true); setHidden('history-card', true); setHidden('create-support-card', false); showFeedback(error?.message || 'This support link failed closed. No payment action is available.', 'error');
  }
}

$('create-support-form')?.addEventListener('submit', createSupportOffer);
$('check-support-form')?.addEventListener('submit', checkSupport);
$('support-now')?.addEventListener('click', supportNow);
$('support-again')?.addEventListener('click', beginNewCycle);
$('support-proof-retry')?.addEventListener('click', async () => { const button = $('support-proof-retry'); button.disabled = true; showFeedback('Retrying read-only public receipt verification. No wallet transaction will be requested.', 'info'); await startVerification(state.txHash); button.disabled = false; });
$('copy-support-link')?.addEventListener('click', async () => { try { await navigator.clipboard.writeText($('support-share-link').value); showFeedback('Support link copied. It contains a public offer, never a private key.', 'success'); } catch { $('support-share-link').focus(); $('support-share-link').select(); showFeedback('Clipboard access was unavailable; the support link is selected for manual copy.'); } });
$('new-support-offer')?.addEventListener('click', () => { location.href = '/app/support/'; });
$('open-support-form')?.addEventListener('submit', event => {
  event.preventDefault();
  try {
    const raw = $('support-link').value.trim(); if (raw.length > 8192) throw new Error('Support link is too long.');
    const link = new URL(raw);
    if (link.origin !== location.origin || link.pathname !== '/app/support/' || (link.protocol !== 'https:' && link.hostname !== 'localhost' && link.hostname !== '127.0.0.1')) throw new Error('Open a BEFORE Support link from this website. Do not enter wallet keys or unrelated links.');
    const payload = link.searchParams.get('offer'); if (!payload) throw new Error('This link has no signed support offer.'); decodeSupportPayload(payload);
    const safe = new URL('/app/support/', location.origin); safe.searchParams.set('offer', payload);
    for (const key of ['cycle', 'tx', 'status']) if (link.searchParams.has(key)) safe.searchParams.set(key, link.searchParams.get(key));
    location.assign(safe.pathname + safe.search);
  } catch (error) { showFeedback(error?.message || 'Paste a valid BEFORE Support link.', 'error'); }
});

for (const event of ['accountsChanged', 'chainChanged']) window.ethereum?.on?.(event, () => {
  if (state.txHash || state.lifecycle === SUPPORT_STAGE.WALLET_PENDING || state.lifecycle === SUPPORT_STAGE.UNCERTAIN) {
    if (!state.txHash) { state.lifecycle = SUPPORT_STAGE.UNCERTAIN; persistSupportUrl(SUPPORT_STAGE.UNCERTAIN); }
    updateControls(); showFeedback('Wallet state changed while a contribution may be pending. The cycle remains locked; do not send again.', 'error'); return;
  }
  state.preflight = null; state.payer = null; updateControls(); showFeedback('Wallet state changed. Re-run the support check before any action.', 'error');
});

window.__beforeSupport = {state, rpc, runPreflight, waitForReceipt, startVerification, SUPPORT_STAGE, refreshHistory};
loadFromUrl();
