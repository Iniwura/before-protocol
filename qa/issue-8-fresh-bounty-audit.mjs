#!/usr/bin/env node
// Read-only audit of the fresh three-wallet BTEST acceptance run on Robinhood
// Chain Testnet. No keystore, password or signing capability is used here.
import {readFile} from 'node:fs/promises';
import {encodeCall,word,parseChallenge,eventChallengeId,keccak256,UNIT} from '../web/bounty-core.mjs';

const rpc='https://rpc.testnet.chain.robinhood.com';
const explorer='https://explorer.testnet.chain.robinhood.com';
const A={
  sponsor:'0xd1061825504b30f404c0d94b745205925f251f2c',
  researcher:'0x86923864B7a7C7CfA1A56398DA6cA2a622756989',
  reviewer:'0xC7E69617ED81A0a7dD0cD74f82B176E22555097F',
  escrow:'0xF9d644dd2024E2dFc425aA7c1059F9b4E720684a',
  token:'0xf080A1a012F2Dd41c4F416Befd6D70074af75A4C',
  target:'0x7e29bC6Df38e60E77513bc1084dB488FeE12947c',
  gate:'0x375798eab2f3becd8cba137659b8f8ed028d2d46',
  oldGate:'0x1391916cc9012ece416f682227d99373f1631eaa',
  oldSponsor:'0xa35dc047f9937bf668743efbdf8ea93b31a55888'
};
const H={
  fundResearcher:'0x03bc9186fea303c929eb3d3d3afb642ed24c7740d0c4ab395e85852172036e7b',
  fundReviewer:'0x5f3be57e953de09f6e07132cb7aab6c62faa36ec7a95735ca10dca6e637db8bf',
  gateDeploy:'0xcbbc2181ee5a4523a5f70b884268fa1cb2d4286c4cb934e1aa981c4c61da8912',
  sponsorMint:'0xb96217814cd1336b56d7d1afbcad01bc2c58db0996f60a2ca068699eab9a06ed',
  sponsorApproveSetup:'0x0bb40a67b4a78da432bf241155752e268f516701bcc7b94d70a42a9e2eacdec4',
  abandonedCreate:'0xc3cf4c65c5fb0e48a7c03e6e85fa13b1b8a9f9ddb22f02e425df2288f9b3925f',
  abandonedRefund:'0x546323d0cbf985603b11f3a6df4e4a3775f17ba7268ade4b2759a181e0a312a5',
  sponsorApprove:'0x314d7cfc967ed6a312054a59477d2f8d13cd42bdbf0e7364df91717784c0dece',
  create:'0x5b54ab0f8db383cde66ff40a59ab7b926090d17f1854183a88ca2486b288a9a1',
  researcherMint:'0x981fbe416c915e100b2bc3fc81ed966cf5ee7aa27c85dcbfe89ae18ca624cd19',
  researcherApprove:'0x33ad8be9608f16394e0aa13ac74f71c77cce88fb44c97f1745c288cddf1e2b89',
  commit:'0x4a00d1d9133670b738571823ee9e93d0dc861f938fcf832c1cbe121a4ab0ddd3',
  review:'0x7682cbf90feac893c20cae875d4c1b8b216eae8a4faca813c2f31b505fab6bec',
  reveal:'0x17ecb3839f4c249fa1ca7c0283a191675d6f38256a498afda83059ec21750f5c',
  bounty5Create:'0x9009a56b0c5009482e80ba3b39c91a25c39125a76210b81054dc5aea2863e3c8'
};
for(const [name,hash] of Object.entries(H))if(!/^0x[0-9a-fA-F]{64}$/.test(hash))throw Error(`Malformed ${name} hash.`);

async function rpcCall(method,params=[]){
  const response=await fetch(rpc,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
  const body=await response.json();
  if(body.error)throw Error(body.error.message);
  return body.result;
}
const topic=signature=>keccak256(new TextEncoder().encode(signature)).toLowerCase();
const hex=value=>BigInt(value);
const fail=(condition,message)=>{if(!condition)throw Error(message)};
async function receipt(hash){const value=await rpcCall('eth_getTransactionReceipt',[hash]);fail(value?.status==='0x1',`receipt failed: ${hash}`);return value;}
async function transaction(hash){const value=await rpcCall('eth_getTransactionByHash',[hash]);fail(value,`transaction missing: ${hash}`);return value;}
async function read(to,signature,args=[],block='latest'){return rpcCall('eth_call',[{to,data:encodeCall(signature,args)},block]);}
async function balance(address,block='latest'){return hex(await read(A.token,'balanceOf(address)',['0'.repeat(24)+address.slice(2).toLowerCase()],block));}
function event(receipt,address,signature){const matches=(receipt.logs||[]).filter(log=>log.address?.toLowerCase()===address.toLowerCase()&&log.topics?.[0]?.toLowerCase()===topic(signature));fail(matches.length===1,`event count: ${signature}`);return matches[0];}
function addressTopic(address){return ('0x'+address.slice(2).padStart(64,'0')).toLowerCase();}
function normalizeRuntime(code,immutableRefs){let value=code.toLowerCase();for(const ref of immutableRefs){const start=2+ref.start*2,end=start+ref.length*2;value=value.slice(0,start)+'0'.repeat(ref.length*2)+value.slice(end)}return value;}
const transferTopic=topic('Transfer(address,address,uint256)');
function transfer(receipt,from,to,amount,label){
  const matches=(receipt.logs||[]).filter(log=>log.address?.toLowerCase()===A.token.toLowerCase()&&log.topics?.[0]?.toLowerCase()===transferTopic&&log.topics?.[1]?.toLowerCase()===addressTopic(from)&&log.topics?.[2]?.toLowerCase()===addressTopic(to)&&hex(log.data)===amount);
  fail(matches.length===1,`token accounting transfer: ${label}`);
}

const chainId=Number(hex(await rpcCall('eth_chainId',[])));fail(chainId===46630,'wrong chain ID');
const verifierManifest=JSON.parse(await readFile(new URL('../web/bounty-verifier.json',import.meta.url),'utf8'));
const roleTargets={
  fundResearcher:[A.sponsor,A.researcher,100000000000000n],
  fundReviewer:[A.sponsor,A.reviewer,100000000000000n],
  gateDeploy:[A.sponsor,null,null],
  sponsorMint:[A.sponsor,A.token,null],
  sponsorApproveSetup:[A.sponsor,A.token,null],
  abandonedCreate:[A.sponsor,A.escrow,null],
  abandonedRefund:[A.sponsor,A.escrow,null],
  sponsorApprove:[A.sponsor,A.token,null],
  create:[A.sponsor,A.escrow,null],
  researcherMint:[A.researcher,A.token,null],
  researcherApprove:[A.researcher,A.token,null],
  commit:[A.researcher,A.escrow,null],
  review:[A.reviewer,A.gate,null],
  reveal:[A.researcher,A.escrow,null]
};
const receipts={};
for(const [name,[from,to,value]] of Object.entries(roleTargets)){
  const [r,t]=await Promise.all([receipt(H[name]),transaction(H[name])]);
  fail(t.from?.toLowerCase()===from.toLowerCase(),`${name} sender`);
  if(to)fail(t.to?.toLowerCase()===to.toLowerCase(),`${name} target`);
  else fail(t.to===null,`${name} must be a creation transaction`);
  if(value!==null)fail(hex(t.value)===value,`${name} native value`);
  receipts[name]={hash:H[name],status:r.status,blockNumber:r.blockNumber,from:t.from,to:t.to,contractAddress:r.contractAddress||null,gasUsed:hex(r.gasUsed).toString(),effectiveGasPrice:hex(r.effectiveGasPrice).toString()};
}
for(const address of [A.token,A.escrow,A.target,A.gate])fail(await rpcCall('eth_getCode',[address,'latest'])!=='0x',`missing bytecode: ${address}`);
const gateCode=await rpcCall('eth_getCode',[A.gate,'latest']);fail(normalizeRuntime(gateCode,verifierManifest.immutableRefs)===normalizeRuntime(verifierManifest.runtimeCode,verifierManifest.immutableRefs),'reviewer-gate runtime mismatch');
fail(hex(await read(A.gate,'threshold()'))===1n&&hex(await read(A.gate,'reviewerCount()'))===1n,'reviewer quorum mismatch');
fail((await read(A.gate,'isReviewer(address)',['0'.repeat(24)+A.reviewer.slice(2).toLowerCase()])).endsWith('1'),'reviewer authorization mismatch');

const abandonedReceipt=await receipt(H.abandonedCreate);fail(eventChallengeId(abandonedReceipt,A.escrow)==='6','abandoned challenge id');
const abandoned=parseChallenge(await read(A.escrow,'challenges(uint256)',['0'.repeat(63)+'6']));
fail(abandoned.sponsor.toLowerCase()===A.sponsor&&abandoned.rewardReleased&&!abandoned.canceled&&abandoned.commitmentCount===0n,'abandoned challenge must be refunded');
const expired=event(await receipt(H.abandonedRefund),A.escrow,'ChallengeExpired(uint256,uint256)');fail(hex(expired.topics[1])===6n,'abandoned refund id');

const createReceipt=await receipt(H.create);fail(eventChallengeId(createReceipt,A.escrow)==='7','fresh challenge id');
const created=event(createReceipt,A.escrow,'ChallengeCreated(uint256,address,address,address,address,bytes32,uint256,uint256,uint64,uint64)');fail(created.topics[2].toLowerCase()===addressTopic(A.sponsor),'creation sponsor');
const fresh=parseChallenge(await read(A.escrow,'challenges(uint256)',['0'.repeat(63)+'7']));
fail(fresh.sponsor.toLowerCase()===A.sponsor&&fresh.token.toLowerCase()===A.token.toLowerCase()&&fresh.verifier.toLowerCase()===A.gate.toLowerCase()&&fresh.target.toLowerCase()===A.target.toLowerCase()&&fresh.reward===UNIT&&fresh.bond===UNIT/100n&&fresh.commitmentCount===0n&&fresh.rewardReleased&&!fresh.canceled,'fresh challenge state');
transfer(createReceipt,A.sponsor,A.escrow,UNIT,'reward escrowed');
const committed=event(await receipt(H.commit),A.escrow,'CommitmentSubmitted(uint256,address,bytes32)');fail(hex(committed.topics[1])===7n&&committed.topics[2].toLowerCase()===addressTopic(A.researcher),'commitment binding');
const commitReceipt=await receipt(H.commit);transfer(commitReceipt,A.researcher,A.escrow,UNIT/100n,'bond escrowed');
const approved=event(await receipt(H.review),A.gate,'FindingApproved(bytes32,address)');fail(approved.topics[2].toLowerCase()===addressTopic(A.reviewer),'reviewer event binding');
const revealReceipt=await receipt(H.reveal);const paid=event(revealReceipt,A.escrow,'RewardPaid(uint256,address,uint256,uint256)');fail(hex(paid.topics[1])===7n&&paid.topics[2].toLowerCase()===addressTopic(A.researcher),'reward binding');const paidWords=(paid.data.slice(2).match(/.{64}/g)||[]);fail(hex('0x'+paidWords[0])===UNIT&&hex('0x'+paidWords[1])===UNIT/100n,'reward amounts');
transfer(revealReceipt,A.escrow,A.researcher,UNIT+UNIT/100n,'reward and bond returned');
fail(!(revealReceipt.logs||[]).some(log=>log.address?.toLowerCase()===A.escrow.toLowerCase()&&log.topics?.[0]?.toLowerCase()===topic('InvalidEvidence(uint256,address,uint256)')),'invalid-evidence event emitted');

const bounty5=parseChallenge(await read(A.escrow,'challenges(uint256)',['0'.repeat(63)+'5']));fail(bounty5.sponsor.toLowerCase()===A.oldSponsor&&bounty5.verifier.toLowerCase()===A.oldGate&&bounty5.reward===UNIT&&bounty5.bond===UNIT/10n&&bounty5.commitmentCount===0n&&!bounty5.rewardReleased&&!bounty5.canceled,'Bounty #5 changed');
const bounty5Receipt=await receipt(H.bounty5Create),head=await rpcCall('eth_getBlockByNumber',['latest',false]);
for(const signature of ['CommitmentSubmitted(uint256,address,bytes32)','RewardPaid(uint256,address,uint256,uint256)','InvalidEvidence(uint256,address,uint256)','ChallengeCanceled(uint256,uint256)','ChallengeExpired(uint256,uint256)','BondRefunded(uint256,address,uint256)']){
  const logs=await rpcCall('eth_getLogs',[{address:A.escrow,fromBlock:bounty5Receipt.blockNumber,toBlock:head.number,topics:[topic(signature),'0x'+word(5)]}]);
  fail(logs.length===0,`Bounty #5 lifecycle event: ${signature}`);
}

const after={sponsor:await balance(A.sponsor),researcher:await balance(A.researcher),reviewer:await balance(A.reviewer),escrow:await balance(A.escrow),gate:await balance(A.gate),totalSupply:hex(await read(A.token,'totalSupply()'))};
fail(after.escrow===UNIT&&after.reviewer===0n&&after.gate===0n,'final accounting balances');
const allowances={sponsor:hex(await read(A.token,'allowance(address,address)',['0'.repeat(24)+A.sponsor.slice(2).toLowerCase(),'0'.repeat(24)+A.escrow.slice(2).toLowerCase()])).toString(),researcher:hex(await read(A.token,'allowance(address,address)',['0'.repeat(24)+A.researcher.slice(2).toLowerCase(),'0'.repeat(24)+A.escrow.slice(2).toLowerCase()])).toString()};fail(allowances.sponsor==='0'&&allowances.researcher==='0','approvals not consumed');

console.log(JSON.stringify({
  result:'PASS',chainId,challengeId:'7',addresses:A,receipts,
  events:{created:created.topics[0],committed:committed.topics[0],approved:approved.topics[0],rewardPaid:paid.topics[0],invalidEvidence:false},
  accounting:{sponsor:after.sponsor.toString(),researcher:after.researcher.toString(),reviewer:after.reviewer.toString(),escrow:after.escrow.toString(),gate:after.gate.toString(),totalSupply:after.totalSupply.toString(),allowances,transferLogAccounting:true},
  checks:{chainId:true,allReceiptsSuccessful:true,contractsHaveBytecode:true,reviewerGateRuntime:true,reviewerQuorum:true,challengeState:true,events:true,bounty5Untouched:true,accounting:true},
  explorerLinks:Object.fromEntries(Object.entries(H).map(([name,hash])=>[name,`${explorer}/tx/${hash}`]))
},null,2));
