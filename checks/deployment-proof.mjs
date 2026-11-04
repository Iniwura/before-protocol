import { isAddress, isTxHash, parseHexUint } from '../web/core.mjs';

export function normalizedBytecode(value) {
  if (typeof value !== 'string' || !/^0x(?:[0-9a-fA-F]{2})+$/.test(value))
    throw new Error('Invalid or missing deployed bytecode.');
  return value.toLowerCase();
}

/**
 * Verify a deployment from public-chain evidence against byte-for-byte Foundry output.
 * This proves deployed code identity, not contract security or an audit.
 */
export function attestContract({label,address,txHash,receipt,actualCode,artifactCode,headBlock,minConfirmations=12}) {
  if (!isAddress(address) || /^0x0{40}$/i.test(address)) throw new Error(label+': invalid contract address.');
  if (!isTxHash(txHash)) throw new Error(label+': invalid deployment transaction hash.');
  if (!receipt || receipt.status!=='0x1') throw new Error(label+': missing or unsuccessful deployment receipt.');
  if (receipt.transactionHash?.toLowerCase()!==txHash.toLowerCase()) throw new Error(label+': receipt hash does not match.');
  if (!receipt.contractAddress || receipt.contractAddress.toLowerCase()!==address.toLowerCase()) throw new Error(label+': receipt did not deploy this contract.');
  const height=typeof headBlock==='bigint'?headBlock:parseHexUint(headBlock);
  const mined=parseHexUint(receipt.blockNumber);
  if (mined > height) throw new Error(label+': receipt block exceeds chain head.');
  const confirmations=height-mined+1n;
  if (confirmations < BigInt(minConfirmations)) throw new Error(label+': deployment needs more confirmations.');
  if (normalizedBytecode(actualCode)!==normalizedBytecode(artifactCode)) throw new Error(label+': deployed runtime bytecode does not match compiled source.');
  return {address,txHash,confirmations:Number(confirmations)};
}

export function attestRuntime({label,address,actualCode,artifactCode}) {
  if (!isAddress(address) || /^0x0{40}$/i.test(address)) {
    throw new Error(label+': invalid contract address.');
  }
  if (normalizedBytecode(actualCode)!==normalizedBytecode(artifactCode)) {
    throw new Error(label+': deployed runtime bytecode does not match compiled source.');
  }
  return {address};
}

export function attestFactoryInteraction({
  label,
  txHash,
  transaction,
  receipt,
  factory,
  mockToken,
  selector,
  headBlock,
  minConfirmations=12,
}) {
  if (!isTxHash(txHash)) throw new Error(label+': invalid interaction transaction hash.');
  if (!transaction) throw new Error(label+': missing interaction transaction.');
  if (transaction.hash?.toLowerCase()!==txHash.toLowerCase()) throw new Error(label+': transaction hash does not match.');
  if (!isAddress(transaction.from)) throw new Error(label+': interaction sender is missing or malformed.');
  if (transaction.to?.toLowerCase()!==factory.toLowerCase()) throw new Error(label+': interaction did not target the configured factory.');
  const expectedInput=selector+mockToken.slice(2).toLowerCase().padStart(64,'0');
  if (transaction.input?.toLowerCase()!==expectedInput) throw new Error(label+': calldata does not match the expected factory method and mock token.');
  if (!receipt || receipt.status!=='0x1') throw new Error(label+': missing or unsuccessful interaction receipt.');
  if (receipt.transactionHash?.toLowerCase()!==txHash.toLowerCase()) throw new Error(label+': interaction receipt hash does not match.');
  if (receipt.to?.toLowerCase()!==factory.toLowerCase()) throw new Error(label+': interaction receipt target does not match the configured factory.');
  const height=typeof headBlock==='bigint'?headBlock:parseHexUint(headBlock);
  const mined=parseHexUint(receipt.blockNumber);
  if (mined > height) throw new Error(label+': receipt block exceeds chain head.');
  const confirmations=height-mined+1n;
  if (confirmations < BigInt(minConfirmations)) throw new Error(label+': interaction needs more confirmations.');
  return {label,txHash,from:transaction.from,confirmations:Number(confirmations)};
}
