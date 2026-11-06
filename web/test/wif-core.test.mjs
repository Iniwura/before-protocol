import test from 'node:test';
import assert from 'node:assert/strict';
import {WIF_MAINNET_CHAIN_ID,WIF_TOKEN,MAX_UINT256,isAddress,isHash,same,wordAddress,balanceData,
 allowanceData,readUint,decodeAddressWord,parseApprovalTransaction,formatWif,
 permissionSummary,formatRPCBlock} from '../wif-core.mjs';

const owner='0x'+'1'.repeat(40),spender='0x'+'2'.repeat(40),hash='0x'+'a'.repeat(64);
test('official WIF target and Robinhood mainnet are fixed',()=>{
 assert.equal(WIF_MAINNET_CHAIN_ID,4663);
 assert.equal(WIF_TOKEN.toLowerCase(),'0x5173b8ea6923c2d40267890d45c46a3480954773');
});
test('reject empty, malformed and zero addresses',()=>{
 assert.equal(isAddress(owner),true);
 assert.equal(isAddress('0x'+'0'.repeat(40)),false);
 assert.equal(isAddress('0x'+'1'.repeat(38)),false);
 assert.equal(isHash(hash),true);
 assert.equal(isHash(owner),false);
 assert.ok(same(spender,spender.toUpperCase().replace('0X','0x')));
});
test('ERC20 reads include exactly the intended owner and spender',()=>{
 assert.equal(balanceData(owner),'0x70a08231'+wordAddress(owner));
 assert.equal(allowanceData(owner,spender),'0xdd62ed3e'+wordAddress(owner)+wordAddress(spender));
 assert.throws(()=>wordAddress('0x'+'0'.repeat(40)),/nonzero/);
 assert.throws(()=>decodeAddressWord('f'.repeat(64)),/Malformed/);
});
test('approval transaction is verified against WIF, success and standard calldata',()=>{
 const tx={hash,from:owner,to:WIF_TOKEN,input:'0x095ea7b3'+wordAddress(spender)+(100n*10n**18n).toString(16).padStart(64,'0')};
 const receipt={transactionHash:hash,to:WIF_TOKEN,status:'0x1',blockNumber:'0x1111'};
 const parsed=parseApprovalTransaction(tx,receipt);
 assert.equal(parsed.spender,'0x'+'2'.repeat(40));
 assert.equal(parsed.approvedAmount,100n*10n**18n);
 assert.equal(parsed.approvalBlock,4369);
 assert.throws(()=>parseApprovalTransaction({...tx,to:spender},receipt),/not a confirmed/);
 assert.throws(()=>parseApprovalTransaction({...tx,input:'0x095ea7b3'},receipt),/not a confirmed/);
 assert.throws(()=>parseApprovalTransaction(tx,{...receipt,status:'0x0'}),/not a confirmed/);
 assert.throws(()=>parseApprovalTransaction(tx,{...receipt,transactionHash:'0x'+'b'.repeat(64)}),/not a confirmed/);
});
test('amount formatting never routes large BigInts through Number',()=>{
 assert.equal(formatWif(10n**18n),'1');
 assert.equal(formatWif(12345678000000000000n),'12.34567');
 assert.equal(formatWif(0n),'0');
 assert.equal(formatWif(1n),'<0.00001');
 assert.equal(readUint('0x'+'0'.repeat(63)+'a'),10n);
 assert.throws(()=>readUint('0x3'),/Malformed/);
});
test('permission labels distinguish zero, actual, excess and near-unlimited allowance',()=>{
 assert.match(permissionSummary(0n,0n).message,/this exact wallet and spender/);
 assert.equal(permissionSummary(10n,100n).level,'active');
 assert.equal(permissionSummary(101n,100n).level,'attention');
 assert.equal(permissionSummary(MAX_UINT256,100n).label,'Very large approval');
 assert.equal(formatRPCBlock('0x1237'),4663);
});
