#!/usr/bin/env node
// Disposable local-chain release gate. It never touches a public RPC or writes the hosted manifest.
import {mkdtemp,cp,readFile,rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {fileURLToPath} from 'node:url';
import {extractBroadcastEvidence} from './broadcast-args.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const forge=process.env.FORGE_BIN||'forge';
const anvil=process.env.ANVIL_BIN||'anvil';
const wait=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));

function run(command,args,{cwd=root,env=process.env}={}) {
  return new Promise((resolve,reject)=>{
    const child=spawn(command,args,{cwd,env,stdio:['ignore','pipe','pipe']});
    let stdout='',stderr='';
    child.stdout.on('data',chunk=>stdout+=chunk);
    child.stderr.on('data',chunk=>stderr+=chunk);
    child.once('error',reject);
    child.once('close',code=>resolve({code,stdout,stderr}));
  });
}

async function freePort() {
  const server=createServer();
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const port=server.address().port;
  await new Promise(resolve=>server.close(resolve));
  return port;
}

async function rpc(url,method,params=[]) {
  const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
  const json=await response.json();
  if (!response.ok||json.error) throw new Error(json.error?.message||`RPC HTTP ${response.status}`);
  return json.result;
}

async function waitForRpc(url) {
  for(let attempt=0;attempt<100;attempt+=1){
    try { if(await rpc(url,'eth_chainId')==='0x7a69') return; } catch {}
    await wait(100);
  }
  throw new Error('Anvil did not become ready.');
}

async function receiptFor(url,hash) {
  for(let attempt=0;attempt<100;attempt+=1){
    const receipt=await rpc(url,'eth_getTransactionReceipt',[hash]);
    if(receipt) return receipt;
    await wait(50);
  }
  throw new Error('Transaction was not mined: '+hash);
}

async function send(url,from,to,data) {
  const hash=await rpc(url,'eth_sendTransaction',[{from,to,data,value:'0x0'}]);
  await receiptFor(url,hash);
  return hash;
}

async function mineConfirmations(url) {
  try {
    await rpc(url,'anvil_mine',['0x20']);
  } catch {
    for(let index=0;index<32;index+=1) await rpc(url,'evm_mine');
  }
}

const word=value=>typeof value==='string'?'0'.repeat(24)+value.slice(2).toLowerCase():BigInt(value).toString(16).padStart(64,'0');
const words=(...values)=>'0x'+values.map(value=>word(value)).join('');
const withdrawData=(recipient,amount)=>'0xf3fef3a3'+word(recipient)+word(amount);
const proofData='0x3b1bf525'+words(32n,2n,60n*10n**18n,50n*10n**18n).slice(2);

async function main() {
  const port=await freePort();
  const url=`http://127.0.0.1:${port}`;
  const chain=spawn(anvil,['--chain-id','31337','--port',String(port),'--silent'],{stdio:['ignore','pipe','pipe']});
  let tempRoot;
  try {
    await waitForRpc(url);
    const accounts=await rpc(url,'eth_accounts');
    const sender=accounts?.[0];
    if(!sender) throw new Error('Anvil did not expose an unlocked test account.');

    tempRoot=await mkdtemp(path.join(tmpdir(),'before-anvil-e2e-'));
    await cp(root,tempRoot,{recursive:true,filter(source){
      const relative=path.relative(root,source);
      return !relative.startsWith('.git')&&!relative.startsWith('cache')&&!relative.startsWith('broadcast')&&!relative.startsWith('qa/node_modules');
    }});
    const forgeArgs=['script','script/DeployBefore.s.sol:DeployBefore','--rpc-url',url,'--broadcast','--unlocked','--sender',sender,'-vvv'];
    const solc=process.env.SOLC_BIN||(existsSync('/tmp/solc-0.8.36')?'/tmp/solc-0.8.36':null);
    if(solc) forgeArgs.push('--offline','--use',solc);
    const deploy=await run(forge,forgeArgs,{cwd:tempRoot,env:{...process.env,FOUNDRY_HOME:path.join(tempRoot,'.foundry')}});
    if(deploy.code!==0) throw new Error('DeployBefore local broadcast failed.\n'+deploy.stdout+'\n'+deploy.stderr);
    const broadcastPath=path.join(tempRoot,'broadcast','DeployBefore.s.sol','31337','run-latest.json');
    const evidence=extractBroadcastEvidence(JSON.parse(await readFile(broadcastPath,'utf8')));
    const demoFactoryReceipt=await rpc(url,'eth_getTransactionReceipt',[evidence.demoTx]);
    const practiceFactoryReceipt=await rpc(url,'eth_getTransactionReceipt',[evidence.practiceTx]);
    const demoVault=demoFactoryReceipt.logs.find(log=>log.address.toLowerCase()===evidence.factory.toLowerCase()&&log.topics[0].toLowerCase()==='0x12cd41479914d3ffb29c1abbe7cef9f1c4d3a03603eafa901c21e4b0c826955a').topics[2];
    const practiceArena=practiceFactoryReceipt.logs.find(log=>log.address.toLowerCase()===evidence.factory.toLowerCase()&&log.topics[0].toLowerCase()==='0x8a0923f7b9bc4930ee8c8e7773325c8ecead718d54032c702b2690438c0b3a1e').topics[2];
    const demoAddress='0x'+demoVault.slice(-40);
    const arenaAddress='0x'+practiceArena.slice(-40);
    const practiceVaultRaw=await rpc(url,'eth_call',[{to:arenaAddress,data:'0xfbfa77cf'},'latest']);
    const practiceVault='0x'+practiceVaultRaw.slice(-40);
    const allowed=await send(url,sender,demoAddress,withdrawData(sender,20n*10n**18n));
    const denied=await send(url,sender,demoAddress,withdrawData(sender,75n*10n**18n));
    const proof=await send(url,sender,arenaAddress,proofData);
    await mineConfirmations(url);
    const verifierArgs=[evidence.factory,evidence.factoryTx,evidence.mockToken,evidence.mockTokenTx,evidence.challengeEscrow,evidence.challengeEscrowTx,evidence.demoTx,evidence.practiceTx,allowed,denied,proof,'--local'];
    const verified=await run(process.execPath,['script/verify-testnet.mjs',...verifierArgs],{env:{...process.env,RH_TESTNET_RPC:url}});
    if(verified.code!==0) throw new Error('Local eleven-argument verifier rejected genuine Anvil evidence.\n'+verified.stdout+'\n'+verified.stderr);
    const tamperedArgs=[...verifierArgs.slice(0,8),denied,allowed,proof,'--local'];
    const tampered=await run(process.execPath,['script/verify-testnet.mjs',...tamperedArgs],{env:{...process.env,RH_TESTNET_RPC:url}});
    if(tampered.code===0) throw new Error('Local verifier accepted swapped allowed/denied receipts.');
    console.log(JSON.stringify({chainId:31337,verified:true,genuineEvidence:'PASS',tamperedEvidence:'REJECTED',demoVault:demoAddress,practiceArena:arenaAddress,practiceVault},null,2));
  } finally {
    if(tempRoot) await rm(tempRoot,{recursive:true,force:true});
    chain.kill('SIGTERM');
  }
}

main().catch(error=>{console.error('NOT VERIFIED: '+error.message);process.exitCode=1;});
