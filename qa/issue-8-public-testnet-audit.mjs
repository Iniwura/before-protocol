#!/usr/bin/env node
// Read-only issue #8 audit. This script never loads a key and never broadcasts.
import {readFile} from 'node:fs/promises';
import {encodeCall,encodeCreate,word,textHash} from '../web/bounty-core.mjs';

const RPC='https://rpc.testnet.chain.robinhood.com';
const EXPLORER='https://explorer.testnet.chain.robinhood.com';
const CHAIN_ID=46630;
const APPROVED_SIGNER='0xd1061825504b30f404c0d94b745205925f251f2c';
const BOUNTY_SPONSOR='0xa35dc047f9937bf668743efbdf8ea93b31a55888';
const ESCROW='0xF9d644dd2024E2dFc425aA7c1059F9b4E720684a';
const TOKEN='0xf080A1a012F2Dd41c4F416Befd6D70074af75A4C';
const TARGET='0x7e29bC6Df38e60E77513bc1084dB488FeE12947c';
const DEMO='0x166E3367cdC9751A02570fedf8d700C4f70fCd1C';
const BOUNTY_CREATION='0x9009a56b0c5009482e80ba3b39c91a25c39125a76210b81054dc5aea2863e3c8';
const GATE='0x1391916cc9012ece416f682227d99373f1631eaa';
const GATE_CREATION='0xb9730e204566fd7ebf3d25636569715d4e6bad4528a8a84dd0e7e1671fa475e8';
const DEMO_TXS={
 deploy:'0x1e0e7783d9f46047c351d4b942344052892312c9f2ff0fa7f06e2b764b59e7dc',
 start:'0x2ad4387c44ab0e1d5bf4f561318a9e8e8c493e7f8a6414cb980bf36603517789',
 settle:'0x74df2df93542458b66ae7751ceed7e28bd66b739bd43a5f6bedc1ba903aefd08',
 cleanup:'0x5e35f62052dc5d8bbaed2da78cbf3df3a2fed0d6254f49e940d74f0a772e5898'
};
const REWARD=10n**18n;
const BOND=10n**17n;
const addressEqual=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
const explorerTx=hash=>EXPLORER+'/tx/'+hash;
const explorerAddress=address=>EXPLORER+'/address/'+address;
const assert=(condition,message)=>{if(!condition)throw Error(message)};

async function rpc(method,params=[]){
 const response=await fetch(RPC,{method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(15000)});
 const body=await response.json();
 if(!response.ok||body.error||body.result===undefined)throw Error(method+': '+(body.error?.message||'malformed RPC response'));
 return body.result;
}
const call=(to,signature,args=[])=>rpc('eth_call',[{to,data:encodeCall(signature,args)},'latest']);
const code=address=>rpc('eth_getCode',[address,'latest']);
const hexNumber=value=>BigInt(value);
const wordsOf=hex=>{assert(/^0x(?:[0-9a-f]{64})+$/i.test(hex),'Malformed ABI response.');return hex.slice(2).match(/.{64}/g)};
const eventTopic=signature=>textHash(signature).toLowerCase();
const eventNames={
 challenge:eventTopic('ChallengeCreated(uint256,address,address,address,address,bytes32,uint256,uint256,uint64,uint64)'),
 commit:eventTopic('CommitmentSubmitted(uint256,address,bytes32)'),
 approval:eventTopic('FindingApproved(bytes32,address)'),
 paid:eventTopic('RewardPaid(uint256,address,uint256,uint256)'),
 invalid:eventTopic('InvalidEvidence(uint256,address,uint256)'),
 canceled:eventTopic('ChallengeCanceled(uint256,uint256)'),
 expired:eventTopic('ChallengeExpired(uint256,uint256)'),
 bond:eventTopic('BondRefunded(uint256,address,uint256)'),
 started:eventTopic('DemoStarted(uint256,uint256,uint256,uint256,uint64,uint64)'),
 settled:eventTopic('DemoSettled(uint256,uint256,uint256)'),
 completed:eventTopic('DemoCompleted(uint256,uint256,uint256)')
};
async function logs(address,topic,fromBlock,indexedId){
 const topics=[topic];
 if(indexedId!==undefined)topics.push('0x'+word(indexedId));
 const from=typeof fromBlock==='bigint'?'0x'+fromBlock.toString(16):fromBlock;
 return rpc('eth_getLogs',[{address,fromBlock:from,toBlock:'latest',topics}]);
}
function countReceiptEvents(receipt,knownAddress){
 const counts={};
 for(const log of receipt.logs||[]){
  if(knownAddress&&!addressEqual(log.address,knownAddress))continue;
  const name=Object.entries(eventNames).find(([,topic])=>topic===log.topics?.[0]?.toLowerCase())?.[0];
  if(name)counts[name]=(counts[name]||0)+1;
 }
 return counts;
}
async function transactionProof(hash,{from,to,creation=false}={}){
 const [transaction,receipt]=await Promise.all([
  rpc('eth_getTransactionByHash',[hash]),rpc('eth_getTransactionReceipt',[hash])
 ]);
 assert(transaction&&receipt,'Missing transaction or receipt: '+hash);
 assert(receipt.status==='0x1','Reverted receipt: '+hash);
 assert(addressEqual(transaction.hash,hash)&&addressEqual(receipt.transactionHash,hash),'Receipt hash mismatch: '+hash);
 assert(addressEqual(transaction.from,from),'Unexpected sender for '+hash);
 if(creation){assert(transaction.to===null&&receipt.to===null,'Expected contract creation: '+hash)}
 else assert(addressEqual(transaction.to,to)&&addressEqual(receipt.to,to),'Unexpected destination: '+hash);
 return {hash,block:receipt.blockNumber,from:transaction.from,to:transaction.to,status:receipt.status,logs:countReceiptEvents(receipt)};
}
function codeMatches(actual,artifact,immutableRefs=[]){
 assert(/^0x[0-9a-f]+$/i.test(actual)&&/^0x[0-9a-f]+$/i.test(artifact),'Malformed runtime code.');
 assert(actual.length===artifact.length,'Runtime length mismatch.');
 const ignored=new Set();
 for(const ref of immutableRefs)for(let i=ref.start*2;i<(ref.start+ref.length)*2;i++)ignored.add(i);
 const a=actual.slice(2).toLowerCase(),b=artifact.slice(2).toLowerCase();
 for(let i=0;i<a.length;i++)if(!ignored.has(i)&&a[i]!==b[i])return false;
 return true;
}

try{
 const artifact=JSON.parse(await readFile(new URL('../web/bounty-verifier.json',import.meta.url),'utf8'));
 const head=await rpc('eth_getBlockByNumber',['latest',false]);
 const chainId=Number(await rpc('eth_chainId'));
 assert(chainId===CHAIN_ID,'Expected Robinhood testnet chain 46630.');
 const publicContracts={};
 for(const [name,address] of Object.entries({escrow:ESCROW,token:TOKEN,target:TARGET,gate:GATE})){
  const runtime=await code(address); assert(runtime!=='0x','Missing '+name+' bytecode.');
  publicContracts[name]={address,byteLength:(runtime.length-2)/2,explorer:explorerAddress(address)};
 }

 const bountyCreation=await transactionProof(BOUNTY_CREATION,{from:BOUNTY_SPONSOR,to:ESCROW});
 const bountyReceipt=await rpc('eth_getTransactionReceipt',[BOUNTY_CREATION]);
 const challengeLogs=(bountyReceipt.logs||[]).filter(log=>addressEqual(log.address,ESCROW)&&log.topics?.[0]?.toLowerCase()===eventNames.challenge);
 assert(challengeLogs.length===1,'Bounty #5 must have exactly one ChallengeCreated log.');
 const challengeLog=challengeLogs[0];
 assert(BigInt(challengeLog.topics[1])===5n,'Creation receipt is not for Bounty #5.');
 assert(addressEqual('0x'+challengeLog.topics[2].slice(-40),BOUNTY_SPONSOR),'Bounty #5 sponsor log mismatch.');
 const configWords=wordsOf(challengeLog.data);
 const challengeConfig={
  verifier:'0x'+configWords[0].slice(-40),target:'0x'+configWords[1].slice(-40),
  scopeHash:'0x'+configWords[2],reward:hexNumber('0x'+configWords[3]),bond:hexNumber('0x'+configWords[4]),
  commitDeadline:hexNumber('0x'+configWords[5]),revealDeadline:hexNumber('0x'+configWords[6])
 };
 assert(addressEqual(challengeConfig.verifier,GATE)&&addressEqual(challengeConfig.target,TARGET),'Bounty #5 trust-boundary addresses mismatch.');
 assert(challengeConfig.reward===REWARD&&challengeConfig.bond===BOND,'Bounty #5 reward or bond mismatch.');
 const expectedCreate=encodeCreate({token:TOKEN,reward:REWARD,bond:BOND,verifier:GATE,target:TARGET,scopeHash:challengeConfig.scopeHash,commitDeadline:challengeConfig.commitDeadline,revealDeadline:challengeConfig.revealDeadline});
 const bountyTx=await rpc('eth_getTransactionByHash',[BOUNTY_CREATION]);
 assert(bountyTx.input.toLowerCase()===expectedCreate.toLowerCase(),'Bounty #5 creation calldata mismatch.');

 const gateCreation=await transactionProof(GATE_CREATION,{from:BOUNTY_SPONSOR,creation:true});
 const gateTx=await rpc('eth_getTransactionByHash',[GATE_CREATION]);
 assert(addressEqual(gateCreation.hash,GATE_CREATION)&&addressEqual((await rpc('eth_getTransactionReceipt',[GATE_CREATION])).contractAddress,GATE),'Reviewer gate creation address mismatch.');
 assert(gateTx.input.slice(0,artifact.creationCode.length).toLowerCase()===artifact.creationCode.toLowerCase(),'Reviewer gate creation bytecode prefix mismatch.');
 const gateTail=gateTx.input.slice(artifact.creationCode.length);
 assert(gateTail.slice(0,64)===word(64)&&gateTail.slice(64,128)===word(1)&&gateTail.slice(128,192)===word(1),'Reviewer gate constructor quorum mismatch.');
 const reviewer='0x'+gateTail.slice(216,256);
 assert(/^0x[0-9a-f]{40}$/i.test(reviewer),'Malformed appointed reviewer address.');
 const gateRuntime=await code(GATE);
 assert(codeMatches(gateRuntime,artifact.runtimeCode,artifact.immutableRefs),'Reviewer gate runtime mismatch.');
 assert(BigInt(await call(GATE,'threshold()'))===1n&&BigInt(await call(GATE,'reviewerCount()'))===1n,'Reviewer quorum readback mismatch.');
 assert(BigInt(await call(GATE,'isReviewer(address)',[word(reviewer)]))===1n,'Appointed reviewer is not authorized in the gate.');

 const challengeRaw=await call(ESCROW,'challenges(uint256)',[word(5)]); const c=wordsOf(challengeRaw);
 const challengeState={
  sponsor:'0x'+c[0].slice(-40),rewardToken:'0x'+c[1].slice(-40),verifier:'0x'+c[2].slice(-40),target:'0x'+c[3].slice(-40),
  reward:hexNumber('0x'+c[6]),bond:hexNumber('0x'+c[7]),commitDeadline:hexNumber('0x'+c[8]),revealDeadline:hexNumber('0x'+c[9]),
  commitmentCount:hexNumber('0x'+c[10]),rewardReleased:hexNumber('0x'+c[11])!==0n,canceled:hexNumber('0x'+c[12])!==0n
 };
 const now=hexNumber(head.timestamp);
 assert(addressEqual(challengeState.sponsor,BOUNTY_SPONSOR)&&addressEqual(challengeState.rewardToken,TOKEN)&&addressEqual(challengeState.verifier,GATE)&&addressEqual(challengeState.target,TARGET),'Bounty #5 state binding mismatch.');
 assert(challengeState.reward===REWARD&&challengeState.bond===BOND&&challengeState.commitmentCount===0n&&!challengeState.rewardReleased&&!challengeState.canceled,'Bounty #5 is not an untouched live challenge.');
 assert(now>challengeState.revealDeadline,'Bounty #5 reveal deadline has not expired yet.');
 const escrowBalance=hexNumber(await call(TOKEN,'balanceOf(address)',[word(ESCROW)]));
 assert(escrowBalance===REWARD,'Bounty #5 escrow balance changed unexpectedly.');
 const creationBlock=BigInt(bountyCreation.block);
 const [commits,paid,invalid,expired,bonds,canceled,approvals]=await Promise.all([
  logs(ESCROW,eventNames.commit,creationBlock,5),logs(ESCROW,eventNames.paid,creationBlock,5),logs(ESCROW,eventNames.invalid,creationBlock,5),
  logs(ESCROW,eventNames.expired,creationBlock,5),logs(ESCROW,eventNames.bond,creationBlock,5),logs(ESCROW,eventNames.canceled,creationBlock,5),
  logs(GATE,eventNames.approval,creationBlock)
 ]);
 assert(commits.length===0&&paid.length===0&&invalid.length===0&&expired.length===0&&bonds.length===0&&canceled.length===0&&approvals.length===0,'Bounty #5 has unexpected lifecycle events.');

 const demoProof={};
 demoProof.deploy=await transactionProof(DEMO_TXS.deploy,{from:APPROVED_SIGNER,creation:true});
 const deployReceipt=await rpc('eth_getTransactionReceipt',[DEMO_TXS.deploy]);
 assert(addressEqual(deployReceipt.contractAddress,DEMO),'Historical demo deployment address mismatch.');
 for(const [name,hash] of Object.entries(DEMO_TXS).filter(([name])=>name!=='deploy'))demoProof[name]=await transactionProof(hash,{from:APPROVED_SIGNER,to:DEMO});
 const stage=BigInt(await call(DEMO,'stage()')); assert(stage===3n,'Historical demo coordinator is not at stage 3.');
 const demoLogs={start:countReceiptEvents(await rpc('eth_getTransactionReceipt',[DEMO_TXS.start])),settle:countReceiptEvents(await rpc('eth_getTransactionReceipt',[DEMO_TXS.settle])),cleanup:countReceiptEvents(await rpc('eth_getTransactionReceipt',[DEMO_TXS.cleanup]))};
 assert(demoLogs.start.challenge===4&&demoLogs.start.commit===3&&demoLogs.start.approval===2&&demoLogs.start.canceled===1,'Historical start event matrix mismatch.');
 assert(demoLogs.settle.paid===1&&demoLogs.settle.invalid===1&&demoLogs.settle.expired===1&&demoLogs.settle.bond===1,'Historical settlement event matrix mismatch.');
 assert(demoLogs.cleanup.expired===1,'Historical cleanup event matrix mismatch.');
 const demoTokenBalance=async(name,address)=>[name,(await call(TOKEN,'balanceOf(address)',[word(address)]))];
 const roles={sponsor:'0x'+(await call(DEMO,'sponsor()')).slice(-40),solver:'0x'+(await call(DEMO,'solver()')).slice(-40)};
 // The historical coordinator held funds directly during its synthetic run;
 // the public Bounty #5 escrow is intentionally checked separately above.
 const [sponsorBalance,solverBalance,finalEscrow]=await Promise.all([demoTokenBalance('sponsor',roles.sponsor),demoTokenBalance('solver',roles.solver),demoTokenBalance('escrow',DEMO)]);
 assert(BigInt(sponsorBalance[1])===410n*REWARD/1n&&BigInt(solverBalance[1])===150n*REWARD/1n&&BigInt(finalEscrow[1])===0n,'Historical demo final accounting mismatch.');

 console.log(JSON.stringify({result:'PASS',readOnly:true,chainId,headBlock:Number(hexNumber(head.number)),headTimestamp:now.toString(),approvedSigner:APPROVED_SIGNER,bounty5:{sponsor:BOUNTY_SPONSOR,creation:{...bountyCreation,explorer:explorerTx(BOUNTY_CREATION)},reviewerGate:{address:GATE,creation:{...gateCreation,explorer:explorerTx(GATE_CREATION)},appointedReviewer:reviewer,threshold:1,reviewerCount:1},config:{...challengeConfig,reward:challengeConfig.reward.toString(),bond:challengeConfig.bond.toString(),commitDeadline:challengeConfig.commitDeadline.toString(),revealDeadline:challengeConfig.revealDeadline.toString()},state:{...challengeState,reward:challengeState.reward.toString(),bond:challengeState.bond.toString(),commitDeadline:challengeState.commitDeadline.toString(),revealDeadline:challengeState.revealDeadline.toString(),commitmentCount:challengeState.commitmentCount.toString(),now:now.toString()},escrowBtestBalance:escrowBalance.toString(),publicLifecycleReceipts:{commit:0,approval:0,settlement:0,refund:0}},contracts:publicContracts,historicalSyntheticDemo:{address:DEMO,explorer:explorerAddress(DEMO),transactions:Object.fromEntries(Object.entries(demoProof).map(([name,value])=>[name,{...value,explorer:explorerTx(value.hash)}])),events:demoLogs,stage:stage.toString(),finalAccounting:{sponsor:'410000000000000000000',solver:'150000000000000000000',escrow:'0'}},scope:'BTEST only; no real WIF; no new transaction broadcast by this audit.'},(key,value)=>typeof value==='bigint'?value.toString():value,2));
}catch(error){console.error('NOT VERIFIED: '+error.message);process.exitCode=1;}
