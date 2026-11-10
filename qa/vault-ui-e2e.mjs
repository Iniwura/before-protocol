#!/usr/bin/env node
// Browser acceptance of the shipping Protect UI against a real temporary local Anvil 46630.
// Calls a local unlocked test account (no secret); NO public-chain signing, no valuable assets.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const web=path.join(root,'web');
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json'};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function openPort(){const s=createServer();await new Promise(ok=>s.listen(0,'127.0.0.1',ok));const port=s.address().port;await new Promise(ok=>s.close(ok));return port}
const port=await openPort(),rpcURL='http://127.0.0.1:'+port;
const anvil=spawn(process.env.ANVIL_BIN||'anvil',['--host','127.0.0.1','--port',String(port),'--chain-id','46630','--silent'],{stdio:'ignore'});
const shell=(executable,args)=>new Promise((resolve,reject)=>{
 const proc=spawn(executable,args,{cwd:root,stdio:['ignore','pipe','pipe']});
 let output='',errors='';proc.stdout.on('data',d=>output+=d);proc.stderr.on('data',d=>errors+=d);
 proc.on('error',reject);proc.on('close',code=>code?reject(Error(executable+' failed: '+(errors||output).slice(-1000))):resolve(output));
});
async function rpc(method,params=[]){
 const res=await fetch(rpcURL,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
 const j=await res.json();if(j.error)throw Error(JSON.stringify(j.error));return j.result;
}
const extract=s=>{const a=s.indexOf('{'),b=s.lastIndexOf('}');if(a<0||b<a)throw Error('No Foundry JSON');return JSON.parse(s.slice(a,b+1))};
async function deploy(name,owner){
 const j=extract(await shell('forge',['create',name,'--rpc-url',rpcURL,'--json','--broadcast','--unlocked','--from',owner]));
 if(!j.deployedTo)throw Error('Deploy failed: '+name);
 return j.deployedTo;
}
const outputDir=path.join(root,'qa/results/vault-ui');
await mkdir(outputDir,{recursive:true});
let config,server,browser;
const result={checkedAt:new Date().toISOString(),network:46630,environment:'disposable local Anvil; production frontend source',steps:[],status:'STARTED',broadcastsToPublicChain:0};
const asAddr=h=>'0x'+h.slice(-40), word=a=>a.slice(2).toLowerCase().padStart(64,'0');
const btest=amount=>BigInt(amount)*10n**18n;
const toNum=h=>BigInt(h);
const balance=async(token,wallet)=>toNum(await rpc('eth_call',[{to:token,data:'0x70a08231'+word(wallet)},'latest']));
try{
 let started=false;
 for(let n=0;n<100;n++){try{if(await rpc('eth_chainId')==='0xb626'){started=true;break}}catch{}await sleep(100)}
 assert.ok(started,'Temporary local testnet did not start');
 const accounts=await rpc('eth_accounts');
 assert.ok(accounts.length>=2);
 const owner=accounts[0];
 await shell('forge',['build']);
 const token=await deploy('src/mocks/MockERC20.sol:MockERC20',owner);
 const factory=await deploy('src/BeforeFactory.sol:BeforeFactory',owner);
 const escrow=await deploy('src/WifSecurityChallenge.sol:WifSecurityChallenge',owner);
 config={chainId:46630,factory,mockToken:token,challengeEscrow:escrow,verified:true,
   factoryTx:'0x'+'1'.repeat(64),mockTokenTx:'0x'+'2'.repeat(64),challengeEscrowTx:'0x'+'3'.repeat(64)};
 server=createServer(async(req,res)=>{
  let pathname=new URL(req.url,'http://localhost').pathname;
  const rel=pathname==='/app/'?'app/index.html':pathname.startsWith('/')?pathname.slice(1):pathname;
  const full=path.resolve(web,rel);
  if(!full.startsWith(web+path.sep)){res.writeHead(403);return res.end('Path denied')}
  try{
    const bytes=rel==='deployment.json'?Buffer.from(JSON.stringify(config)):await readFile(full);
    res.writeHead(200,{'content-type':mime[path.extname(rel)]||'application/octet-stream'});
    res.end(bytes);
  }catch{res.writeHead(404);res.end('Not found')}
 });
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'});
 await context.route('https://rpc.testnet.chain.robinhood.com/**',async route=>{
   if(route.request().method()==='OPTIONS'){await route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'POST,OPTIONS'}});return;}
   const req=route.request(),r=await fetch(rpcURL,{method:'POST',headers:{'content-type':'application/json'},body:req.postData()});
   await route.fulfill({status:r.status,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:await r.text()});
 });
 await context.addInitScript(({owner})=>{
  window.ethereum={
    async request({method,params=[]}){
      if(method==='eth_requestAccounts'||method==='eth_accounts')return [owner];
      if(method==='eth_chainId')return '0xb626';
      if(method==='eth_sendTransaction'){
       const r=await fetch('https://rpc.testnet.chain.robinhood.com/',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:17,method,params})});
       const j=await r.json();if(j.error)throw Error(j.error.message);return j.result;
      }
      throw Error('Unexpected wallet request '+method);
    },
    on(){}
  };
 },{owner});
 const page=await context.newPage(),pageErrors=[];
 page.on('pageerror',e=>pageErrors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/app/',{waitUntil:'domcontentloaded'});
 await page.locator('#onchain-protect').waitFor({state:'visible',timeout:30000});
 await page.locator('#tab-protect').click();
 assert.equal(await page.locator('#create-demo-vault').isVisible(),true,'Real onchain button unavailable');
 await page.screenshot({path:path.join(outputDir,'01-create-test-vault.png')});
 result.steps.push({step:'Create test vault button available after deployment validation',passed:true});
 await page.locator('#create-demo-vault').click();
 await page.waitForFunction(()=>document.querySelector('#onchain-protect-status')?.textContent?.includes('Vault registered:'),null,{timeout:50000});
 assert.equal(await page.locator('#demo-withdraw').isVisible(),true);
 const vault=await page.locator('#vault-address').inputValue();
 assert.match(vault,/^0x[0-9a-fA-F]{40}$/);
 const [registry,ownerResult,recipientResult,max,daily]=await Promise.all([
   rpc('eth_call',[{to:factory,data:'0x652b9b41'+word(vault)},'latest']),
   rpc('eth_call',[{to:vault,data:'0x8da5cb5b'},'latest']),
   rpc('eth_call',[{to:vault,data:'0xcb943a37'},'latest']),
   rpc('eth_call',[{to:vault,data:'0xd1129bf3'},'latest']),
   rpc('eth_call',[{to:vault,data:'0x67eeba0c'},'latest'])
 ]);
 assert.equal(toNum(registry),1n);
 assert.equal(asAddr(ownerResult).toLowerCase(),owner.toLowerCase());
 assert.equal(asAddr(recipientResult).toLowerCase(),owner.toLowerCase());
 assert.equal(toNum(max),btest(60));
 assert.equal(toNum(daily),btest(100));
 assert.equal(await balance(token,vault),btest(150));
 await page.screenshot({path:path.join(outputDir,'02-vault-created.png')});
 result.steps.push({step:'Wallet-approved CREATE produced real local onchain vault',passed:true,vault,owner,registry:true,initialBTEST:150,maxPerTransfer:60,maxDaily:100});
 await page.locator('#demo-withdraw').click();
 await page.waitForFunction(()=>document.querySelector('#onchain-protect-status')?.textContent?.includes('Real testnet withdrawal confirmed.'),null,{timeout:50000});
 assert.equal(await balance(token,vault),btest(130));
 assert.equal(await balance(token,owner),btest(20));
 await page.screenshot({path:path.join(outputDir,'03-withdraw-success.png')});
 result.steps.push({step:'Wallet-confirmed 20 BTEST withdrawal settled on local chain',passed:true,remainingBTEST:130,withdrawnBTEST:20});
 // Actual EVM policy enforcement: a 75-BTEST transfer is over the 60 limit.
 // State-changing attempt is restricted to disposable Anvil.
 const overLimit='0xf3fef3a3'+word(owner)+btest(75).toString(16).padStart(64,'0');
 let rejected=false;
 try{
   const hash=await rpc('eth_sendTransaction',[{from:owner,to:vault,data:overLimit,gas:'0x1e8480',value:'0x0'}]);
   const tx=await rpc('eth_getTransactionReceipt',[hash]);
   assert.equal(tx.status,'0x0','Over-limit transaction unexpectedly succeeded');
   rejected=true;
 }catch(error){
   if(/revert|exceed|limit|execution/i.test(error.message))rejected=true;
   else throw error;
 }
 assert.ok(rejected,'75 BTEST withdrawal not rejected');
 assert.equal(await balance(token,vault),btest(130),'Rejected action modified vault balance');
 result.steps.push({step:'Over-limit 75 BTEST withdrawal reverted without loss',passed:true,remainingBTEST:130});
 assert.deepEqual(pageErrors,[],'Browser JavaScript errors');
 await context.close();
 // Actual hosted site, without injecting a wallet or redirecting production RPC.
 const prod=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'});
 const live=await prod.newPage();
 const liveErrors=[];
 live.on('pageerror',e=>liveErrors.push(e.message));
 await live.goto('https://before-web-theta.vercel.app/app/',{waitUntil:'domcontentloaded',timeout:55000});
 await live.locator('#onchain-protect').waitFor({state:'visible',timeout:45000});
 assert.equal(await live.locator('#create-demo-vault').isVisible(),true,'Production must expose Create test vault after public contract checks');
 assert.equal(await live.locator('#network-status-text').innerText(),'Testnet · Connected');
 await live.screenshot({path:path.join(outputDir,'04-production-vault-button.png')});
 await live.locator('#create-demo-vault').click();
 await live.waitForFunction(()=>document.querySelector('#onchain-protect-status')?.textContent?.includes('Connect an EVM browser wallet'),null,{timeout:15000});
 assert.doesNotMatch(await live.locator('#onchain-protect-status').innerText(),/Vault registered:/,'Walletless visit must not fake creation');
 assert.deepEqual(liveErrors,[],'Production browser JS errors');
 result.steps.push({step:'Public production site exposes Create test vault and requires a real EVM wallet',passed:true,url:'https://before-web-theta.vercel.app/app/#protect'});
 await prod.close();
 result.status='PASS';
}catch(error){result.status='FAIL';result.error=String(error.stack||error);}
finally{
 await writeFile(path.join(outputDir,'REPORT.json'),JSON.stringify(result,null,2)+'\n');
 if(browser)await browser.close().catch(()=>{});
 if(server)await new Promise(r=>server.close(r));
 anvil.kill('SIGTERM');
 console.log(JSON.stringify(result,null,2));
}
if(result.status!=='PASS')process.exitCode=1;
