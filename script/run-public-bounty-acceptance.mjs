#!/usr/bin/env node
// Script-driven public acceptance run for the BTEST-only bounty path.
//
// This deliberately uses three separately authorized encrypted Foundry keystores:
// sponsor, researcher and reviewer. It never reads or prints a private key or
// password; it passes only local password-file paths to cast. The output contains
// public transaction hashes, receipts, events and accounting checks only.
import {spawn} from 'node:child_process';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {
  UNIT, BOUNTY_SCOPE, reviewScopeHash, textHash, encodeCall, encodeCreate,
  encodeCommitmentFor, encodeCommit, encodeReveal, encodeApproveFinding,
  encodeMint, encodeApprove, encodeVerifierCreation, parseChallenge, word,
  eventChallengeId, keccak256
} from '../web/bounty-core.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const rpcUrl='https://rpc.testnet.chain.robinhood.com';
const explorer='https://explorer.testnet.chain.robinhood.com';
const cast=process.env.CAST_BIN||'cast';
const expectedChainId=46630;
const expectedSponsor='0xd1061825504b30f404c0d94b745205925f251f2c';
const expectedResearcher='0x86923864B7a7C7CfA1A56398DA6cA2a622756989';
const expectedReviewer='0xC7E69617ED81A0a7dD0cD74f82B176E22555097F';
const manifest=JSON.parse(await readFile(path.join(root,'web/deployment.json'),'utf8'));
const verifierManifest=JSON.parse(await readFile(path.join(root,'web/bounty-verifier.json'),'utf8'));
const escrow=manifest.challengeEscrow;
const token=manifest.mockToken;
const target=manifest.practiceVault;
if(Number(manifest.chainId)!==expectedChainId||!manifest.verified)throw Error('Verified public deployment manifest required.');
if(!/^0x[0-9a-fA-F]{40}$/.test(escrow)||!/^0x[0-9a-fA-F]{40}$/.test(token)||!/^0x[0-9a-fA-F]{40}$/.test(target))throw Error('Malformed public deployment manifest.');

const roles={
  sponsor:{address:expectedSponsor,keystore:process.env.BEFORE_SPONSOR_KEYSTORE,passwordFile:process.env.BEFORE_SPONSOR_PASSWORD_FILE},
  researcher:{address:expectedResearcher,keystore:process.env.BEFORE_RESEARCHER_KEYSTORE,passwordFile:process.env.BEFORE_RESEARCHER_PASSWORD_FILE},
  reviewer:{address:expectedReviewer,keystore:process.env.BEFORE_REVIEWER_KEYSTORE,passwordFile:process.env.BEFORE_REVIEWER_PASSWORD_FILE}
};
for(const [name,role] of Object.entries(roles)){
  if(!role.keystore||!role.passwordFile)throw Error(`Missing local encrypted ${name} keystore/password-file environment variables.`);
}
const funding={
  researcher:process.env.BEFORE_FUNDING_RESEARCHER_TX,
  reviewer:process.env.BEFORE_FUNDING_REVIEWER_TX
};
for(const [name,hash] of Object.entries(funding))if(!/^0x[0-9a-fA-F]{64}$/.test(hash||''))throw Error(`Missing public funding receipt hash for ${name}.`);

const hashPattern=/^0x[0-9a-fA-F]{64}$/;
const addressPattern=/^0x[0-9a-fA-F]{40}$/;
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function requiredEnv(name){const value=process.env[name];if(!value)throw Error(`Missing ${name}.`);return value;}
function parseJson(stdout){const start=stdout.indexOf('{'),end=stdout.lastIndexOf('}');if(start<0||end<start)throw Error('cast returned no JSON object.');return JSON.parse(stdout.slice(start,end+1));}
function run(command,args){
  return new Promise((resolve,reject)=>{
    const child=spawn(command,args,{cwd:root,stdio:['ignore','pipe','pipe']});
    let stdout='',stderr='';
    child.stdout.on('data',chunk=>stdout+=chunk);
    child.stderr.on('data',chunk=>stderr+=chunk);
    child.once('error',reject);
    child.once('close',code=>code===0?resolve({stdout,stderr}):reject(Error(`${command} failed with code ${code}: ${(stderr||stdout).slice(-800)}`)));
  });
}
async function rpc(method,params=[]){
  const response=await fetch(rpcUrl,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
  const body=await response.json();
  if(!response.ok||body.error||body.result===undefined)throw Error(body.error?.message||`RPC failed: ${method}`);
  return body.result;
}
const hexNumber=value=>BigInt(value);
const checksumAddress=value=>'0x'+value.slice(2).toLowerCase();
function assertAddress(value,label){if(!addressPattern.test(value||''))throw Error(`Invalid ${label}.`);return value;}
function assertHash(value,label){if(!hashPattern.test(value||''))throw Error(`Invalid ${label}.`);return value;}
async function receipt(hash,label){
  for(let i=0;i<120;i++){
    const result=await rpc('eth_getTransactionReceipt',[hash]);
    if(result){
      if(result.status!=='0x1')throw Error(`${label} receipt failed.`);
      return result;
    }
    await wait(1000);
  }
  throw Error(`${label} receipt timeout.`);
}
async function transaction(hash,label){
  const result=await rpc('eth_getTransactionByHash',[hash]);
  if(!result)throw Error(`Missing ${label} transaction.`);
  return result;
}
async function call(to,data,block='latest'){return rpc('eth_call',[{to,data},block]);}
async function read(to,signature,args=[],block='latest'){return call(to,encodeCall(signature,args),block);}
async function balance(account,block='latest'){return hexNumber(await read(token, 'balanceOf(address)',[('0'.repeat(24)+account.slice(2).toLowerCase())],block));}
async function tokenBalance(account,block='latest'){
  return hexNumber(await call(token,encodeCall('balanceOf(address)',[('0'.repeat(24)+account.slice(2).toLowerCase())]),block));
}
async function nativeBalance(account,block='latest'){return hexNumber(await rpc('eth_getBalance',[account,block]));}
async function send(roleName,to,signature,args=[],label=signature){
  const role=roles[roleName];
  const flags=[
    'send',to,signature,...args,'--rpc-url',rpcUrl,'--keystore',role.keystore,
    '--password-file',role.passwordFile,'--json','--confirmations','1'
  ];
  const output=await run(cast,flags);
  const parsed=parseJson(output.stdout);
  const hash=assertHash(parsed.transactionHash,label);
  const r=await receipt(hash,label);
  const tx=await transaction(hash,label);
  if(tx.from?.toLowerCase()!==role.address.toLowerCase()||tx.to?.toLowerCase()!==to.toLowerCase())throw Error(`${label} sender/target mismatch.`);
  return {hash,receipt:r,transaction:tx};
}
async function useExisting(roleName,to,hash,label){
  const role=roles[roleName];
  assertHash(hash,label);
  const r=await receipt(hash,label),tx=await transaction(hash,label);
  if(tx.from?.toLowerCase()!==role.address.toLowerCase()||tx.to?.toLowerCase()!==to.toLowerCase())throw Error(`${label} sender/target mismatch.`);
  return {hash,receipt:r,transaction:tx};
}
async function deployVerifier(){
  const existing=process.env.BEFORE_EXISTING_VERIFIER_ADDRESS;
  const existingTx=process.env.BEFORE_EXISTING_VERIFIER_TX;
  if(existing||existingTx){
    if(!addressPattern.test(existing||'')||!hashPattern.test(existingTx||''))throw Error('Both existing reviewer-gate address and receipt hash are required.');
    const r=await receipt(existingTx,'existing reviewer-gate deployment');
    const tx=await transaction(existingTx,'existing reviewer-gate deployment');
    if(tx.from?.toLowerCase()!==expectedSponsor||tx.to!==null||r.contractAddress?.toLowerCase()!==existing.toLowerCase())throw Error('Existing reviewer-gate receipt mismatch.');
    return {hash:existingTx,receipt:r,address:existing,transaction:tx};
  }
  const creation=encodeVerifierCreation(verifierManifest.creationCode,[expectedReviewer],1);
  const role=roles.sponsor;
  const output=await run(cast,['send','--rpc-url',rpcUrl,'--keystore',role.keystore,'--password-file',role.passwordFile,'--json','--confirmations','1','--create',creation]);
  const parsed=parseJson(output.stdout);
  const hash=assertHash(parsed.transactionHash,'reviewer-gate deployment');
  const r=await receipt(hash,'reviewer-gate deployment');
  const tx=await transaction(hash,'reviewer-gate deployment');
  if(tx.from?.toLowerCase()!==expectedSponsor||tx.to!==null)throw Error('Reviewer-gate deployment sender/destination mismatch.');
  return {hash,receipt:r,address:assertAddress(r.contractAddress,'reviewer-gate address'),transaction:tx};
}
function event(receipt,address,signature,label){
  const topic=keccak256(new TextEncoder().encode(signature)).toLowerCase();
  const matches=(receipt.logs||[]).filter(log=>log.address?.toLowerCase()===address.toLowerCase()&&log.topics?.[0]?.toLowerCase()===topic);
  if(matches.length!==1)throw Error(`Expected one ${label} event.`);
  return matches[0];
}
function eventDataWords(log){return (log.data||'0x').slice(2).match(/.{64}/g)||[];}
function normalizeRuntime(code){
  let result=code.toLowerCase();
  for(const ref of verifierManifest.immutableRefs){
    const start=2+ref.start*2,end=start+ref.length*2;
    result=result.slice(0,start)+'0'.repeat(ref.length*2)+result.slice(end);
  }
  return result;
}
function hexWord(value){return '0x'+BigInt(value).toString(16).padStart(64,'0');}
async function verifyFunding(){
  const checks=[];
  const expected={researcher:expectedResearcher,reviewer:expectedReviewer};
  for(const [name,hash] of Object.entries(funding)){
    const r=await receipt(hash,`${name} funding`),tx=await transaction(hash,`${name} funding`);
    if(tx.from?.toLowerCase()!==expectedSponsor||tx.to?.toLowerCase()!==expected[name].toLowerCase()||hexNumber(tx.value)!==100000000000000n)throw Error(`${name} funding transaction mismatch.`);
    if(hexNumber(r.gasUsed)!==21000n)throw Error(`${name} funding gas mismatch.`);
    checks.push({name,hash,status:r.status,blockNumber:r.blockNumber,from:tx.from,to:tx.to,valueWei:hexNumber(tx.value).toString(),gasUsed:hexNumber(r.gasUsed).toString(),effectiveGasPrice:hexNumber(r.effectiveGasPrice).toString()});
  }
  return checks;
}
async function waitPast(timestamp){
  for(let i=0;i<240;i++){
    const head=await rpc('eth_getBlockByNumber',['latest',false]);
    if(hexNumber(head.timestamp)>hexNumber(timestamp))return head;
    if(i%20===0)process.stderr.write(`waiting for public commit deadline (${timestamp})\n`);
    await wait(2000);
  }
  throw Error('Public commit deadline was not reached. No time travel was attempted.');
}

const chainId=Number(hexNumber(await rpc('eth_chainId')));
if(chainId!==expectedChainId)throw Error(`Wrong chain ID ${chainId}.`);
const fundingReceipts=await verifyFunding();
const signerChecks=[];
for(const [name,role] of Object.entries(roles)){
  const resolved=(await run(cast,['wallet','address','--keystore',role.keystore,'--password-file',role.passwordFile])).stdout.trim();
  if(resolved.toLowerCase()!==role.address.toLowerCase())throw Error(`${name} keystore resolves to an unauthorized address.`);
  signerChecks.push({role:name,address:role.address});
}
for(const address of [token,escrow,target])if((await rpc('eth_getCode',[address,'latest']))==='0x')throw Error(`Missing public contract bytecode: ${address}`);

const evidence='BEFORE BTEST acceptance finding: the training vault permits two individually valid transfers whose combined total exceeds the intended daily policy; reproduce with 60 BTEST then 50 BTEST.';
const salt='0x'+randomBytes(32).toString('hex');
const reward=UNIT;
const bond=UNIT/100n;
const gate=await deployVerifier();
const gateCode=await rpc('eth_getCode',[gate.address,'latest']);
if(normalizeRuntime(gateCode)!==normalizeRuntime(verifierManifest.runtimeCode))throw Error('Reviewer-gate runtime does not match the pinned artifact outside immutables.');
const threshold=hexNumber(await read(gate.address,'threshold()'));
const reviewerCount=hexNumber(await read(gate.address,'reviewerCount()'));
const isReviewer=(await read(gate.address,'isReviewer(address)',['0'.repeat(24)+expectedReviewer.slice(2).toLowerCase()])).slice(-1)==='1';
if(threshold!==1n||reviewerCount!==1n||!isReviewer)throw Error('Reviewer-gate constructor state mismatch.');

const sponsorBefore=await tokenBalance(expectedSponsor);
const researcherBefore=await tokenBalance(expectedResearcher);
const reviewerBefore=await tokenBalance(expectedReviewer);
const escrowBefore=await tokenBalance(escrow);
const supplyBefore=hexNumber(await read(token,'totalSupply()'));
const latest=await rpc('eth_getBlockByNumber',['latest',false]);
const plannedCommitDeadline=hexNumber(latest.timestamp)+BigInt(process.env.BEFORE_COMMIT_WINDOW_SECONDS||180);
const plannedRevealDeadline=plannedCommitDeadline+BigInt(process.env.BEFORE_REVEAL_WINDOW_SECONDS||900);
const mintSponsor=process.env.BEFORE_EXISTING_SPONSOR_MINT_TX
  ? await useExisting('sponsor',token,process.env.BEFORE_EXISTING_SPONSOR_MINT_TX,'sponsor BTEST mint')
  : await send('sponsor',token,'mint(address,uint256)',[expectedSponsor,reward.toString()],'sponsor BTEST mint');
const approveSponsor=process.env.BEFORE_EXISTING_SPONSOR_APPROVE_TX
  ? await useExisting('sponsor',token,process.env.BEFORE_EXISTING_SPONSOR_APPROVE_TX,'sponsor escrow approval')
  : await send('sponsor',token,'approve(address,uint256)',[escrow,reward.toString()],'sponsor escrow approval');
const currentSponsorMintDelta=process.env.BEFORE_EXISTING_SPONSOR_MINT_TX?0n:reward;
const create=process.env.BEFORE_EXISTING_CHALLENGE_CREATE_TX
  ? await useExisting('sponsor',escrow,process.env.BEFORE_EXISTING_CHALLENGE_CREATE_TX,'fresh challenge creation')
  : await send('sponsor',escrow,'createChallenge((address,uint256,uint256,address,address,bytes32,uint64,uint64))',[
    `(${token},${reward},${bond},${gate.address},${target},${reviewScopeHash},${plannedCommitDeadline},${plannedRevealDeadline})`
  ],'fresh challenge creation');
const createdLog=event(create.receipt,escrow,'ChallengeCreated(uint256,address,address,address,address,bytes32,uint256,uint256,uint64,uint64)','ChallengeCreated');
const challengeId=eventChallengeId(create.receipt,escrow);
const challenge= parseChallenge(await read(escrow,'challenges(uint256)',[word(challengeId)]));
const commitDeadline=challenge.commitDeadline;
const revealDeadline=challenge.revealDeadline;
if(challenge.sponsor.toLowerCase()!==expectedSponsor||challenge.token.toLowerCase()!==token.toLowerCase()||challenge.verifier.toLowerCase()!==gate.address.toLowerCase()||challenge.target.toLowerCase()!==target.toLowerCase()||challenge.reward!==reward||challenge.bond!==bond||challenge.commitDeadline!==commitDeadline||challenge.revealDeadline!==revealDeadline||challenge.commitmentCount!==0n||challenge.rewardReleased||challenge.canceled)throw Error('Fresh challenge state mismatch.');

const mintResearcher=process.env.BEFORE_EXISTING_RESEARCHER_MINT_TX
  ? await useExisting('researcher',token,process.env.BEFORE_EXISTING_RESEARCHER_MINT_TX,'researcher BTEST bond mint')
  : await send('researcher',token,'mint(address,uint256)',[expectedResearcher,bond.toString()],'researcher BTEST bond mint');
const approveResearcher=process.env.BEFORE_EXISTING_RESEARCHER_APPROVE_TX
  ? await useExisting('researcher',token,process.env.BEFORE_EXISTING_RESEARCHER_APPROVE_TX,'researcher escrow approval')
  : await send('researcher',token,'approve(address,uint256)',[escrow,bond.toString()],'researcher escrow approval');
const commitmentCall=encodeCommitmentFor(challengeId,expectedResearcher,salt,evidence);
const digest=await call(escrow,commitmentCall);
const commit=await send('researcher',escrow,'commit(uint256,bytes32)',[challengeId,digest],'researcher commitment');
const commitmentLog=event(commit.receipt,escrow,'CommitmentSubmitted(uint256,address,bytes32)','CommitmentSubmitted');
const approveFinding=await send('reviewer',gate.address,'approveFinding(address,uint256,address,address,bytes32,bytes32)',[
  escrow,challengeId,expectedResearcher,target,reviewScopeHash,textHash(evidence)
],'appointed reviewer approval');
const approvedLog=event(approveFinding.receipt,gate.address,'FindingApproved(bytes32,address)','FindingApproved');
await waitPast(commitDeadline);
const reveal=await send('researcher',escrow,'reveal(uint256,bytes32,bytes)',[challengeId,salt,'0x'+Buffer.from(evidence).toString('hex')],'researcher reveal and settlement');
const paidLog=event(reveal.receipt,escrow,'RewardPaid(uint256,address,uint256,uint256)','RewardPaid');
const invalidTopic=keccak256(new TextEncoder().encode('InvalidEvidence(uint256,address,uint256)')).toLowerCase();
if((reveal.receipt.logs||[]).some(log=>log.address?.toLowerCase()===escrow.toLowerCase()&&log.topics?.[0]?.toLowerCase()===invalidTopic))throw Error('Fresh reveal emitted InvalidEvidence.');

const finalChallenge=parseChallenge(await read(escrow,'challenges(uint256)',[word(challengeId)]));
if(finalChallenge.commitmentCount!==0n||!finalChallenge.rewardReleased||finalChallenge.canceled)throw Error('Final challenge accounting state mismatch.');
const sponsorAfter=await tokenBalance(expectedSponsor),researcherAfter=await tokenBalance(expectedResearcher),reviewerAfter=await tokenBalance(expectedReviewer),escrowAfter=await tokenBalance(escrow),supplyAfter=hexNumber(await read(token,'totalSupply()'));
if(sponsorAfter!==sponsorBefore+currentSponsorMintDelta-reward||researcherAfter!==researcherBefore+reward||reviewerAfter!==reviewerBefore||escrowAfter!==escrowBefore||supplyAfter!==supplyBefore+currentSponsorMintDelta+bond)throw Error('BTEST balance accounting mismatch.');
const allowances={
  sponsor:hexNumber(await read(token,'allowance(address,address)',['0'.repeat(24)+expectedSponsor.slice(2).toLowerCase(),'0'.repeat(24)+escrow.slice(2).toLowerCase()])),
  researcher:hexNumber(await read(token,'allowance(address,address)',['0'.repeat(24)+expectedResearcher.slice(2).toLowerCase(),'0'.repeat(24)+escrow.slice(2).toLowerCase()]))
};
if(allowances.sponsor!==0n||allowances.researcher!==0n)throw Error('Exact token approvals were not fully consumed.');
const oldId='5';
const oldChallenge=parseChallenge(await read(escrow,'challenges(uint256)',[word(oldId)]));
const oldCreation='0x9009a56b0c5009482e80ba3b39c91a25c39125a76210b81054dc5aea2863e3c8';
const oldReceipt=await receipt(oldCreation,'existing Bounty #5 creation');
const oldHead=await rpc('eth_getBlockByNumber',['latest',false]);
const lifecycleTopics=[
  keccak256(new TextEncoder().encode('CommitmentSubmitted(uint256,address,bytes32)')).toLowerCase(),
  keccak256(new TextEncoder().encode('RewardPaid(uint256,address,uint256,uint256)')).toLowerCase(),
  keccak256(new TextEncoder().encode('InvalidEvidence(uint256,address,uint256)')).toLowerCase(),
  keccak256(new TextEncoder().encode('ChallengeCanceled(uint256,uint256)')).toLowerCase(),
  keccak256(new TextEncoder().encode('ChallengeExpired(uint256,uint256)')).toLowerCase(),
  keccak256(new TextEncoder().encode('BondRefunded(uint256,address,uint256)')).toLowerCase()
];
const oldLogs=[];
for(const topic of lifecycleTopics){
  const logs=await rpc('eth_getLogs',[{address:escrow,fromBlock:oldReceipt.blockNumber,toBlock:oldHead.number,topics:[topic,hexWord(oldId)]}]);
  oldLogs.push(...logs);
}
if(oldChallenge.sponsor.toLowerCase()!=='0xa35dc047f9937bf668743efbdf8ea93b31a55888'||oldChallenge.reward!==reward||oldChallenge.bond!==UNIT/10n||oldChallenge.commitmentCount!==0n||oldChallenge.rewardReleased||oldChallenge.canceled||oldLogs.length!==0)throw Error('Existing Bounty #5 changed unexpectedly.');

const allTx={fundResearcher:funding.researcher,fundReviewer:funding.reviewer,gateDeploy:gate.hash,mintSponsor:mintSponsor.hash,approveSponsor:approveSponsor.hash,create:create.hash,mintResearcher:mintResearcher.hash,approveResearcher:approveResearcher.hash,commit:commit.hash,review:approveFinding.hash,reveal:reveal.hash};
const receiptSummary={};
for(const [name,hash] of Object.entries(allTx)){
  const r=await receipt(hash,name),tx=await transaction(hash,name);
  receiptSummary[name]={hash,status:r.status,blockNumber:r.blockNumber,from:tx.from,to:tx.to,contractAddress:r.contractAddress||null,gasUsed:hexNumber(r.gasUsed).toString(),effectiveGasPrice:hexNumber(r.effectiveGasPrice).toString()};
}
const report={
  result:'PASS',mode:'script-driven-public-acceptance',chainId,tokenType:'freely mintable BTEST only',valuableWifFunded:false,independentReview:false,
  disclosure:'Three distinct encrypted wallet signers were used, but this is still an operator-driven acceptance run; it is not independent human review.',
  addresses:{sponsor:expectedSponsor,researcher:expectedResearcher,reviewer:expectedReviewer,escrow,token,target,verifier:gate.address},
  challengeId,scopeHash:reviewScopeHash,evidenceHash:textHash(evidence),rewardWei:reward.toString(),bondWei:bond.toString(),commitDeadline:commitDeadline.toString(),revealDeadline:revealDeadline.toString(),
  funding:fundingReceipts,receipts:receiptSummary,
  events:{created:{topic:createdLog.topics[0],challengeId},committed:{topic:commitmentLog.topics[0]},approved:{topic:approvedLog.topics[0],reviewer:expectedReviewer},rewardPaid:{topic:paidLog.topics[0],data:paidLog.data},invalidEvidence:false},
  checks:{chainId:true,signers:signerChecks,contractsHaveCode:true,verifierRuntimePinned:true,verifierThreshold:threshold.toString(),verifierReviewerCount:reviewerCount.toString(),reviewerAuthorized:isReviewer,challengeCreatedState:true,finalRewardReleased:true,commitmentCountZero:true,balanceAccounting:{sponsorBefore:sponsorBefore.toString(),sponsorAfter:sponsorAfter.toString(),researcherBefore:researcherBefore.toString(),researcherAfter:researcherAfter.toString(),reviewerBefore:reviewerBefore.toString(),reviewerAfter:reviewerAfter.toString(),escrowBefore:escrowBefore.toString(),escrowAfter:escrowAfter.toString(),totalSupplyBefore:supplyBefore.toString(),totalSupplyAfter:supplyAfter.toString(),allowances:{sponsor:allowances.sponsor.toString(),researcher:allowances.researcher.toString()}},existingBounty5Untouched:true},
  explorerLinks:Object.fromEntries(Object.entries(allTx).map(([name,hash])=>[name,`${explorer}/tx/${hash}`])),
  contractLinks:{escrow:`${explorer}/address/${escrow}`,token:`${explorer}/address/${token}`,target:`${explorer}/address/${target}`,verifier:`${explorer}/address/${gate.address}`}
};
const output=path.join(root,'out/bounty-public-acceptance.json');await mkdir(path.dirname(output),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({result:'PASS',chainId,challengeId,addresses:report.addresses,transactions:allTx,output},null,2));
