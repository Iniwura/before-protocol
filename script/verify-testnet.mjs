#!/usr/bin/env node
// Read-only testnet proof verifier. Neither reads wallet secrets nor submits transactions.
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {isAddress,isTxHash,parseHexUint,CHAIN_ID,RPC_URL} from '../web/core.mjs';
import {attestContract} from '../checks/deployment-proof.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const argv=process.argv.slice(2);
const write=argv.includes('--write');
const args=argv.filter(a=>a!=='--write');
if(args.length!==4){
  console.error('Usage: node script/verify-testnet.mjs FACTORY_ADDRESS FACTORY_DEPLOY_TX MOCK_TOKEN_ADDRESS MOCK_TOKEN_DEPLOY_TX [--write]');
  process.exit(2);
}
const [factory,factoryTx,mockToken,mockTokenTx]=args;
if(!isAddress(factory)||!isAddress(mockToken)||!isTxHash(factoryTx)||!isTxHash(mockTokenTx)){
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
try{
  const chainId=Number(parseHexUint(await rpc('eth_chainId')));
  if(chainId!==CHAIN_ID)throw new Error('Wrong network. Expected chain ID 46630.');
  const head=await rpc('eth_blockNumber');
  const pairs=[
    {label:'Factory',address:factory,txHash:factoryTx,file:'BeforeFactory'},
    {label:'MockToken',address:mockToken,txHash:mockTokenTx,file:'MockERC20'}
  ];
  const verified=[];
  for(const item of pairs){
    const receipt=await rpc('eth_getTransactionReceipt',[item.txHash]);
    const actualCode=await rpc('eth_getCode',[item.address,'latest']);
    const artifactCode=await compiledRuntime(item.file);
    verified.push(attestContract({...item,receipt,actualCode,artifactCode,headBlock:head,minConfirmations:12}));
  }
  const manifest={chainId:CHAIN_ID,factory,mockToken,factoryTx,mockTokenTx,arena:null,verified:true};
  console.log('PASS: two deployment receipts match the compiled runtime bytecode on Robinhood testnet.');
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
