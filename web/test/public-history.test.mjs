import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PUBLIC_HISTORY_BLOCK_WINDOW, PUBLIC_HISTORY_DISPLAY_LIMIT,
  incomingWifFilter, parseIncomingWifEvent, verifyIncomingWifEvent, publicHistoryWindow
} from '../public-history.mjs';
import {WIF_TOKEN, WIF_MAINNET_CHAIN_ID, TRANSFER_TOPIC, transferData} from '../pay-core.mjs';

const recipient='0x02fb3352e593f4bcbff5a845e7a0f90ca4a87f0d';
const payer='0x11cbedbf9fcd723ce48fbd5a2b55e6e3699c3368';
const hash='0x'+'a'.repeat(64);
const amount=200n*10n**18n;
const topic=addr=>'0x'+addr.slice(2).toLowerCase().padStart(64,'0');
function fixture() {
  const log={
    address:WIF_TOKEN,topics:[TRANSFER_TOPIC,topic(payer),topic(recipient)],
    data:'0x'+amount.toString(16).padStart(64,'0'),transactionHash:hash,blockNumber:'0x64',
    logIndex:'0x0',removed:false
  };
  const request={version:1,recipient,token:WIF_TOKEN,chainId:WIF_MAINNET_CHAIN_ID,
    amount,expiresAt:1n,nonce:'0x'+'0'.repeat(63)+'1'};
  const transaction={
    hash,from:payer,to:WIF_TOKEN,input:transferData(request),value:'0x0',
    blockNumber:'0x64',blockHash:'0x'+'b'.repeat(64),transactionIndex:'0x0'
  };
  const receipt={
    transactionHash:hash,from:payer,to:WIF_TOKEN,status:'0x1',blockNumber:'0x64',
    blockHash:transaction.blockHash,transactionIndex:'0x0',logs:[log]
  };
  return {log,transaction,receipt};
}

test('read-only WIF history filter is bounded and recipient-specific',()=>{
  const f=incomingWifFilter(recipient,108000000n,109999999n);
  assert.equal(f.address,WIF_TOKEN);
  assert.equal(f.fromBlock,'0x'+(108000000n).toString(16));
  assert.equal(f.toBlock,'0x'+(109999999n).toString(16));
  assert.deepEqual(f.topics,[TRANSFER_TOPIC,null,topic(recipient)]);
  assert.equal(PUBLIC_HISTORY_BLOCK_WINDOW,2000000n);
  assert.equal(PUBLIC_HISTORY_DISPLAY_LIMIT,20);
  assert.throws(()=>incomingWifFilter(recipient,0n,2000000n),/wide/);
  assert.throws(()=>incomingWifFilter(recipient,2n,1n),/wide/);
  assert.throws(()=>incomingWifFilter('x',0,1),/recipient/);
  assert.throws(()=>incomingWifFilter('0x'+'0'.repeat(40),0,1),/Zero address/);
  assert.throws(()=>incomingWifFilter(recipient,0n,-1n),/negative/);
});

test('history windows can paginate into older blocks without overlapping',()=>{
  assert.deepEqual(publicHistoryWindow(1999999n),{from:0n,to:1999999n,olderTo:null});
  assert.deepEqual(publicHistoryWindow(2000010n),{from:11n,to:2000010n,olderTo:10n});
  const second=publicHistoryWindow(10n);
  assert.equal(second.from,0n);assert.equal(second.to,10n);assert.equal(second.olderTo,null);
});

test('public WIF history independently verifies direct transfer calldata and mined event',()=>{
  const f=fixture();
  const v=verifyIncomingWifEvent({...f,recipient,currentBlock:'0x66'});
  assert.equal(v.sender,payer);assert.equal(v.hash,hash);assert.equal(v.amount,amount);
  assert.equal(v.confirmations,3);
  assert.equal(v.logIndex,0n);
});

test('rejects forged or irrelevant incoming transfer logs and receipts',()=>{
  const f=fixture();
  const wrong=(log,transaction=f.transaction,receipt=f.receipt,head='0x66')=>
    assert.throws(()=>verifyIncomingWifEvent({log,transaction,receipt,recipient,currentBlock:head}));
  wrong({...f.log,address:payer});
  wrong({...f.log,topics:[TRANSFER_TOPIC,topic(payer),'0x'+'0'.repeat(64)]});
  wrong({...f.log,topics:[TRANSFER_TOPIC,topic(payer),topic(recipient),'0x0']});
  wrong({...f.log,topics:[TRANSFER_TOPIC,'0x'+'f'.repeat(64),topic(recipient)]});
  wrong({...f.log,removed:true});
  wrong({...f.log,transactionHash:'0x'+'c'.repeat(64)});
  wrong({...f.log,data:'0x'+'0'.repeat(64)});
  wrong({...f.log,data:'0x'+'g'.repeat(64)});
  wrong({...f.log,logIndex:'bad'});
  wrong(f.log,{...f.transaction,from:recipient});
  wrong(f.log,{...f.transaction,to:payer});
  wrong(f.log,{...f.transaction,input:'0x'});
  wrong(f.log,f.transaction,{...f.receipt,status:'0x0'});
  wrong(f.log,f.transaction,{...f.receipt,logs:[]});
  wrong(f.log,f.transaction,f.receipt,'0x65');
  wrong({...f.log,logIndex:'0x1'});
});

test('history parsed data is not signed campaign proof',()=>{
 const l=parseIncomingWifEvent(fixture().log,recipient);
 assert.deepEqual(Object.keys(l).sort(),['amount','blockNumber','hash','logIndex','recipient','sender'].sort());
 assert.ok(!('campaignId' in l));
 assert.ok(!('offer' in l));
 assert.ok(!('signedBy' in l));
});
