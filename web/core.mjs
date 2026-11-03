export const CHAIN_ID = 46630;
export const RPC_URL = 'https://rpc.testnet.chain.robinhood.com';
export const EXPLORER = 'https://explorer.testnet.chain.robinhood.com';

export function isAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(value).trim());
}
export function isTxHash(value) {
  return /^0x[a-fA-F0-9]{64}$/.test(String(value).trim());
}
export function parseWholeAmount(value) {
  const raw = String(value).trim();
  if (!/^(0|[1-9][0-9]*)$/.test(raw)) throw new Error('Enter a whole-token amount.');
  return BigInt(raw);
}
export function evaluateProtect({amount,spent,approved}) {
  const a = parseWholeAmount(amount);
  const s = parseWholeAmount(spent);
  if (a === 0n) return {kind:'blocked', reason:'Transfer amount must be greater than zero.', code:'ZeroAmount'};
  if (!approved) return {kind:'blocked',reason:'The destination is not approved.',code:'DestinationNotAllowed'};
  if (a > 60n) return {kind:'blocked',reason:'Transfer exceeds the 60-token limit.',code:'TransferTooLarge'};
  if (s + a > 100n) return {kind:'blocked',reason:'The daily 100-token allowance would be exceeded.',code:'DailyLimitExceeded'};
  return {kind:'allowed',reason:'The request satisfies both transfer limits and the destination rule.',remaining:String(100n-s-a)};
}
export function evaluateChallenge({first,second}) {
  const a=parseWholeAmount(first), b=parseWholeAmount(second);
  if (a===0n || b===0n || a>60n || b>60n) return {kind:'invalid',reason:'Each training transfer must be between 1 and 60 mock tokens.'};
  const total=a+b;
  return total>100n
    ? {kind:'bypass',total:String(total),reason:'Each individual transfer passes, but their combined amount breaks the intended daily limit.'}
    : {kind:'not-bypass',total:String(total),reason:'The combined amount does not exceed the intended 100-token daily limit.'};
}
export function parseHexUint(value) {
  if (!/^0x[0-9a-fA-F]+$/.test(String(value))) throw new Error('Malformed RPC number');
  return BigInt(value);
}
export function decodeAddress(value) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(String(value))) throw new Error('Malformed ABI address');
  const result='0x'+value.slice(-40);
  if (!isAddress(result)) throw new Error('Malformed ABI address');
  return result;
}
export function format18(value) {
  const n=typeof value==='bigint'?value:BigInt(value);
  const whole=n/10n**18n;
  const fraction=(n%10n**18n).toString().padStart(18,'0').replace(/0+$/,'');
  return whole+(fraction?'.'+fraction.slice(0,6):'');
}
