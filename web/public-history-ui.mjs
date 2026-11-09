// The public WIF transfer viewer is deliberately wallet-free and read-only.
// Recipient transfers cannot prove which BEFORE offer or outside service initiated them.
import {
  PUBLIC_HISTORY_BLOCK_WINDOW, PUBLIC_HISTORY_DISPLAY_LIMIT, PUBLIC_HISTORY_MAX_LOGS,
  incomingWifFilter, parseIncomingWifEvent, publicHistoryWindow, verifyIncomingWifEvent
} from './public-history.mjs';
import {formatTokenAmount, isAddress, explorerTransactionUrl, WIF_MAINNET_CHAIN_ID} from './pay-core.mjs';

const $ = id => document.getElementById(id);
function shortAddress(v) { return v.slice(0, 6) + '…' + v.slice(-4); }
function shortHash(v) { return v.slice(0, 10) + '…' + v.slice(-8); }

export function mountPublicWifHistory({rpcCall}) {
  const input = $('public-history-recipient');
  const form = $('public-history-form');
  const status = $('public-history-status');
  const list = $('public-history-list');
  const more = $('public-history-more');
  if (!input || !form || !status || !list || !more) throw new Error('Public history controls are missing.');

  let activeRecipient = null;
  let nextBlock = null;
  let searchId = 0;
  let loading = false;
  const entries = new Map();

  const updateStatus = (message, kind = 'info') => {
    status.textContent = message;
    status.dataset.kind = kind;
  };
  const updateControls = () => {
    form.querySelector('button').disabled = loading;
    more.disabled = loading;
    more.hidden = nextBlock === null || entries.size === 0;
  };
  const render = () => {
    list.replaceChildren();
    const sorted = Array.from(entries.values()).sort((a, b) => {
      if (a.blockNumber !== b.blockNumber) return a.blockNumber > b.blockNumber ? -1 : 1;
      return a.logIndex > b.logIndex ? -1 : (a.logIndex < b.logIndex ? 1 : 0);
    }).slice(0, 60);
    for (const entry of sorted) {
      const row = document.createElement('li');
      const main = document.createElement('div');
      const amount = document.createElement('strong');
      amount.textContent = formatTokenAmount(entry.amount) + ' WIF';
      const detail = document.createElement('span');
      detail.textContent = 'From ' + shortAddress(entry.sender) + ' · Block ' + entry.blockNumber.toString();
      detail.title = entry.sender;
      const link = document.createElement('a');
      link.href = explorerTransactionUrl(entry.hash);
      link.target = '_blank'; link.rel = 'noopener noreferrer';
      link.textContent = 'Receipt ' + shortHash(entry.hash) + ' ↗';
      main.append(amount, detail); row.append(main, link); list.append(row);
    }
    $('public-history-empty').hidden = sorted.length !== 0;
    updateControls();
  };
  function setRecipient(recipient) {
    if (!isAddress(recipient)) return;
    if (input.value.trim().toLowerCase() === recipient.toLowerCase()) return;
    input.value = recipient;
    searchId += 1;
    activeRecipient = null;
    nextBlock = null;
    entries.clear();
    render();
    updateStatus('Recipient loaded. Select View public transfers to check the chain.');
  }

  async function search({older = false} = {}) {
    if (loading) return;
    const recipient = input.value.trim();
    if (!isAddress(recipient) || /^0x0{40}$/i.test(recipient)) {
      updateStatus('Enter a valid nonzero WIF recipient wallet address.', 'error');
      return;
    }
    if (older && (nextBlock === null || activeRecipient?.toLowerCase() !== recipient.toLowerCase())) return;
    const requestId = ++searchId;
    loading = true;
    if (!older) {
      activeRecipient = recipient;
      entries.clear();
      list.replaceChildren();
      nextBlock = null;
    }
    updateControls();
    updateStatus('Checking public Robinhood Chain WIF transfers and receipts…');
    try {
      const [chain, currentBlockHex] = await Promise.all([
        rpcCall('eth_chainId'), rpcCall('eth_blockNumber')
      ]);
      if (BigInt(chain) !== WIF_MAINNET_CHAIN_ID) throw new Error('Public RPC returned an unexpected chain.');
      const currentBlock = BigInt(currentBlockHex);
      const {from, to, olderTo} = publicHistoryWindow(older ? nextBlock : currentBlock);
      const logs = await rpcCall('eth_getLogs', [incomingWifFilter(recipient, from, to)]);
      if (!Array.isArray(logs) || logs.length > PUBLIC_HISTORY_MAX_LOGS) {
        throw new Error('This block window returned too many or malformed token events. Nothing unverified is displayed.');
      }
      const validEvents = [];
      for (const log of logs) {
        try { validEvents.push({log, parsed: parseIncomingWifEvent(log, recipient)}); }
        catch { /* Malformed, removed or unrelated log is never shown. */ }
      }
      validEvents.sort((a,b)=>a.parsed.blockNumber === b.parsed.blockNumber
        ? (a.parsed.logIndex > b.parsed.logIndex ? -1 : 1)
        : (a.parsed.blockNumber > b.parsed.blockNumber ? -1 : 1));
      let checked = 0;
      for (const event of validEvents.slice(0, PUBLIC_HISTORY_DISPLAY_LIMIT)) {
        // Bounded, sequential receipts avoid swamping a public RPC endpoint.
        try {
          const [transaction, receipt] = await Promise.all([
            rpcCall('eth_getTransactionByHash', [event.parsed.hash]),
            rpcCall('eth_getTransactionReceipt', [event.parsed.hash])
          ]);
          const proof = verifyIncomingWifEvent({
            log: event.log, recipient, transaction, receipt, currentBlock: currentBlockHex
          });
          entries.set(proof.hash.toLowerCase() + ':' + proof.logIndex.toString(), proof);
          checked += 1;
        } catch { /* Unproven logs never become receipts. */ }
      }
      if (requestId !== searchId || input.value.trim().toLowerCase() !== recipient.toLowerCase()) return;
      activeRecipient = recipient;
      nextBlock = olderTo;
      render();
      const verifiedCount = entries.size;
      const limited = validEvents.length > PUBLIC_HISTORY_DISPLAY_LIMIT;
      const notice = limited ? ' Showing up to ' + PUBLIC_HISTORY_DISPLAY_LIMIT + ' direct transfers from this block window.' : '';
      updateStatus(
        verifiedCount + ' independently verified direct WIF transfer' + (verifiedCount === 1 ? '' : 's')
        + ' shown. Scanned blocks ' + from.toString() + '–' + to.toString() + '.'
        + notice + ' These are recipient transfers, not proof of BEFORE campaign attribution.'
      );
    } catch (error) {
      if (requestId === searchId) {
        updateStatus('Public history could not be verified: ' + (error?.message || 'RPC unavailable') + '. No unverified transfers were added.', 'error');
      }
    } finally {
      loading = false;
      updateControls();
    }
  }
  form.addEventListener('submit', event => { event.preventDefault(); void search(); });
  more.addEventListener('click', () => { void search({older:true}); });
  render();
  return {setRecipient, refresh: () => search(), search};
}
