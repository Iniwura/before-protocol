#!/usr/bin/env node
// Real public-testnet or disposable-local lifecycle runner for valueless BTEST only.
// Local mode starts its own Anvil. Public mode requires the user's EXISTING encrypted
// Foundry account and a password file. NEVER prints or stores private keys.
// The demo actors are synthetic and all controlled by one operator. Their approvals
// prove contract behavior, not independent security review.
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {fileURLToPath} from 'node:url';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const mode=process.argv.includes('--testnet')?'testnet':process.argv.includes('--local')?'local':null;
if (!mode) throw Error('Use --local or --testnet. Never infer the network.');
const forge=process.env.FORGE_BIN||'forge';
const cast=process.env.CAST_BIN||'cast';
const anvilBin=process.env.ANVIL_BIN||'anvil';
const testnetRPC='https://rpc.testnet.chain.robinhood.com';
const explorer='https://explorer.testnet.chain.robinhood.com';
const addressPattern=/^0x[a-fA-F0-9]{40}$/;
const hashPattern=/^0x[a-fA-F0-9]{64}$/;
let anvilProcess;

function run(cmd,args,{env=process.env}={}){
 return new Promise((resolve,reject)=>{
   const child=spawn(cmd,args,{cwd:root,env,stdio:['ignore','pipe','pipe']});
   let stdout='',stderr='';
   child.stdout.on('data',buf=>stdout+=buf);
   child.stderr.on('data',buf=>stderr+=buf);
   child.once('error',reject);
   child.once('close',code=>{
     if(code!==0)reject(Error(cmd+' returned '+code+': '+(stderr||stdout).slice(-1600)));
     else resolve({stdout,stderr});
   });
 });
}
async function rpc(url,method,params=[]){
 const c=new AbortController(),timeout=setTimeout(()=>c.abort(),15000);
 try{
  const res=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:c.signal});
  const body=await res.json();
  if(!res.ok||body.error||body.result===undefined)throw Error(body.error?.message||'Bad RPC response: '+method);
  return body.result;
 }finally{clearTimeout(timeout)}
}
async function port(){
 const s=createServer();await new Promise(ok=>s.listen(0,'127.0.0.1',ok));
 const n=s.address().port;await new Promise(ok=>s.close(ok));return n;
}
function parseJSON(out){
 const start=out.indexOf('{'),end=out.lastIndexOf('}');
 if(start<0||end<start)throw Error('Tool returned no JSON: '+out.slice(0,600));
 return JSON.parse(out.slice(start,end+1));
}
function assertAddr(value,label){
 if(!addressPattern.test(value||''))throw Error('Invalid '+label+': '+String(value));
 return value;
}
function toBigInt(x){return BigInt(String(x).split(' ')[0]);}
async function send(rpcURL,flags,contract,signature=[]){
 const args=['send',contract,...signature,'--rpc-url',rpcURL,'--json',...flags];
 const receipt=parseJSON((await run(cast,args)).stdout);
 const hash=receipt.transactionHash;
 if(!hashPattern.test(hash||'')||receipt.status!=='0x1')throw Error('Transaction not successful: '+JSON.stringify({hash,status:receipt.status,contract}));
 return hash;
}
async function deploy(rpcURL,flags,name,constructorArgs=[]){
 const args=['create',name,'--rpc-url',rpcURL,'--json','--broadcast',...flags];
 if(constructorArgs.length)args.push('--constructor-args',...constructorArgs);
 const value=parseJSON((await run(forge,args)).stdout);
 const addr=assertAddr(value.deployedTo,'deployed contract');
 const hash=value.transactionHash;
 if(!hashPattern.test(hash||''))throw Error('Missing deployment receipt hash for '+name);
 const r=await rpc(rpcURL,'eth_getTransactionReceipt',[hash]);
 if(!r||r.status!=='0x1'||r.contractAddress?.toLowerCase()!==addr.toLowerCase())throw Error('Deployment receipt mismatch '+name);
 return {address:addr,tx:hash};
}
async function readValue(url,to,signature){
 const {stdout}=await run(cast,['call',to,signature,'--rpc-url',url]);
 return stdout.trim().split(' ')[0];
}
async function readAmount(url,token,address){
 return toBigInt(await readValue(url,token,'balanceOf(address)(uint256)',address));
}
async function requireStage(url,addr,stage){
 const current=toBigInt(await readValue(url,addr,'stage()(uint8)'));
 if(current!==BigInt(stage))throw Error('Bounty demo stage is '+current+', expected '+stage);
}
async function waitUntil(url,deadline,local){
 if(local){
   const block=await rpc(url,'eth_getBlockByNumber',['latest',false]);
   const needed=BigInt(deadline)+1n-BigInt(block.timestamp);
   if(needed>0)await rpc(url,'evm_increaseTime',['0x'+needed.toString(16)]);
   await rpc(url,'evm_mine',[]);
   return;
 }
 // Public testnet progress is driven only by mined blocks, never forged time.
 for(let i=0;i<360;i++){
   const head=await rpc(url,'eth_getBlockByNumber',['latest',false]);
   if(BigInt(head.timestamp)>BigInt(deadline))return;
   await wait(2000);
 }
 throw Error('Testnet deadline was not reached in this run. Resume later, do not fabricate a receipt.');
}

async function main(){
 let url,flags=[],sender,local=mode==='local';
 if(local){
   const p=await port();url='http://127.0.0.1:'+p;
   anvilProcess=spawn(anvilBin,['--host','127.0.0.1','--port',String(p),'--chain-id','31337','--silent'],{cwd:root,stdio:'ignore'});
   for(let i=0;i<60;i++){
     try {if(await rpc(url,'eth_chainId')==='0x7a69')break}catch{}
     await wait(150);
   }
   if(await rpc(url,'eth_chainId')!=='0x7a69')throw Error('Local Anvil did not start.');
   sender=(await rpc(url,'eth_accounts'))[0];
   flags=['--unlocked','--from',assertAddr(sender,'unlocked Anvil sender')];
 }else{
   url=process.env.BEFORE_TESTNET_RPC||testnetRPC;
   if(url!==testnetRPC)throw Error('Public demo requires the canonical Robinhood testnet RPC.');
   const account=process.env.BEFORE_SIGNER_ACCOUNT||'before-testnet';
   const passwordFile=process.env.BEFORE_KEYSTORE_PASSWORD_FILE;
   if(!passwordFile)throw Error('Set BEFORE_KEYSTORE_PASSWORD_FILE to your existing encrypted signer password file. No secrets in arguments or source.');
   flags=['--account',account,'--password-file',passwordFile];
 }
 const chainId=Number(BigInt(await rpc(url,'eth_chainId')));
 if(chainId!==(local?31337:46630))throw Error('Wrong network. Refusing all broadcasts.');
 const manifest=JSON.parse(await readFile(path.join(root,'web/deployment.json'),'utf8'));
 if(!manifest.verified||Number(manifest.chainId)!==46630)throw Error('Release manifest must be verified.');
 let token,escrow,target;
 const deployments=[];
 if(local){
   const x=await deploy(url,flags,'src/mocks/MockERC20.sol:MockERC20');token=x.address;deployments.push(x);
   const e=await deploy(url,flags,'src/WifSecurityChallenge.sol:WifSecurityChallenge');escrow=e.address;deployments.push(e);
   const t=await deploy(url,flags,'src/TrainingVault.sol:TrainingVault',[token,(60n*10n**18n).toString()]);target=t.address;deployments.push(t);
 }else{
   token=assertAddr(manifest.mockToken,'public BTEST');
   escrow=assertAddr(manifest.challengeEscrow,'public escrow');
   target=assertAddr(manifest.practiceVault,'public TrainingVault');
   if((await rpc(url,'eth_getCode',[token,'latest']))==='0x'||(await rpc(url,'eth_getCode',[escrow,'latest']))==='0x'||(await rpc(url,'eth_getCode',[target,'latest']))==='0x')throw Error('Public proof contract missing.');
 }
 const initial=await readAmount(url,token,escrow);
 const demo=await deploy(url,flags,'src/mocks/BountyLifecycleDemo.sol:BountyLifecycleDemo',[escrow,token,target]);
 await requireStage(url,demo.address,0);
 const started=await send(url,flags,demo.address,['start()']);
 await requireStage(url,demo.address,1);
 if(await readAmount(url,token,escrow)!==initial+330n*10n**18n)throw Error('Start accounting mismatch.');
 const settleAfter=toBigInt(await readValue(url,demo.address,'settleAfter()(uint64)'));
 const cleanupAfter=toBigInt(await readValue(url,demo.address,'cleanupAfter()(uint64)'));
 await waitUntil(url,settleAfter,local);
 const settled=await send(url,flags,demo.address,['settle()']);
 await requireStage(url,demo.address,2);
 if(await readAmount(url,token,escrow)!==initial+100n*10n**18n)throw Error('Settlement accounting mismatch.');
 await waitUntil(url,cleanupAfter,local);
 const completed=await send(url,flags,demo.address,['cleanup()']);
 await requireStage(url,demo.address,3);
 if(await readAmount(url,token,escrow)!==initial)throw Error('Cleanup accounting mismatch.');
 const roles={};
 for(const [key,signature] of Object.entries({sponsor:'sponsor()(address)',solver:'solver()(address)',reviewerOne:'reviewerOne()(address)',reviewerTwo:'reviewerTwo()(address)'})){
   roles[key]=assertAddr(await readValue(url,demo.address,signature),key);
 }
 const ids={};
 for(const [key,signature] of Object.entries({paid:'paidId()(uint256)',invalid:'invalidId()(uint256)',expired:'expiredId()(uint256)',canceled:'canceledId()(uint256)'})){
   ids[key]=String(toBigInt(await readValue(url,demo.address,signature)));
 }
 const transactions={...Object.fromEntries(deployments.map((d,i)=>['preparation'+(i+1),d.tx])),deploy:demo.tx,start:started,settle:settled,cleanup:completed};
 const report={
  mode,chainId,verified:true,tokenType:'freely mintable BTEST only',valuableWifFunded:false,
  independentReview:false,roleDisclosure:'Synthetic sponsor/solver/reviewers controlled by one operator, not independent reviewers.',
  address:demo.address,escrow,token,target,roles,challengeIds:ids,
  transactions,
  explorerLinks:local?{}:Object.fromEntries(Object.entries(transactions).map(([k,v])=>[k,explorer+'/tx/'+v])),
  proof:{stage:3,initialEscrowBalance:initial.toString(),finalEscrowBalance:(await readAmount(url,token,escrow)).toString(),paid:100,invalidBondSlashed:10,expiredRewardRefunded:100,expiredBondRefunded:10,canceledRewardRefunded:100,invalidRewardRefunded:100}
 };
 const dir=path.join(root,'out');await mkdir(dir,{recursive:true});
 const reportFile=path.join(dir,local?'bounty-local-report.json':'bounty-testnet-report.json');
 await writeFile(reportFile,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({result:'PASS',mode,chainId,reportFile,address:demo.address,transactions,escrowMockBalance:report.proof.finalEscrowBalance,independentReview:false},null,2));
}
try{await main()}finally{if(anvilProcess){anvilProcess.kill('SIGTERM');}}
