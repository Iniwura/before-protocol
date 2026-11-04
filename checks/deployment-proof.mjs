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
