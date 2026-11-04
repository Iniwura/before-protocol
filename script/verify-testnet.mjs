#!/usr/bin/env node
// Read-only testnet proof verifier. Neither reads wallet secrets nor submits transactions.
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {isAddress,isTxHash,parseHexUint,CHAIN_ID,RPC_URL} from '../web/core.mjs';
import {attestContract,attestFactoryInteraction,attestRuntime} from '../checks/deployment-proof.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const argv=process.argv.slice(2);
const write=argv.includes('--write');
const args=argv.filter(a=>a!=='--write');
if(args.length!==4 && args.length!==6 && args.length!==8){
  console.error('Usage: node script/verify-testnet.mjs FACTORY_ADDRESS FACTORY_DEPLOY_TX MOCK_TOKEN_ADDRESS MOCK_TOKEN_DEPLOY_TX [CHALLENGE_ESCROW_ADDRESS CHALLENGE_ESCROW_DEPLOY_TX [DEMO_FACTORY_TX PRACTICE_FACTORY_TX]] [--write]');
  process.exit(2);
}
const [factory,factoryTx,mockToken,mockTokenTx,challengeEscrow,challengeEscrowTx,demoTx,practiceTx]=args;
if(!isAddress(factory)||!isAddress(mockToken)||!isTxHash(factoryTx)||!isTxHash(mockTokenTx)
  || (challengeEscrow !== undefined && (!isAddress(challengeEscrow)||!isTxHash(challengeEscrowTx)))
  || (demoTx !== undefined && (!isTxHash(demoTx)||!isTxHash(practiceTx)))){
  console.error('Malformed public contract address or deployment transaction hash.');
  process.exit(2);
}
const rpcURL=process.env.RH_TESTNET_RPC||RPC_URL;
async function rpc(method,params=[]){
  const response=await fetch(rpcURL,{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(12000),
  });
  if(!response.ok)throw new Error('RPC HTTP '+response.status);
  const json=await response.json();
  if(json.error||json.result===undefined)throw new Error(json.error?.message||'Malformed RPC result');
  return json.result;
}
async function compiledRuntime(file){
  const artifact=JSON.parse(await readFile(path.join(root,'out',file+'.sol',file+'.json'),'utf8'));
  return artifact.deployedBytecode?.object;
}
const SELECTORS={
  createDemoVault:'0x4e6a5acd',
  createPractice:'0x1ce59d6c',
  latestVaultOf:'0xee643f9e',
  latestPracticeOf:'0x7f81587e',
  arenaVault:'0xfbfa77cf',
  owner:'0x8da5cb5b',
  allowedRecipient:'0xcb943a37',
  token:'0xfc0c546a',
  balanceOf:'0x70a08231',
};
const addressCall=(selector,address)=>selector+address.slice(2).toLowerCase().padStart(64,'0');
const decodeAddressResult=(value,label)=>{
  if(typeof value!=='string'||!/^0x[0-9a-fA-F]{64}$/.test(value))throw new Error(label+': malformed address result.');
  const address='0x'+value.slice(-40);
  if(!isAddress(address)||/^0x0{40}$/i.test(address))throw new Error(label+': zero or malformed address result.');
  return address;
};
try{
  const chainId=Number(parseHexUint(await rpc('eth_chainId')));
  if(chainId!==CHAIN_ID)throw new Error('Wrong network. Expected chain ID 46630.');
  const head=await rpc('eth_blockNumber');
  const pairs=[
    {label:'Factory',address:factory,txHash:factoryTx,file:'BeforeFactory'},
    {label:'MockToken',address:mockToken,txHash:mockTokenTx,file:'MockERC20'}
  ];
  if (challengeEscrow) {
    pairs.push({label:'ChallengeEscrow',address:challengeEscrow,txHash:challengeEscrowTx,file:'WifSecurityChallenge'});
  }
  const verified=[];
  for(const item of pairs){
    const receipt=await rpc('eth_getTransactionReceipt',[item.txHash]);
    const actualCode=await rpc('eth_getCode',[item.address,'latest']);
    const artifactCode=await compiledRuntime(item.file);
    verified.push(attestContract({...item,receipt,actualCode,artifactCode,headBlock:head,minConfirmations:12}));
  }
  let interactionManifest={demoTx:null,practiceTx:null,deployer:null,demoVault:null,practiceArena:null,practiceVault:null};
  if(demoTx){
    const [demoTransaction,practiceTransaction,demoReceipt,practiceReceipt]=await Promise.all([
      rpc('eth_getTransactionByHash',[demoTx]),
      rpc('eth_getTransactionByHash',[practiceTx]),
      rpc('eth_getTransactionReceipt',[demoTx]),
      rpc('eth_getTransactionReceipt',[practiceTx]),
    ]);
    const demo=attestFactoryInteraction({label:'DemoVaultFactoryCall',txHash:demoTx,transaction:demoTransaction,receipt:demoReceipt,factory,mockToken,selector:SELECTORS.createDemoVault,headBlock:head});
    const practice=attestFactoryInteraction({label:'PracticeFactoryCall',txHash:practiceTx,transaction:practiceTransaction,receipt:practiceReceipt,factory,mockToken,selector:SELECTORS.createPractice,headBlock:head});
    if(demo.from.toLowerCase()!==practice.from.toLowerCase())throw new Error('Factory interactions were not sent by the same deployer.');
    const deployer=demo.from;
    const demoVault=decodeAddressResult(await rpc('eth_call',[{to:factory,data:addressCall(SELECTORS.latestVaultOf,deployer)},'latest']),'DemoVault registry');
    const practiceArena=decodeAddressResult(await rpc('eth_call',[{to:factory,data:addressCall(SELECTORS.latestPracticeOf,deployer)},'latest']),'PracticeArena registry');
    const practiceVault=decodeAddressResult(await rpc('eth_call',[{to:practiceArena,data:SELECTORS.arenaVault},'latest']),'PracticeVault registry');
    const [beforeVaultCode,arenaCode,trainingVaultCode]=await Promise.all([
      rpc('eth_getCode',[demoVault,'latest']),
      rpc('eth_getCode',[practiceArena,'latest']),
      rpc('eth_getCode',[practiceVault,'latest']),
    ]);
    attestRuntime({label:'DemoVault',address:demoVault,actualCode:beforeVaultCode,artifactCode:await compiledRuntime('BeforeVault')});
    attestRuntime({label:'PracticeArena',address:practiceArena,actualCode:arenaCode,artifactCode:await compiledRuntime('TrainingArena')});
    attestRuntime({label:'PracticeVault',address:practiceVault,actualCode:trainingVaultCode,artifactCode:await compiledRuntime('TrainingVault')});
    const [demoOwner,demoRecipient,demoToken,arenaToken,demoBalance,practiceBalance]=await Promise.all([
      rpc('eth_call',[{to:demoVault,data:SELECTORS.owner},'latest']),
      rpc('eth_call',[{to:demoVault,data:SELECTORS.allowedRecipient},'latest']),
      rpc('eth_call',[{to:demoVault,data:SELECTORS.token},'latest']),
      rpc('eth_call',[{to:practiceArena,data:SELECTORS.token},'latest']),
      rpc('eth_call',[{to:mockToken,data:addressCall(SELECTORS.balanceOf,demoVault)},'latest']),
      rpc('eth_call',[{to:mockToken,data:addressCall(SELECTORS.balanceOf,practiceVault)},'latest']),
    ]);
    if(decodeAddressResult(demoOwner,'DemoVault owner').toLowerCase()!==deployer.toLowerCase())throw new Error('DemoVault owner does not match the factory deployer.');
    if(decodeAddressResult(demoRecipient,'DemoVault recipient').toLowerCase()!==deployer.toLowerCase())throw new Error('DemoVault recipient does not match the factory deployer.');
    if(decodeAddressResult(demoToken,'DemoVault token').toLowerCase()!==mockToken.toLowerCase())throw new Error('DemoVault token does not match MockERC20.');
    if(decodeAddressResult(arenaToken,'PracticeArena token').toLowerCase()!==mockToken.toLowerCase())throw new Error('PracticeArena token does not match MockERC20.');
    const initialBalance=150n*10n**18n;
    if(parseHexUint(demoBalance)!==initialBalance||parseHexUint(practiceBalance)!==initialBalance)throw new Error('Factory-created demo assets are not funded with exactly 150 BTEST.');
    interactionManifest={demoTx,practiceTx,deployer,demoVault,practiceArena,practiceVault};
    console.log('PASS: factory interaction receipts create the verified demo vault and funded practice arena.');
  }
  const manifest={chainId:CHAIN_ID,factory,mockToken,challengeEscrow:challengeEscrow||null,factoryTx,mockTokenTx,challengeEscrowTx:challengeEscrowTx||null,arena:interactionManifest.practiceArena, ...interactionManifest,verified:true};
  const countLabel = pairs.length === 2 ? 'two' : 'three';
  console.log(`PASS: ${countLabel} deployment receipts match the compiled runtime bytecode on Robinhood testnet.`);
  console.log('Confirmations:',verified.map(v=>v.confirmations).join(', '));
  if(write){
    await writeFile(path.join(root,'web/deployment.json'),JSON.stringify(manifest,null,2)+'\n');
    console.log('Wrote web/deployment.json. Review the diff and explorer links before merging.');
  }else{
    console.log(JSON.stringify(manifest,null,2));
    console.log('Dry-run only. Re-run with --write after reviewing evidence.');
  }
}catch(error){
  console.error('NOT VERIFIED: '+error.message);
  process.exitCode=1;
}
