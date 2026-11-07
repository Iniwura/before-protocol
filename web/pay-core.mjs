// BEFORE Pay's pure validation and encoding boundary.
// This module never holds keys and never sends a transaction. Browser code
// supplies RPC/provider functions and is responsible for explicit user intent.

export const WIF_MAINNET_CHAIN_ID = 4663n;
export const WIF_TOKEN = '0x5173b8eA6923c2d40267890D45C46a3480954773';
export const WIF_RPC = 'https://rpc.mainnet.chain.robinhood.com';
export const WIF_EXPLORER = 'https://robinhoodchain.blockscout.com';
export const PAYMENT_DOMAIN_NAME = 'BEFORE Pay';
export const PAYMENT_DOMAIN_VERSION = '1';
export const PAYMENT_VERSION = 1;
export const PAYMENT_MAX_LIFETIME = 30n * 24n * 60n * 60n;
export const MAX_UINT256 = (1n << 256n) - 1n;
export const SECP256K1_HALF_N = BigInt('0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0');
export const ECRECOVER_PRECOMPILE = '0x0000000000000000000000000000000000000001';

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const HASH = /^0x[0-9a-fA-F]{64}$/;
const WORD = /^[0-9a-fA-F]{64}$/;
const HEX = /^[0-9a-fA-F]*$/;

// Keccak-256 is the hash used by the EVM (not NIST SHA3-256). It is used only
// for EIP-712 encoding and event topics; secp256k1 recovery is delegated to
// the chain's standard ecrecover precompile below.
const MASK_64 = (1n << 64n) - 1n;
const ROUND_CONSTANTS = [
  0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
  0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
  0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
  0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
  0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
  0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n
];
const ROTATION = [
  [0, 36, 3, 41, 18],
  [1, 44, 10, 45, 2],
  [62, 6, 43, 15, 61],
  [28, 55, 25, 21, 56],
  [27, 20, 39, 8, 14]
];

function rotl64(value, shift) {
  if (shift === 0) return value & MASK_64;
  return ((value << BigInt(shift)) | (value >> BigInt(64 - shift))) & MASK_64;
}

function keccakF(state) {
  for (const round of ROUND_CONSTANTS) {
    const c = new Array(5).fill(0n);
    for (let x = 0; x < 5; x++) {
      c[x] = state[x] ^ state[x + 5] ^ state[x + 10] ^ state[x + 15] ^ state[x + 20];
    }
    const d = new Array(5);
    for (let x = 0; x < 5; x++) d[x] = c[(x + 4) % 5] ^ rotl64(c[(x + 1) % 5], 1);
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) state[x + 5 * y] = (state[x + 5 * y] ^ d[x]) & MASK_64;
    }

    const b = new Array(25).fill(0n);
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        b[y + 5 * ((2 * x + 3 * y) % 5)] = rotl64(state[x + 5 * y], ROTATION[x][y]);
      }
    }
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        state[x + 5 * y] = (b[x + 5 * y]
          ^ ((~b[(x + 1) % 5 + 5 * y]) & b[(x + 2) % 5 + 5 * y])) & MASK_64;
      }
    }
    state[0] = (state[0] ^ round) & MASK_64;
  }
}

export function utf8Bytes(value) {
  return new TextEncoder().encode(String(value));
}

function hexBytes(hex) {
  if (typeof hex !== 'string' || !hex.startsWith('0x') || hex.length % 2 !== 0 || !HEX.test(hex.slice(2))) {
    throw new Error('Malformed hexadecimal data.');
  }
  const body = hex.slice(2);
  const bytes = new Uint8Array(body.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = Number.parseInt(body.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

function concatBytes(...parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}

export function bytesToHex(bytes) {
  return '0x' + Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

export function keccakHex(input) {
  const bytes = typeof input === 'string' ? hexBytes(input) : input;
  const rate = 136;
  const paddedLength = Math.ceil((bytes.length + 1) / rate) * rate;
  const padded = new Uint8Array(paddedLength || rate);
  padded.set(bytes);
  padded[bytes.length] = 0x01;
  padded[padded.length - 1] |= 0x80;
  const state = new Array(25).fill(0n);
  for (let offset = 0; offset < padded.length; offset += rate) {
    for (let lane = 0; lane < rate / 8; lane++) {
      let word = 0n;
      for (let byte = 0; byte < 8; byte++) word |= BigInt(padded[offset + lane * 8 + byte]) << BigInt(byte * 8);
      state[lane] = (state[lane] ^ word) & MASK_64;
    }
    keccakF(state);
  }
  const output = new Uint8Array(32);
  for (let i = 0; i < output.length; i++) output[i] = Number((state[Math.floor(i / 8)] >> BigInt((i % 8) * 8)) & 0xffn);
  return bytesToHex(output);
}

export const TRANSFER_TOPIC = keccakHex(utf8Bytes('Transfer(address,address,uint256)'));

export function isAddress(value) {
  return typeof value === 'string' && ADDRESS.test(value) && !/^0x0{40}$/i.test(value);
}

export function isHash(value) { return typeof value === 'string' && HASH.test(value); }
export function sameAddress(a, b) { return isAddress(a) && isAddress(b) && a.toLowerCase() === b.toLowerCase(); }
export function sameHash(a, b) { return isHash(a) && isHash(b) && a.toLowerCase() === b.toLowerCase(); }

function normalizeAddress(value, label = 'address') {
  if (!isAddress(value)) throw new Error(`Invalid ${label}.`);
  return value.toLowerCase();
}

function validateRecipientAddress(value) {
  const normalized = normalizeAddress(value, 'recipient');
  const numeric = BigInt('0x' + normalized.slice(2));
  if (numeric <= 9n) throw new Error('Reserved EVM precompile addresses cannot receive payments.');
  if (sameAddress(normalized, WIF_TOKEN)) throw new Error('The token contract cannot receive payments.');
  return normalized;
}

function wordAddress(value, label = 'address') { return normalizeAddress(value, label).slice(2).padStart(64, '0'); }
function wordUint(value, label = 'integer') {
  let number;
  try { number = typeof value === 'bigint' ? value : BigInt(value); } catch { throw new Error(`Invalid ${label}.`); }
  if (number < 0n || number > MAX_UINT256) throw new Error(`${label} is outside uint256 range.`);
  return number.toString(16).padStart(64, '0');
}
function wordBytes32(value, label = 'nonce') {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error(`Invalid ${label}.`);
  return value.slice(2).toLowerCase();
}
function hashText(value) { return keccakHex(utf8Bytes(value)).slice(2); }

export const DOMAIN_TYPE = 'EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)';
export const REQUEST_TYPE = 'PaymentRequest(address recipient,address token,uint256 chainId,uint256 amount,uint256 expiresAt,bytes32 nonce)';
export const DOMAIN_TYPE_HASH = keccakHex(utf8Bytes(DOMAIN_TYPE));
export const REQUEST_TYPE_HASH = keccakHex(utf8Bytes(REQUEST_TYPE));

export function paymentDomain() {
  return {name: PAYMENT_DOMAIN_NAME, version: PAYMENT_DOMAIN_VERSION, chainId: Number(WIF_MAINNET_CHAIN_ID), verifyingContract: WIF_TOKEN};
}

export function typedDataFor(request) {
  const normalized = normalizeRequest(request);
  return {
    types: {
      EIP712Domain: [
        {name: 'name', type: 'string'}, {name: 'version', type: 'string'},
        {name: 'chainId', type: 'uint256'}, {name: 'verifyingContract', type: 'address'}
      ],
      PaymentRequest: [
        {name: 'recipient', type: 'address'}, {name: 'token', type: 'address'},
        {name: 'chainId', type: 'uint256'}, {name: 'amount', type: 'uint256'},
        {name: 'expiresAt', type: 'uint256'}, {name: 'nonce', type: 'bytes32'}
      ]
    },
    primaryType: 'PaymentRequest',
    domain: paymentDomain(),
    message: {
      recipient: normalized.recipient,
      token: normalized.token,
      chainId: Number(normalized.chainId),
      amount: normalized.amount.toString(),
      expiresAt: normalized.expiresAt.toString(),
      nonce: normalized.nonce
    }
  };
}

export function normalizeRequest(request) {
  if (!request || typeof request !== 'object') throw new Error('Payment request is missing.');
  const recipient = validateRecipientAddress(request.recipient);
  const token = normalizeAddress(request.token, 'token');
  const chainId = typeof request.chainId === 'bigint' ? request.chainId : BigInt(request.chainId);
  const amount = typeof request.amount === 'bigint' ? request.amount : BigInt(request.amount);
  const expiresAt = typeof request.expiresAt === 'bigint' ? request.expiresAt : BigInt(request.expiresAt);
  const nonce = wordBytes32(request.nonce);
  if (!sameAddress(token, WIF_TOKEN)) throw new Error('Request token is not the official WIF contract.');
  if (chainId !== WIF_MAINNET_CHAIN_ID) throw new Error('Request is not for Robinhood Chain mainnet.');
  if (amount <= 0n || amount > MAX_UINT256) throw new Error('Payment amount must be a nonzero uint256.');
  if (expiresAt <= 0n || expiresAt > MAX_UINT256) throw new Error('Request expiry is invalid.');
  if (/^0{64}$/i.test(nonce)) throw new Error('Request nonce must be unpredictable and nonzero.');
  return {version: PAYMENT_VERSION, recipient, token, chainId, amount, expiresAt, nonce: '0x' + nonce};
}

export function domainSeparator() {
  return keccakHex('0x' + DOMAIN_TYPE_HASH.slice(2) + hashText(PAYMENT_DOMAIN_NAME) + hashText(PAYMENT_DOMAIN_VERSION)
    + wordUint(WIF_MAINNET_CHAIN_ID, 'chain ID') + wordAddress(WIF_TOKEN, 'token'));
}

export function requestStructHash(request) {
  const normalized = normalizeRequest(request);
  return keccakHex('0x' + REQUEST_TYPE_HASH.slice(2) + wordAddress(normalized.recipient, 'recipient')
    + wordAddress(normalized.token, 'token') + wordUint(normalized.chainId, 'chain ID')
    + wordUint(normalized.amount, 'amount') + wordUint(normalized.expiresAt, 'expiry')
    + wordBytes32(normalized.nonce));
}

export function requestDigest(request) {
  return keccakHex('0x1901' + domainSeparator().slice(2) + requestStructHash(request).slice(2));
}

export function parseTokenAmount(value) {
  const raw = String(value ?? '');
  if (!/^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,18})?$/.test(raw)) throw new Error('Enter an amount with up to 18 decimals.');
  const [whole, fraction = ''] = raw.split('.');
  const amount = BigInt(whole) * 10n ** 18n + BigInt((fraction + '0'.repeat(18)).slice(0, 18));
  if (amount <= 0n || amount > MAX_UINT256) throw new Error('Amount must be greater than zero and fit uint256.');
  return amount;
}

export function formatTokenAmount(amount) {
  const value = typeof amount === 'bigint' ? amount : BigInt(amount);
  const whole = value / 10n ** 18n;
  const fraction = (value % 10n ** 18n).toString().padStart(18, '0').replace(/0+$/, '');
  return whole.toString() + (fraction ? '.' + fraction : '');
}

export function validateRequest(request, nowSeconds = BigInt(Math.floor(Date.now() / 1000))) {
  const normalized = normalizeRequest(request);
  if (normalized.expiresAt <= nowSeconds) throw new Error('This payment request has expired.');
  if (normalized.expiresAt - nowSeconds > PAYMENT_MAX_LIFETIME) throw new Error('Request expiry is outside the 30-day limit.');
  return normalized;
}

export function parseSignature(signature) {
  if (typeof signature !== 'string' || !/^0x[0-9a-fA-F]{130}$/.test(signature)) throw new Error('Only a 65-byte ECDSA signature is accepted.');
  const r = signature.slice(2, 66).toLowerCase();
  const s = signature.slice(66, 130).toLowerCase();
  let v = Number.parseInt(signature.slice(130, 132), 16);
  if (v === 0 || v === 1) v += 27;
  if (v !== 27 && v !== 28) throw new Error('Signature recovery byte is invalid.');
  const rValue = BigInt('0x' + r); const sValue = BigInt('0x' + s);
  if (rValue <= 0n || rValue > MAX_UINT256 || sValue <= 0n || sValue > SECP256K1_HALF_N) throw new Error('Signature scalar is invalid or malleable.');
  return {r, s, v};
}

export function ecrecoverCallData(digest, signature) {
  if (typeof digest !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(digest)) throw new Error('Invalid EIP-712 digest.');
  const {r, s, v} = parseSignature(signature);
  return '0x' + digest.slice(2).toLowerCase() + wordUint(v, 'recovery byte') + r + s;
}

export function decodeRecoveredAddress(result) {
  if (typeof result !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(result) || /^0x0{64}$/i.test(result)) throw new Error('Signature recovery failed.');
  const address = '0x' + result.slice(-40);
  if (!isAddress(address)) throw new Error('Recovered signer is invalid.');
  return address.toLowerCase();
}

export async function verifyRequestSignature(request, signature, rpcCall, {allowExpired = false} = {}) {
  const normalized = allowExpired ? normalizeRequest(request) : validateRequest(request);
  const recovered = decodeRecoveredAddress(await rpcCall('eth_call', [{to: ECRECOVER_PRECOMPILE, data: ecrecoverCallData(requestDigest(normalized), signature)}, 'latest']));
  if (!sameAddress(recovered, normalized.recipient)) throw new Error('Request signature does not authenticate the recipient.');
  return {request: normalized, signer: recovered, digest: requestDigest(normalized)};
}

export function transferData(request) {
  const normalized = normalizeRequest(request);
  return '0xa9059cbb' + wordAddress(normalized.recipient, 'recipient') + wordUint(normalized.amount, 'amount');
}

export function validateTransferData(data, request) {
  if (typeof data !== 'string' || !/^0xa9059cbb[0-9a-fA-F]{128}$/.test(data)) throw new Error('Transaction calldata is not the exact WIF transfer call.');
  if (data.toLowerCase() !== transferData(request).toLowerCase()) throw new Error('Transaction calldata does not match this request.');
  return true;
}

export function validateRecipientCode(code) {
  if (typeof code !== 'string' || !/^0x[0-9a-fA-F]*$/.test(code)) throw new Error('Recipient code response is malformed.');
  if (code !== '0x') throw new Error('Smart-contract recipients are unsupported; EIP-1271 is not silently trusted.');
  return true;
}

export function decodeUintResult(result, label = 'RPC integer') {
  if (typeof result !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(result)) throw new Error(`${label} response is malformed.`);
  return BigInt(result);
}

export function decodeSymbolResult(result) {
  if (typeof result !== 'string' || !/^0x[0-9a-fA-F]+$/.test(result)) throw new Error('WIF symbol response is malformed.');
  const body = result.slice(2);
  if (body.length === 192 && body.slice(0, 64) === '0'.repeat(62) + '20' && body.slice(64, 128) === '0'.repeat(62) + '03' && body.slice(128, 134).toLowerCase() === '574946') return 'WIF';
  if (body.length === 64 && body.slice(0, 6).toLowerCase() === '574946') return 'WIF';
  throw new Error('Official token metadata did not report WIF.');
}

export function buildPaymentTransaction(sender, request, gasLimit) {
  if (!isAddress(sender)) throw new Error('Payer wallet is invalid.');
  validateRequest(request);
  const tx = {from: sender, to: WIF_TOKEN, data: transferData(request), value: '0x0'};
  if (gasLimit !== undefined) tx.gas = typeof gasLimit === 'string' ? gasLimit : '0x' + BigInt(gasLimit).toString(16);
  return tx;
}

export function validateMinedTransfer({transaction, receipt, request, sender, currentBlock, confirmations = 3}) {
  const normalized = normalizeRequest(request);
  if (!transaction || !receipt || !sameHash(transaction.hash, receipt.transactionHash)) throw new Error('Receipt and transaction identity do not match.');
  if (!sameAddress(transaction.from, sender) || !sameAddress(receipt.from, sender)) throw new Error('Mined transaction sender does not match the payer.');
  if (!sameAddress(transaction.to, WIF_TOKEN) || !sameAddress(receipt.to, WIF_TOKEN)) throw new Error('Mined transaction destination is not the official WIF token.');
  if (transaction.value !== undefined && BigInt(transaction.value) !== 0n) throw new Error('Mined transaction moved native value.');
  validateTransferData(transaction.input, normalized);
  if (receipt.status !== '0x1') throw new Error('The WIF transfer receipt reports failure.');
  if (!/^0x[0-9a-fA-F]+$/.test(receipt.blockNumber ?? '')) throw new Error('Receipt block is missing.');
  const receiptBlock = BigInt(receipt.blockNumber);
  const head = BigInt(currentBlock);
  if (head + 1n < receiptBlock + BigInt(confirmations)) throw new Error(`Waiting for ${confirmations} confirmations.`);
  const expectedFrom = '0x' + wordAddress(sender);
  const expectedTo = '0x' + wordAddress(normalized.recipient);
  const expectedAmount = '0x' + wordUint(normalized.amount);
  const matchingLogs = (receipt.logs ?? []).filter(log => sameAddress(log.address, WIF_TOKEN)
    && Array.isArray(log.topics) && log.topics.length === 3
    && typeof log.topics[0] === 'string' && log.topics[0].toLowerCase() === TRANSFER_TOPIC.toLowerCase()
    && log.topics[1]?.toLowerCase() === expectedFrom.toLowerCase()
    && log.topics[2]?.toLowerCase() === expectedTo.toLowerCase()
    && typeof log.data === 'string' && log.data.toLowerCase() === expectedAmount.toLowerCase());
  if (matchingLogs.length !== 1) throw new Error('The receipt does not contain exactly one matching WIF Transfer event.');
  return {hash: transaction.hash, blockNumber: receipt.blockNumber, confirmations: Number(head - receiptBlock + 1n), log: matchingLogs[0]};
}

function base64UrlEncode(text) {
  const bytes = utf8Bytes(text);
  let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function base64UrlDecode(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Shared request payload is malformed.');
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  const binary = atob(padded); const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeSharePayload(request, signature) {
  const normalized = normalizeRequest(request);
  parseSignature(signature);
  return base64UrlEncode(JSON.stringify({version: PAYMENT_VERSION, request: {
    recipient: normalized.recipient, token: normalized.token, chainId: normalized.chainId.toString(),
    amount: normalized.amount.toString(), expiresAt: normalized.expiresAt.toString(), nonce: normalized.nonce
  }, signature}));
}

export function decodeSharePayload(payload) {
  let value;
  try { value = JSON.parse(base64UrlDecode(payload)); } catch { throw new Error('Shared request payload is invalid.'); }
  if (!value || value.version !== PAYMENT_VERSION || typeof value.signature !== 'string') throw new Error('Shared request version or signature is invalid.');
  const request = normalizeRequest(value.request);
  parseSignature(value.signature);
  return {request, signature: value.signature};
}

export function explorerTransactionUrl(hash) { if (!isHash(hash)) throw new Error('Invalid transaction hash.'); return WIF_EXPLORER + '/tx/' + hash; }
