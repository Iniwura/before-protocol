#!/usr/bin/env node
// BEFORE production vault signoff: live-site comparison + public chain + read-only creation simulation.
// NO private keys, NO wallet RPC, NO raw transactions and NO state changes.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {SELECTORS,encodeDemoCreate,encodeAddressCall} from '../web/onchain.mjs';
const ORIGIN='https://before-web-theta.vercel.app';
const RPC='https://rpc.testnet.chain.robinhood.com';
const local=JSON.parse(await readFile(new URL('../web/deployment.json',import.meta.url)));
const localHTML=await readFile(new URL('../web/app/index.html',import.meta.url),'utf8');
const localJS=await readFile(new URL('../web/app.js',import.meta.url),'utf8');
const lowercase=s=>String(s||'').toLowerCase();
const textHash=s=>createHash('sha256').update(s).digest('hex');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function requestJson(url,options={}){
 for(let attempt=0;attempt<5;attempt++){
  try{
   const res=await fetch(url,{...options,signal:AbortSignal.timeout(30000),cache:'no-store'});
   if(!res.ok)throw Error('HTTP '+res.status+' '+url);
   return await res.json();
  }catch(error){if(attempt===4)throw error;await wait(600*(attempt+1));}
 }
}
let serial=0;
async function rpc(method,params=[]){
 for(let attempt=0;attempt<6;attempt++){
  try{
   const res=await requestJson(RPC,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:++serial,method,params})});
   if(res.error)throw Error(method+': '+JSON.stringify(res.error));
   if(res.result===undefined||res.result===null)throw Error(method+': no result');
   return res.result;
  }catch(error){if(attempt===5)throw error;await wait(700*(attempt+1));}
 }
}
const asAddress=x=>'0x'+x.slice(-40);
const dec=x=>BigInt(x).toString();
const dataToAddress=x=>{assert.match(x,/^0x[0-9a-fA-F]{64}$/);return asAddress(x)};
const eq=(a,b)=>lowercase(a)===lowercase(b);
const rec={checkedAt:new Date().toISOString(),network:46630,production:ORIGIN,results:{},scope:'BTEST-only; read-only; no wallet signing or broadcasting'};
try{
 const liveConfig=await requestJson(ORIGIN+'/deployment.json');
 assert.equal(liveConfig.chainId,46630);
 assert.equal(liveConfig.verified,true);
 assert.deepEqual(liveConfig,local,'Production manifest differs from source-controlled manifest');
 const html=await fetch(ORIGIN+'/app/',{cache:'no-store'}).then(r=>{assert.equal(r.status,200);return r.text()});
 const js=await fetch(ORIGIN+'/app.js',{cache:'no-store'}).then(r=>{assert.equal(r.status,200);return r.text()});
 assert.equal(textHash(html),textHash(localHTML),'Live Protect page differs from approved source');
 assert.equal(textHash(js),textHash(localJS),'Live app logic differs from approved source');
 assert.match(html,/id="create-demo-vault"/);
 assert.match(js,/eth_sendTransaction/);
 rec.results.production={manifestMatch:true,htmlSha256:textHash(html),appJsSha256:textHash(js),vaultButton:true,walletSendCode:true};

 const chain=await rpc('eth_chainId');
 assert.equal(BigInt(chain),46630n);
 const [factoryCode,tokenCode,vaultCode]=await Promise.all([
  rpc('eth_getCode',[local.factory,'latest']),
  rpc('eth_getCode',[local.mockToken,'latest']),
  rpc('eth_getCode',[local.demoVault,'latest'])
 ]);
 for(const [label,value] of [['factory',factoryCode],['BTEST',tokenCode],['vault',vaultCode]]){
  assert.ok(value.length>100,label+' contract bytecode missing');
 }
 rec.results.contracts={factory:local.factory,token:local.mockToken,demoVault:local.demoVault,runtimePresent:true};

 const [tx,receipt]=await Promise.all([
  rpc('eth_getTransactionByHash',[local.demoTx]),
  rpc('eth_getTransactionReceipt',[local.demoTx])
 ]);
 assert.ok(tx&&receipt);
 assert.equal(receipt.status,'0x1','Factory createDemoVault receipt reverted');
 assert.ok(eq(tx.to,local.factory));
 assert.ok(eq(tx.from,local.deployer));
 assert.ok(eq(receipt.from,local.deployer));
 assert.ok(eq(receipt.to,local.factory));
 assert.ok(eq(tx.input,encodeDemoCreate(local.mockToken)),'Factory function call did not match the UI calldata');
 const createdEvent=receipt.logs.filter(l=>eq(l.address,local.factory)&&eq(l.topics?.[0],'0x12cd41479914d3ffb29c1abbe7cef9f1c4d3a03603eafa901c21e4b0c826955a'));
 assert.equal(createdEvent.length,1,'VaultCreated event not unique');
 assert.ok(eq(asAddress(createdEvent[0].topics[1]),local.deployer),'Event owner mismatch');
 assert.ok(eq(asAddress(createdEvent[0].topics[2]),local.demoVault),'Event vault mismatch');
 rec.results.pastCreation={tx:local.demoTx,block:parseInt(receipt.blockNumber,16),sender:tx.from,success:true,vault:local.demoVault,method:'createDemoVault(BTEST)',eventVerified:true};

 const call=(to,data,from)=>rpc('eth_call',[{to,data,...(from?{from}:{})},'latest']);
 const [isVault,latestVault,owner,recipient,maxTransfer,dailyLimit,balance]=await Promise.all([
  call(local.factory,encodeAddressCall(SELECTORS.isVault,local.demoVault)),
  call(local.factory,encodeAddressCall(SELECTORS.latestVaultOf,local.deployer)),
  call(local.demoVault,'0x8da5cb5b'),
  call(local.demoVault,'0xcb943a37'),
  call(local.demoVault,'0xd1129bf3'),
  call(local.demoVault,'0x67eeba0c'),
  call(local.mockToken,'0x70a08231'+local.demoVault.slice(2).toLowerCase().padStart(64,'0'))
 ]);
 assert.equal(BigInt(isVault),1n,'Vault missing from factory registry');
 assert.ok(eq(dataToAddress(latestVault),local.demoVault),'Factory lookup did not recover the vault');
 assert.ok(eq(dataToAddress(owner),local.deployer),'Vault owner wrong');
 assert.ok(eq(dataToAddress(recipient),local.deployer),'Vault receiver wrong');
 assert.equal(BigInt(maxTransfer),60n*10n**18n,'Per transfer limit wrong');
 assert.equal(BigInt(dailyLimit),100n*10n**18n,'Daily spending limit wrong');
 assert.ok(BigInt(balance)>0n,'Vault BTEST balance unexpectedly empty');
 rec.results.vaultState={registered:true,owner:local.deployer,recipient:local.deployer,perTransferBTEST:60,dailyBTEST:100,currentVaultBTEST:Number(BigInt(balance)/10n**18n)};

 const [allowed,denied]=await Promise.all([
  rpc('eth_getTransactionReceipt',[local.allowedTx]),
  rpc('eth_getTransactionReceipt',[local.deniedTx])
 ]);
 assert.equal(allowed.status,'0x1','Previously allowed 20 BTEST transfer failed');
 assert.equal(denied.status,'0x0','Previously denied 75 BTEST transfer unexpectedly succeeded');
 rec.results.withdrawalEvidence={allowedTx:local.allowedTx,deniedTx:local.deniedTx,allowedSuccess:true,overLimitReverted:true};

 // A creation call against current public chain state without a signature or broadcast.
 // eth_call is a local EVM state simulation, NOT a new deployed contract.
 const simulated=await call(local.factory,encodeDemoCreate(local.mockToken),local.deployer);
 const prospective=dataToAddress(simulated);
 assert.notEqual(prospective.toLowerCase(),'0x'+'0'.repeat(40));
 rec.results.simulatedCreation={success:true,prospectiveVault:prospective,committed:false};
 try{
  const estimate=await rpc('eth_estimateGas',[{from:local.deployer,to:local.factory,data:encodeDemoCreate(local.mockToken),value:'0x0'}]);
  rec.results.simulatedCreation.estimatedGas=dec(estimate);
 }catch(e){rec.results.simulatedCreation.estimatedGas='Unavailable: '+String(e.message).slice(0,100);}
 rec.result='PASS';
}catch(e){
 rec.result='FAIL';
 rec.error=String(e.stack||e.message||e);
}
await mkdir('qa/results',{recursive:true});
await writeFile('qa/results/VAULT_SIGNOFF_LIVE.json',JSON.stringify(rec,null,2)+'\n');
console.log(JSON.stringify(rec,null,2));
if(rec.result!=='PASS')process.exitCode=1;
