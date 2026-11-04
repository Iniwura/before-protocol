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

export function attestEvent({label,receipt,address,eventTopic,indexedAddresses={}}) {
  const logs=Array.isArray(receipt?.logs)?receipt.logs:[];
  const matches=logs.filter(log=>{
    if (log?.address?.toLowerCase()!==address.toLowerCase()) return false;
    if (!Array.isArray(log.topics)||log.topics[0]?.toLowerCase()!==eventTopic.toLowerCase()) return false;
    return Object.entries(indexedAddresses).every(([index,address])=>
      log.topics[Number(index)]?.toLowerCase()===('0x'+'0'.repeat(24)+address.slice(2).toLowerCase())
    );
  });
  if (matches.length!==1) throw new Error(label+': receipt does not contain exactly one matching factory event.');
  return matches[0];
}

export function attestFactoryEvent({label,receipt,factory,eventTopic,indexedAddresses={}}) {
  return attestEvent({label,receipt,address:factory,eventTopic,indexedAddresses});
}

export function attestCall({
  label,
  txHash,
  transaction,
  receipt,
  to,
  from,
  input,
  headBlock,
  status='0x1',
  minConfirmations=12,
}) {
  if (!isTxHash(txHash)) throw new Error(label+': invalid interaction transaction hash.');
  if (!transaction) throw new Error(label+': missing interaction transaction.');
  if (transaction.hash?.toLowerCase()!==txHash.toLowerCase()) throw new Error(label+': transaction hash does not match.');
  if (!isAddress(transaction.from)) throw new Error(label+': interaction sender is missing or malformed.');
  if (from && transaction.from.toLowerCase()!==from.toLowerCase()) throw new Error(label+': interaction sender does not match the expected wallet.');
  if (transaction.to?.toLowerCase()!==to.toLowerCase()) throw new Error(label+': interaction target does not match.');
  if (transaction.input?.toLowerCase()!==input.toLowerCase()) throw new Error(label+': calldata does not match the expected user flow.');
  if (!receipt || receipt.status!==status) throw new Error(label+': missing or unexpected interaction receipt status.');
  if (receipt.transactionHash?.toLowerCase()!==txHash.toLowerCase()) throw new Error(label+': interaction receipt hash does not match.');
  if (receipt.to?.toLowerCase()!==to.toLowerCase()) throw new Error(label+': interaction receipt target does not match.');
  const height=typeof headBlock==='bigint'?headBlock:parseHexUint(headBlock);
  const mined=parseHexUint(receipt.blockNumber);
  if (mined > height) throw new Error(label+': receipt block exceeds chain head.');
  const confirmations=height-mined+1n;
  if (confirmations < BigInt(minConfirmations)) throw new Error(label+': interaction needs more confirmations.');
  return {label,txHash,from:transaction.from,confirmations:Number(confirmations)};
}
