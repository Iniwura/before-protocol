// BEFORE Support's public-offer and repeat-cycle validation boundary.
// Support offers authenticate a recipient and a voluntary contribution plan;
// they never authorize spending. Every contribution is converted to the
// existing BEFORE Pay transfer/proof boundary for one fresh wallet action.

import {
  WIF_MAINNET_CHAIN_ID, WIF_TOKEN, WIF_RPC, WIF_EXPLORER, MAX_UINT256,
  ECRECOVER_PRECOMPILE, isAddress, isHash, sameAddress, keccakHex, utf8Bytes,
  parseTokenAmount, formatTokenAmount, transferData, buildPaymentTransaction,
  validateMinedTransfer, validateRecipientCode, decodeUintResult, decodeSymbolResult,
  explorerTransactionUrl
} from './pay-core.mjs';

export {
  WIF_MAINNET_CHAIN_ID, WIF_TOKEN, WIF_RPC, WIF_EXPLORER, isAddress, isHash,
  sameAddress, parseTokenAmount, formatTokenAmount, transferData,
  buildPaymentTransaction, validateMinedTransfer, validateRecipientCode,
  decodeUintResult, decodeSymbolResult, explorerTransactionUrl
};

export const SUPPORT_DOMAIN_NAME = 'BEFORE Support';
export const SUPPORT_DOMAIN_VERSION = '1';
export const SUPPORT_PAYLOAD_VERSION = 1;
export const SUPPORT_MAX_LIFETIME = 120n * 24n * 60n * 60n;
export const SUPPORT_INTERVALS = Object.freeze({
  weekly: Object.freeze({code: 1, label: 'Weekly suggestion', days: 7}),
  monthly: Object.freeze({code: 2, label: 'Monthly suggestion', days: 30}),
  anytime: Object.freeze({code: 0, label: 'Repeat when you choose', days: null})
});
export const SUPPORT_TYPE = 'SupportOffer(address recipient,address token,uint256 chainId,uint256 amount,uint8 interval,uint256 expiresAt,bytes32 campaignId)';

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const HASH = /^0x[0-9a-fA-F]{64}$/;
const SIGNATURE = /^0x[0-9a-fA-F]{130}$/;
const HALF_N = BigInt('0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0');
const DOMAIN_TYPE = 'EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)';
const DOMAIN_TYPE_HASH = keccakHex(utf8Bytes(DOMAIN_TYPE));
const SUPPORT_TYPE_HASH = keccakHex(utf8Bytes(SUPPORT_TYPE));

function wordAddress(value, label = 'address') {
  if (!isAddress(value)) throw new Error(`Invalid ${label}.`);
  return value.toLowerCase().slice(2).padStart(64, '0');
}
function wordUint(value, label = 'integer') {
  let number;
  try { number = typeof value === 'bigint' ? value : BigInt(value); } catch { throw new Error(`Invalid ${label}.`); }
  if (number < 0n || number > MAX_UINT256) throw new Error(`${label} is outside uint256 range.`);
  return number.toString(16).padStart(64, '0');
}
function wordBytes32(value, label = 'campaign ID') {
  if (typeof value !== 'string' || !HASH.test(value)) throw new Error(`Invalid ${label}.`);
  return value.slice(2).toLowerCase();
}
function hashText(value) { return keccakHex(utf8Bytes(value)).slice(2); }
function nowSeconds() { return BigInt(Math.floor(Date.now() / 1000)); }

export function intervalCode(interval) {
  if (typeof interval === 'number' && Number.isInteger(interval)) {
    const match = Object.entries(SUPPORT_INTERVALS).find(([, value]) => value.code === interval);
    if (match) return interval;
  }
  if (typeof interval === 'string' && SUPPORT_INTERVALS[interval]) return SUPPORT_INTERVALS[interval].code;
  throw new Error('Support cadence must be weekly, monthly or repeat when you choose.');
}
export function intervalKey(interval) {
  const code = intervalCode(interval);
  return Object.entries(SUPPORT_INTERVALS).find(([, value]) => value.code === code)?.[0];
}

export function normalizeSupportOffer(offer) {
  if (!offer || typeof offer !== 'object') throw new Error('Support offer is missing.');
  const recipient = offer.recipient;
  if (!isAddress(recipient) || /^0x0{40}$/i.test(recipient)) throw new Error('Support recipient is invalid.');
  if (sameAddress(recipient, WIF_TOKEN)) throw new Error('The WIF token contract cannot receive support.');
  if (!sameAddress(offer.token, WIF_TOKEN)) throw new Error('Support token is not the official WIF contract.');
  let chainId; let amount; let expiresAt;
  try {
    chainId = typeof offer.chainId === 'bigint' ? offer.chainId : BigInt(offer.chainId);
    amount = typeof offer.amount === 'bigint' ? offer.amount : BigInt(offer.amount);
    expiresAt = typeof offer.expiresAt === 'bigint' ? offer.expiresAt : BigInt(offer.expiresAt);
  } catch { throw new Error('Support offer numeric fields are invalid.'); }
  if (chainId !== WIF_MAINNET_CHAIN_ID) throw new Error('Support offer is not for Robinhood Chain mainnet.');
  if (amount <= 0n || amount > MAX_UINT256) throw new Error('Support amount must be a nonzero uint256.');
  if (expiresAt <= 0n || expiresAt > MAX_UINT256) throw new Error('Support offer expiry is invalid.');
  const campaignId = wordBytes32(offer.campaignId);
  if (/^0{64}$/i.test(campaignId)) throw new Error('Support campaign ID must be unpredictable and nonzero.');
  const cadence = intervalKey(offer.interval);
  return {
    version: SUPPORT_PAYLOAD_VERSION,
    recipient: recipient.toLowerCase(), token: WIF_TOKEN.toLowerCase(),
    chainId, amount, interval: cadence, expiresAt, campaignId: '0x' + campaignId
  };
}

export function validateSupportOffer(offer, now = nowSeconds()) {
  const normalized = normalizeSupportOffer(offer);
  if (normalized.expiresAt <= now) throw new Error('This support offer has expired.');
  if (normalized.expiresAt - now > SUPPORT_MAX_LIFETIME) throw new Error('Support offer expiry is outside the 120-day limit.');
  return normalized;
}

export function supportDomain() {
  return {name: SUPPORT_DOMAIN_NAME, version: SUPPORT_DOMAIN_VERSION, chainId: Number(WIF_MAINNET_CHAIN_ID), verifyingContract: WIF_TOKEN};
}

export function supportTypedDataFor(offer) {
  const normalized = normalizeSupportOffer(offer);
  return {
    types: {
      EIP712Domain: [
        {name: 'name', type: 'string'}, {name: 'version', type: 'string'},
        {name: 'chainId', type: 'uint256'}, {name: 'verifyingContract', type: 'address'}
      ],
      SupportOffer: [
        {name: 'recipient', type: 'address'}, {name: 'token', type: 'address'},
        {name: 'chainId', type: 'uint256'}, {name: 'amount', type: 'uint256'},
        {name: 'interval', type: 'uint8'}, {name: 'expiresAt', type: 'uint256'},
        {name: 'campaignId', type: 'bytes32'}
      ]
    },
    primaryType: 'SupportOffer', domain: supportDomain(),
    message: {
      recipient: normalized.recipient, token: normalized.token,
      chainId: Number(normalized.chainId), amount: normalized.amount.toString(),
      interval: intervalCode(normalized.interval), expiresAt: normalized.expiresAt.toString(),
      campaignId: normalized.campaignId
    }
  };
}

export function supportDomainSeparator() {
  return keccakHex('0x' + DOMAIN_TYPE_HASH.slice(2) + hashText(SUPPORT_DOMAIN_NAME)
    + hashText(SUPPORT_DOMAIN_VERSION) + wordUint(WIF_MAINNET_CHAIN_ID, 'chain ID')
    + wordAddress(WIF_TOKEN, 'token'));
}

export function supportStructHash(offer) {
  const normalized = normalizeSupportOffer(offer);
  return keccakHex('0x' + SUPPORT_TYPE_HASH.slice(2)
    + wordAddress(normalized.recipient, 'recipient') + wordAddress(normalized.token, 'token')
    + wordUint(normalized.chainId, 'chain ID') + wordUint(normalized.amount, 'amount')
    + wordUint(intervalCode(normalized.interval), 'interval') + wordUint(normalized.expiresAt, 'expiry')
    + wordBytes32(normalized.campaignId, 'campaign ID'));
}

export function supportDigest(offer) {
  return keccakHex('0x1901' + supportDomainSeparator().slice(2) + supportStructHash(offer).slice(2));
}

function parseSupportSignature(signature) {
  if (typeof signature !== 'string' || !SIGNATURE.test(signature)) throw new Error('Only a 65-byte ECDSA signature is accepted.');
  const r = signature.slice(2, 66).toLowerCase();
  const s = signature.slice(66, 130).toLowerCase();
  let v = Number.parseInt(signature.slice(130, 132), 16);
  if (v === 0 || v === 1) v += 27;
  if (v !== 27 && v !== 28) throw new Error('Signature recovery byte is invalid.');
  const rValue = BigInt('0x' + r); const sValue = BigInt('0x' + s);
  if (rValue <= 0n || rValue > MAX_UINT256 || sValue <= 0n || sValue > HALF_N) throw new Error('Signature scalar is invalid or malleable.');
  return {r, s, v};
}

function ecrecoverData(digest, signature) {
  if (!HASH.test(digest)) throw new Error('Support digest is invalid.');
  const {r, s, v} = parseSupportSignature(signature);
  return '0x' + digest.slice(2).toLowerCase() + wordUint(v, 'recovery byte') + r + s;
}

function decodeRecovered(result) {
  if (typeof result !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(result) || /^0x0{64}$/i.test(result)) throw new Error('Support signature recovery failed.');
  const address = '0x' + result.slice(-40);
  if (!isAddress(address)) throw new Error('Recovered support signer is invalid.');
  return address.toLowerCase();
}

export async function verifySupportSignature(offer, signature, rpcCall, {allowExpired = false} = {}) {
  const normalized = allowExpired ? normalizeSupportOffer(offer) : validateSupportOffer(offer);
  const recovered = decodeRecovered(await rpcCall('eth_call', [{to: ECRECOVER_PRECOMPILE, data: ecrecoverData(supportDigest(normalized), signature)}, 'latest']));
  if (!sameAddress(recovered, normalized.recipient)) throw new Error('Support signature does not authenticate the recipient.');
  return {offer: normalized, signer: recovered, digest: supportDigest(normalized)};
}

export function normalizeCycleId(cycleId) {
  const normalized = wordBytes32(cycleId, 'support cycle ID');
  if (/^0{64}$/i.test(normalized)) throw new Error('Support cycle ID must be unpredictable and nonzero.');
  return '0x' + normalized;
}

export function supportPaymentRequest(offer, cycleId) {
  const normalized = normalizeSupportOffer(offer);
  return {
    version: 1, recipient: normalized.recipient, token: normalized.token,
    chainId: normalized.chainId, amount: normalized.amount,
    expiresAt: normalized.expiresAt, nonce: normalizeCycleId(cycleId)
  };
}

export function encodeSupportPayload(offer, signature) {
  const normalized = normalizeSupportOffer(offer);
  parseSupportSignature(signature);
  const text = JSON.stringify({version: SUPPORT_PAYLOAD_VERSION, offer: {
    recipient: normalized.recipient, token: normalized.token, chainId: normalized.chainId.toString(),
    amount: normalized.amount.toString(), interval: normalized.interval,
    expiresAt: normalized.expiresAt.toString(), campaignId: normalized.campaignId
  }, signature});
  const bytes = utf8Bytes(text); let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function decodeSupportPayload(payload) {
  if (typeof payload !== 'string' || !/^[A-Za-z0-9_-]+$/.test(payload)) throw new Error('Support link payload is malformed.');
  try {
    const padded = payload.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - payload.length % 4) % 4);
    const binary = atob(padded);
    const text = new TextDecoder().decode(Uint8Array.from(binary, char => char.charCodeAt(0)));
    const value = JSON.parse(text);
    if (!value || value.version !== SUPPORT_PAYLOAD_VERSION || typeof value.signature !== 'string') throw new Error('Support link version or signature is invalid.');
    const offer = normalizeSupportOffer(value.offer);
    parseSupportSignature(value.signature);
    return {offer, signature: value.signature};
  } catch (error) {
    if (error?.message?.startsWith('Support link')) throw error;
    throw new Error('Support link payload is invalid.');
  }
}

export function isSupportIntervalDue(offer, previousTimestamp, now = nowSeconds()) {
  const normalized = normalizeSupportOffer(offer);
  if (normalized.interval === 'anytime') return false;
  const days = SUPPORT_INTERVALS[normalized.interval].days;
  return now >= BigInt(previousTimestamp) + BigInt(days) * 24n * 60n * 60n;
}

export function supportExplorerAddressUrl(address) {
  if (!isAddress(address)) throw new Error('Invalid address.');
  return WIF_EXPLORER + '/address/' + address;
}
