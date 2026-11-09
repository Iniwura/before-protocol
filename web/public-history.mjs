// Recipient-centric public WIF history for BEFORE Support.
// A direct WIF Transfer event proves a token transfer, NOT a BEFORE campaign,
// support-page interaction, or unique human customer. Every listed entry must
// pass the existing mined WIF transfer verification boundary again.
import {
  WIF_TOKEN, WIF_MAINNET_CHAIN_ID, TRANSFER_TOPIC, isAddress, isHash, sameAddress,
  validateMinedTransfer
} from './pay-core.mjs';

export const PUBLIC_HISTORY_BLOCK_WINDOW = 2_000_000n;
export const PUBLIC_HISTORY_DISPLAY_LIMIT = 20;
export const PUBLIC_HISTORY_MAX_LOGS = 256;
const TOPIC_ADDRESS = /^0x0{24}[a-fA-F0-9]{40}$/;
const WORD = /^0x[a-fA-F0-9]{64}$/;
const QUANTITY = /^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/;
const SAFE_NONCE = '0x' + '0'.repeat(63) + '1';

function blockNumber(value, name) {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) throw new Error(name + ' is unsafe.');
  const b = typeof value === 'bigint' ? value : BigInt(value);
  if (b < 0n) throw new Error(name + ' cannot be negative.');
  return b;
}

export function incomingWifFilter(recipient, fromBlock, toBlock) {
  if (!isAddress(recipient)) throw new Error('Enter a valid recipient address.');
  if (/^0x0{40}$/i.test(recipient)) throw new Error('Zero address is not a recipient.');
  const from = blockNumber(fromBlock, 'Starting block');
  const to = blockNumber(toBlock, 'Ending block');
  if (from > to || to - from + 1n > PUBLIC_HISTORY_BLOCK_WINDOW) throw new Error('Public WIF history range is too wide.');
  return {
    address: WIF_TOKEN,
    fromBlock: '0x' + from.toString(16), toBlock: '0x' + to.toString(16),
    topics: [TRANSFER_TOPIC, null, '0x' + recipient.slice(2).toLowerCase().padStart(64, '0')]
  };
}

export function parseIncomingWifEvent(log, recipient) {
  if (!isAddress(recipient) || !log || typeof log !== 'object' || log.removed === true) throw new Error('Incoming WIF event is invalid.');
  if (!sameAddress(log.address, WIF_TOKEN)) throw new Error('Transfer event is not from the official WIF token.');
  if (!Array.isArray(log.topics) || log.topics.length !== 3 || log.topics[0]?.toLowerCase() !== TRANSFER_TOPIC.toLowerCase()) {
    throw new Error('Transfer event signature is invalid.');
  }
  if (!TOPIC_ADDRESS.test(log.topics[1] || '') || !TOPIC_ADDRESS.test(log.topics[2] || '')) throw new Error('Transfer indexed addresses are malformed.');
  const sender = '0x' + log.topics[1].slice(26);
  const destination = '0x' + log.topics[2].slice(26);
  if (!sameAddress(destination, recipient)) throw new Error('Transfer recipient is different.');
  if (!WORD.test(log.data || '')) throw new Error('Transfer amount is malformed.');
  const amount = BigInt(log.data);
  if (amount <= 0n) throw new Error('Zero-value transfers are not contributions.');
  if (!isHash(log.transactionHash) || !QUANTITY.test(log.blockNumber || '') || !QUANTITY.test(log.logIndex || '')) {
    throw new Error('Transfer transaction index is missing.');
  }
  return {
    hash: log.transactionHash, sender, recipient: destination, amount,
    blockNumber: BigInt(log.blockNumber), logIndex: BigInt(log.logIndex)
  };
}

export function verifyIncomingWifEvent({log, recipient, transaction, receipt, currentBlock}) {
  const event = parseIncomingWifEvent(log, recipient);
  // Synthetic request fields are used ONLY by the existing exact receipt
  // verifier. A transfer does not prove any signed BEFORE offer was involved.
  const request = {
    version: 1, recipient: event.recipient, token: WIF_TOKEN,
    chainId: WIF_MAINNET_CHAIN_ID, amount: event.amount,
    expiresAt: 1n, nonce: SAFE_NONCE
  };
  const proof = validateMinedTransfer({
    transaction, receipt, request, sender: event.sender, currentBlock, confirmations: 3
  });
  if (proof.hash.toLowerCase() !== event.hash.toLowerCase()) throw new Error('Transfer hash does not match receipt.');
  if (proof.log.logIndex !== undefined && BigInt(proof.log.logIndex) !== event.logIndex) {
    throw new Error('Transfer log index does not match receipt.');
  }
  return {...event, confirmations: proof.confirmations};
}

export function publicHistoryWindow(toBlock) {
  const to = blockNumber(toBlock, 'History block');
  const from = to + 1n > PUBLIC_HISTORY_BLOCK_WINDOW ? to + 1n - PUBLIC_HISTORY_BLOCK_WINDOW : 0n;
  return {from, to, olderTo: from === 0n ? null : from - 1n};
}
