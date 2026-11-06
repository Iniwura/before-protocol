import test from 'node:test';
import assert from 'node:assert/strict';
import {extractBroadcastEvidence,verifierCommand} from '../script/broadcast-args.mjs';

const address=n=>'0x'+String(n).repeat(40);
const hash=n=>'0x'+String(n).repeat(64);
const payload={chainId:46630,transactions:[
  {transactionType:'CREATE',contractName:'MockERC20',contractAddress:address(1),hash:hash('a')},
  {transactionType:'CREATE',contractName:'BeforeFactory',contractAddress:address(2),hash:hash('b')},
  {transactionType:'CREATE',contractName:'WifSecurityChallenge',contractAddress:address(3),hash:hash('c')},
  {transactionType:'CALL',contractName:'BeforeFactory',function:'createDemoVault(address)',hash:hash('d')},
  {transactionType:'CALL',contractName:'BeforeFactory',function:'createPractice(address)',hash:hash('e')},
]};

test('broadcast evidence extracts public deployment and factory-call data',()=>{
  const evidence=extractBroadcastEvidence(payload);
  assert.equal(evidence.factory,address(2));
  assert.equal(evidence.mockTokenTx,hash('a'));
  assert.equal(evidence.challengeEscrowTx,hash('c'));
  assert.equal(evidence.demoTx,hash('d'));
  assert.equal(evidence.practiceTx,hash('e'));
  assert.match(verifierCommand(evidence),/node script\/verify-testnet\.mjs/);
});

test('broadcast evidence rejects unsupported chains and duplicate calls',()=>{
  assert.throws(()=>extractBroadcastEvidence({...payload,chainId:1}),/chain 31337 or Robinhood/);
  assert.throws(()=>extractBroadcastEvidence({...payload,transactions:[...payload.transactions,payload.transactions[3]]}),/createDemoVault/);
});

test('broadcast evidence rejects missing public fields',()=>{
  assert.throws(()=>extractBroadcastEvidence({...payload,transactions:payload.transactions.map(tx=>tx.contractName==='BeforeFactory'?{...tx,hash:null}:tx)}),/BeforeFactory: missing public transaction hash/);
});
