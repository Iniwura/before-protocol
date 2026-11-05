import { isAddress, isTxHash, parseHexUint } from '../web/core.mjs';

export function normalizedBytecode(value) {
  if (typeof value !== 'string' || !/^0x(?:[0-9a-fA-F]{2})+$/.test(value))
    throw new Error('Invalid or missing deployed bytecode.');
  return value.toLowerCase();
}

function immutableGroups(immutableReferences) {
  if (immutableReferences === undefined || immutableReferences === null) return [];
  if (typeof immutableReferences !== 'object' || Array.isArray(immutableReferences)) {
    throw new Error('Invalid immutable reference metadata.');
  }
  return Object.entries(immutableReferences)
    .sort(([left], [right]) => Number(left) - Number(right))
    .map(([id, locations]) => {
      if (!Array.isArray(locations) || locations.length === 0) {
        throw new Error('Immutable reference '+id+' has no locations.');
      }
      return {id,locations:locations.map(location=>{
        if (!Number.isSafeInteger(location?.start)||!Number.isSafeInteger(location?.length)
          || location.start < 0 || location.length <= 0) {
          throw new Error('Immutable reference '+id+' has an invalid location.');
        }
        return location;
      })};
    });
}

function immutableWord(value, label) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(label+': expected one 32-byte immutable value.');
  }
  return value.slice(2).toLowerCase();
}

/**
 * Compare deployed runtime bytecode while accounting for Solidity's immutable
 * reference metadata. The compiler artifact contains zero placeholders in the
 * declared slots; those slots are checked against independently supplied,
 * constructor-derived values. Every byte outside those slots remains exact.
 */
export function attestImmutableRuntime({
  label,
  address,
  actualCode,
  artifactCode,
  immutableReferences,
  immutableValues=[],
}) {
  const actual=normalizedBytecode(actualCode);
  const artifact=normalizedBytecode(artifactCode);
  if (actual.length!==artifact.length) {
    throw new Error(label+': deployed runtime bytecode length does not match compiled source.');
  }
  const groups=immutableGroups(immutableReferences);
  if (groups.length!==immutableValues.length) {
    throw new Error(label+': immutable value count does not match compiler metadata.');
  }
  const covered=new Set();
  for (let index=0; index<groups.length; index+=1) {
    const expected=immutableWord(immutableValues[index],label+' immutable '+groups[index].id);
    for (const location of groups[index].locations) {
      const start=2+location.start*2;
      const end=start+location.length*2;
      if (end>actual.length) throw new Error(label+': immutable slot exceeds runtime bytecode.');
      const expectedSlice=expected.slice(0,location.length*2);
      if (expectedSlice.length!==location.length*2) {
        throw new Error(label+': immutable slot length is not a 32-byte value.');
      }
      if (actual.slice(start,end)!==expectedSlice) {
        throw new Error(label+': immutable value '+groups[index].id+' does not match expected constructor state.');
      }
      for (let byte=location.start; byte<location.start+location.length; byte+=1) covered.add(byte);
    }
  }
  for (let byte=0; byte<(actual.length-2)/2; byte+=1) {
    if (covered.has(byte)) continue;
    const start=2+byte*2;
    if (actual.slice(start,start+2)!==artifact.slice(start,start+2)) {
      throw new Error(label+': deployed runtime bytecode does not match compiled source outside immutable slots.');
    }
  }
  if (address!==undefined && (!isAddress(address)||/^0x0{40}$/i.test(address))) {
    throw new Error(label+': invalid contract address.');
  }
  return {address,immutableGroups:groups.length};
}

/**
 * Verify a deployment from public-chain evidence against byte-for-byte Foundry output.
 * This proves deployed code identity, not contract security or an audit.
 */
export function attestContract({label,address,txHash,receipt,transaction,actualCode,artifactCode,headBlock,minConfirmations=12}) {
  if (!isAddress(address) || /^0x0{40}$/i.test(address)) throw new Error(label+': invalid contract address.');
  if (!isTxHash(txHash)) throw new Error(label+': invalid deployment transaction hash.');
  if (!receipt || receipt.status!=='0x1') throw new Error(label+': missing or unsuccessful deployment receipt.');
  if (receipt.transactionHash?.toLowerCase()!==txHash.toLowerCase()) throw new Error(label+': receipt hash does not match.');
  if (!receipt.contractAddress || receipt.contractAddress.toLowerCase()!==address.toLowerCase()) throw new Error(label+': receipt did not deploy this contract.');
  if (transaction) {
    if (transaction.hash?.toLowerCase()!==txHash.toLowerCase()) throw new Error(label+': transaction hash does not match.');
    if (transaction.to!==null && transaction.to!==undefined) throw new Error(label+': deployment transaction targeted an existing contract.');
    if (transaction.value!==undefined && parseHexUint(transaction.value)!==0n) throw new Error(label+': deployment transaction sent native value.');
    if (receipt.from!==undefined && transaction.from!==undefined && receipt.from.toLowerCase()!==transaction.from.toLowerCase()) {
      throw new Error(label+': receipt sender does not match deployment transaction.');
    }
    if (receipt.blockHash!==undefined && transaction.blockHash!==undefined && receipt.blockHash.toLowerCase()!==transaction.blockHash.toLowerCase()) {
      throw new Error(label+': receipt block does not match deployment transaction.');
    }
  }
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
  if (transaction.value!==undefined && parseHexUint(transaction.value)!==0n) throw new Error(label+': factory interaction sent native value.');
  if (!receipt || receipt.status!=='0x1') throw new Error(label+': missing or unsuccessful interaction receipt.');
  if (receipt.transactionHash?.toLowerCase()!==txHash.toLowerCase()) throw new Error(label+': interaction receipt hash does not match.');
  if (receipt.to?.toLowerCase()!==factory.toLowerCase()) throw new Error(label+': interaction receipt target does not match the configured factory.');
  if (receipt.from!==undefined && transaction.from!==undefined && receipt.from.toLowerCase()!==transaction.from.toLowerCase()) throw new Error(label+': receipt sender does not match interaction transaction.');
  if (receipt.blockHash!==undefined && transaction.blockHash!==undefined && receipt.blockHash.toLowerCase()!==transaction.blockHash.toLowerCase()) throw new Error(label+': receipt block does not match interaction transaction.');
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

const TRANSFER_TOPIC='0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

export function attestTokenTransfers({label,receipt,token,transfers}) {
  const logs=Array.isArray(receipt?.logs)?receipt.logs:[];
  const matches=logs.filter(log=>log?.address?.toLowerCase()===token.toLowerCase()
    && Array.isArray(log.topics)
    && log.topics[0]?.toLowerCase()===TRANSFER_TOPIC);
  if (matches.length!==transfers.length) {
    throw new Error(label+': receipt does not contain exactly the expected token transfer count.');
  }
  const used=new Set();
  for (const expected of transfers) {
    const from='0x'+'0'.repeat(24)+expected.from.slice(2).toLowerCase();
    const to='0x'+'0'.repeat(24)+expected.to.slice(2).toLowerCase();
    const amount=typeof expected.amount==='string'?expected.amount.toLowerCase():('0x'+BigInt(expected.amount).toString(16).padStart(64,'0'));
    const match=matches.find((log,index)=>!used.has(index)
      && log.topics.length===3
      && log.topics[1]?.toLowerCase()===from
      && log.topics[2]?.toLowerCase()===to
      && log.data?.toLowerCase()===amount);
    if (!match) throw new Error(label+': receipt is missing an expected token transfer.');
    used.add(matches.indexOf(match));
  }
  return matches;
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
  if (transaction.value!==undefined && parseHexUint(transaction.value)!==0n) throw new Error(label+': interaction sent native value.');
  if (!receipt || receipt.status!==status) throw new Error(label+': missing or unexpected interaction receipt status.');
  if (receipt.transactionHash?.toLowerCase()!==txHash.toLowerCase()) throw new Error(label+': interaction receipt hash does not match.');
  if (receipt.to?.toLowerCase()!==to.toLowerCase()) throw new Error(label+': interaction receipt target does not match.');
  if (receipt.from!==undefined && transaction.from!==undefined && receipt.from.toLowerCase()!==transaction.from.toLowerCase()) throw new Error(label+': receipt sender does not match interaction transaction.');
  if (receipt.blockHash!==undefined && transaction.blockHash!==undefined && receipt.blockHash.toLowerCase()!==transaction.blockHash.toLowerCase()) throw new Error(label+': receipt block does not match interaction transaction.');
  const height=typeof headBlock==='bigint'?headBlock:parseHexUint(headBlock);
  const mined=parseHexUint(receipt.blockNumber);
  if (mined > height) throw new Error(label+': receipt block exceeds chain head.');
  const confirmations=height-mined+1n;
  if (confirmations < BigInt(minConfirmations)) throw new Error(label+': interaction needs more confirmations.');
  return {label,txHash,from:transaction.from,confirmations:Number(confirmations)};
}
