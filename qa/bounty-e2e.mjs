import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const web=path.join(root,'web');
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const randomPort=async()=>{const s=createServer();await new Promise(ok=>s.listen(0,'127.0.0.1',ok));const p=s.address().port;await new Promise(ok=>s.close(ok));return p};
const port=await randomPort();
const rpcURL='http://127.0.0.1:'+port;
const anvil=process.env.ANVIL_BIN||'anvil',forge=process.env.FORGE_BIN||'forge';
const processAnvil=spawn(anvil,['--host','127.0.0.1','--port',String(port),'--chain-id','46630','--silent'],{stdio:'ignore'});
const shell=(executable,args)=>new Promise((resolve,reject)=>{
 const proc=spawn(executable,args,{cwd:root,stdio:['ignore','pipe','pipe']});
 let output='',errors='';proc.stdout.on('data',d=>output+=d);proc.stderr.on('data',d=>errors+=d);
 proc.on('error',reject);proc.on('close',code=>code?reject(Error(executable+' error '+code+': '+(errors||output).slice(-900))):resolve(output));
});
async function rpc(method,params=[]){
 const res=await fetch(rpcURL,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
 const j=await res.json();if(j.error)throw Error(j.error.message);return j.result;
}
const parseToolJson=s=>{const a=s.indexOf('{'),b=s.lastIndexOf('}');if(a<0)throw Error('Missing deployment JSON');return JSON.parse(s.slice(a,b+1))};
async function deploy(name,from,args=[]){
 const res=parseToolJson(await shell(forge,['create',name,'--rpc-url',rpcURL,'--json','--broadcast','--unlocked','--from',from,...(args.length?['--constructor-args',...args]:[])]));
 if(!res.deployedTo)throw Error('Missing contract '+name);
 return res.deployedTo;
}
const site=createServer(async(req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 const rel=pathname==='/'?'index.html':pathname.endsWith('/')?pathname.slice(1)+'index.html':pathname.slice(1);
 const full=path.resolve(web,rel);
 if(!full.startsWith(web+path.sep)){res.writeHead(403);return res.end('No path');}
 try{
  let payload=await readFile(full);
  if(rel==='deployment.json'){
    const data=JSON.parse(payload.toString());
    Object.assign(data,{mockToken:mock,challengeEscrow:escrow,practiceVault:target});
    payload=Buffer.from(JSON.stringify(data));
  }
  res.writeHead(200,{'content-type':mime[path.extname(rel)]||'application/octet-stream'});
  res.end(payload);
 }catch{res.writeHead(404);res.end('Not found')}
});
const result={contracts:{},screens:[],transactions:[],status:'STARTED'};
let browser;
try {
 let ready=false;
 for(let i=0;i<80;i++){try{if(await rpc('eth_chainId')==='0xb626'){ready=true;break}}catch{}await sleep(100)}
 if(!ready)throw Error('Anvil 46630 did not start.');
 const wallets=await rpc('eth_accounts');
 assert.ok(wallets.length>=3,'Anvil must provide 3 separate mock wallets');
 const [sponsor,reviewer,solver]=wallets;
 await shell(forge,['build']);
 var mock=await deploy('src/mocks/MockERC20.sol:MockERC20',sponsor);
 var escrow=await deploy('src/WifSecurityChallenge.sol:WifSecurityChallenge',sponsor);
 var target=await deploy('src/TrainingVault.sol:TrainingVault',sponsor,[mock,(60n*10n**18n).toString()]);
 result.contracts={mock,escrow,target};
 await new Promise(ok=>site.listen(0,'127.0.0.1',ok));
 const base='http://127.0.0.1:'+site.address().port;
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 for(const width of [320,375,768,1280]){
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
  const faults=[];page.on('pageerror',e=>faults.push(e.message));
  await page.goto(base+'/app/bounty/',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(250);
  const size=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
  assert.ok(size.scroll<=size.client+1,'Bounty layout overflows at '+width);
  await page.addScriptTag({path:path.join(root,'qa/node_modules/axe-core/axe.min.js')});
  assert.equal(await page.locator('#entry-choice').isVisible(),true,'Initial screen should ask for the user goal');
  assert.equal(await page.locator('.workbench').isHidden(),true,'No blockchain forms before selecting a goal');
  assert.equal(await page.locator('#wallet-connect').isHidden(),true,'No wallet prompt before choosing a task');
  assert.equal(await page.locator('.entry-card').count(),3,'Exactly three clear entry choices');
  await page.locator('[data-start="sponsor"]').click();
  assert.ok(await page.locator('#role-sponsor').isVisible(),'Choosing sponsor should show only the creation task');
  assert.equal(await page.locator('#wallet-connect').isVisible(),true,'Wallet connection appears only inside a task');
  for(const role of ['sponsor','solver','reviewer','recover']){
   if(role!=='sponsor'){
    await page.locator('#change-goal').click();
    await page.locator('[data-start="'+role+'"]').click();
   }
   assert.ok(await page.locator('#role-'+role).isVisible(),'Role unavailable '+role);
   if(role==='solver'){
    await page.locator('#challenge-id').fill('not-a-bounty');
    await page.locator('#load-form button').click();
    assert.equal(await page.locator('#action-status').isVisible(),true,'Invalid bounty link must produce an on-screen error');
    assert.equal(await page.locator('#action-status').getAttribute('data-tone'),'error','Invalid link must be marked as an error');
    await page.locator('#activity-dismiss').click();
    assert.equal(await page.locator('#action-status').isHidden(),true,'Feedback must be dismissible');
   }
   const violations=await page.evaluate(async()=>{
    const x=await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}});
    return x.violations.map(v=>({id:v.id,impact:v.impact,targets:v.nodes.map(n=>n.target)}));
   });
   assert.deepEqual(violations,[],'Bounty accessibility violations '+width+' '+role);
  }
  assert.deepEqual(faults,[],'UI JS errors at '+width);
  result.screens.push({width,passed:true});
  await page.close();
 }
 const context=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'});
 await context.route('https://rpc.testnet.chain.robinhood.com/**',async route=>{
  const req=route.request();
  if(req.method()==='OPTIONS'){
   await route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'POST,OPTIONS'}});return;
  }
  const res=await fetch(rpcURL,{method:'POST',headers:{'content-type':'application/json'},body:req.postData()});
  await route.fulfill({status:res.status,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:await res.text()});
 });
 await context.addInitScript((accounts)=>{
  const handlers={};let active=0;
  window.ethereum={
   async request({method,params=[]}){
    if(method==='eth_chainId')return '0xb626';
    if(method==='eth_requestAccounts'||method==='eth_accounts')return [accounts[active]];
    if(method==='eth_sendTransaction'){
     const res=await fetch('https://rpc.testnet.chain.robinhood.com/',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:4,method:'eth_sendTransaction',params})});
     const body=await res.json();if(body.error)throw Error(body.error.message);return body.result;
    }
    throw Error('Unexpected wallet method '+method);
   },
   on(event,callback){(handlers[event]??=[]).push(callback)}
  };
  window.__switchTestAccount=index=>{active=index;(handlers.accountsChanged||[]).forEach(fn=>fn([accounts[active]]));};
 },wallets);
 const page=await context.newPage();const faults=[];
async function chooseTask(role){
 await page.locator('#change-goal').click();
 await page.locator('[data-start="'+role+'"]').click();
 assert.equal(await page.locator('#role-'+role).isVisible(),true,'Task '+role+' should open');
}

 page.on('pageerror',e=>faults.push(e.message));
 await page.goto(base+'/app/bounty/',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelector('#activity-text').textContent.includes('Ready.'),{timeout:25000});
 await page.locator('[data-start="sponsor"]').click();
 await page.locator('#wallet-connect').click();
 await page.waitForFunction(()=>document.querySelector('#wallet-label').textContent.includes('…'));
 await page.locator('#action-status').waitFor({state:'visible'});
 assert.equal(await page.locator('#action-status').isVisible(),true,'Wallet state must be visible where the user works');
 await page.locator('#activity-dismiss').click();
 assert.equal(await page.locator('#action-status').isHidden(),true,'User can dismiss wallet status');
 await page.locator('#reviewers').fill(reviewer);
 await page.locator('details.advanced-settings summary').click();
 await page.locator('#commit-minutes').fill('2');
 await page.locator('#reveal-minutes').fill('5');
 await page.locator('#publish-bounty').click();
 await page.waitForFunction(()=>document.querySelector('#activity-text').textContent.includes('is live'),{timeout:55000});
 assert.equal(await page.locator('#action-status').isVisible(),true,'Bounty publishing must announce its confirmation');
 assert.equal(await page.locator('#activity-link').isVisible(),true,'Confirmed action must expose a verified receipt link');
 assert.equal(await page.locator('#publish-success').isVisible(),true,'Sponsor should see a shareable success state, not solver form');
 assert.equal(await page.locator('#copy-published-link').count(),1);
 assert.equal(await page.locator('#copy-reviewer-link').count(),1);
 assert.equal(await page.locator('#role-sponsor').isVisible(),true,'Sponsor should remain in their own workflow');
 let id=await page.locator('#challenge-id').inputValue();assert.match(id,/^[1-9]\d*$/);
 result.transactions.push({stage:'create',id});
 await page.evaluate(()=>window.__switchTestAccount(2));
 await chooseTask('solver');
 await page.locator('#evidence').fill('BTEST training vault checks individual transfers but misses the daily aggregate limit.');
 await page.locator('#generate-salt').click();
 await page.waitForFunction(()=>document.querySelector('#salt').value.startsWith('0x'));
 await page.locator('#commit-finding').click();
 await page.waitForFunction(()=>document.querySelector('#activity-text').textContent.includes('Finding committed'),{timeout:45000});
 assert.equal(await page.locator('#review-handoff').isVisible(),true,'Commitment must explain the private reviewer handoff');
 assert.equal(await page.locator('#copy-review-request').isVisible(),true,'Committed finding must provide a shareable reviewer request');
 result.transactions.push({stage:'commit',id});
 await page.locator('#reveal-finding').click();
 await page.waitForFunction(()=>document.querySelector('#activity-text').textContent.includes('Reveal is allowed only within the active reveal window.'));
 await rpc('evm_increaseTime',['0x8c']);await rpc('evm_mine',[]);
 await page.locator('#reveal-finding').click();
 await page.waitForFunction(()=>document.querySelector('#activity-text').textContent.includes('Reviewer quorum has not approved'));
 await page.evaluate(()=>window.__switchTestAccount(0));
 await chooseTask('reviewer');
 await page.locator('#solver-address').fill(solver);
 await page.locator('#review-evidence').fill('BTEST training vault checks individual transfers but misses the daily aggregate limit.');
 await page.locator('#approve-finding').click();
 await page.waitForFunction(()=>document.querySelector('#activity-text').textContent.includes('not an appointed reviewer'));
 await page.evaluate(()=>window.__switchTestAccount(1));
 await page.locator('#solver-address').fill(solver);
 await page.locator('#review-evidence').fill('BTEST training vault checks individual transfers but misses the daily aggregate limit.');
 await page.locator('#approve-finding').click();
 await page.waitForFunction(()=>document.querySelector('#activity-text').textContent.includes('Reviewer approval recorded'),{timeout:30000});
 result.transactions.push({stage:'review',id});
 await page.evaluate(()=>window.__switchTestAccount(2));
 await chooseTask('solver');
 await page.locator('#evidence').fill('BTEST training vault checks individual transfers but misses the daily aggregate limit.');
 await page.locator('#reveal-finding').click();
 await page.waitForFunction(()=>document.querySelector('#activity-text').textContent.includes('settled'),{timeout:45000});
 assert.equal(await page.locator('#summary-state').innerText(),'Closed');
 result.transactions.push({stage:'settle',id});
 // Sponsor cancellation, with zero commitments.
 await page.evaluate(()=>window.__switchTestAccount(0));
 await chooseTask('sponsor');
 await page.locator('#publish-bounty').click();
 await page.waitForFunction(()=>document.querySelector('#activity-text').textContent.includes('is live'),{timeout:55000});
 id=await page.locator('#challenge-id').inputValue();
 await chooseTask('recover');
 await page.locator('#cancel-bounty').click();
 await page.waitForFunction(()=>document.querySelector('#activity-text').textContent.includes('Cancel unused bounty confirmed onchain'),{timeout:30000});
 assert.equal(await page.locator('#summary-state').innerText(),'Canceled');
 result.transactions.push({stage:'cancel',id});
 // Expiry and both refunds on a third challenge.
 await chooseTask('sponsor');
 await page.locator('#publish-bounty').click();
 await page.waitForFunction(()=>document.querySelector('#activity-text').textContent.includes('is live'),{timeout:55000});
 id=await page.locator('#challenge-id').inputValue();
 await page.evaluate(()=>window.__switchTestAccount(2));
 await chooseTask('solver');
 await page.locator('#evidence').fill('BTEST training vault checks individual transfers but misses the daily aggregate limit.');
 await page.locator('#generate-salt').click();
 await page.locator('#commit-finding').click();
 await page.waitForFunction(()=>document.querySelector('#activity-text').textContent.includes('Finding committed'),{timeout:45000});
 await rpc('evm_increaseTime',['0x190']);await rpc('evm_mine',[]);
 await page.evaluate(()=>window.__switchTestAccount(0));
 await chooseTask('recover');
 await page.locator('#refund-reward').click();
 await page.waitForFunction(()=>document.querySelector('#activity-text').textContent.includes('Refund expired reward confirmed onchain'),{timeout:30000});
 await page.evaluate(()=>window.__switchTestAccount(2));
 await page.locator('#refund-bond').click();
 await page.waitForFunction(()=>document.querySelector('#activity-text').textContent.includes('Refund unanswered bond confirmed onchain'),{timeout:30000});
 result.transactions.push({stage:'refund',id});
 const escrowBTEST=BigInt(await rpc('eth_call',[{to:mock,data:'0x70a08231'+escrow.slice(2).toLowerCase().padStart(64,'0')},'latest']));
 assert.equal(escrowBTEST,0n,'No synthetic BTEST remains in escrow after settlement, cancellation and expiry');
 assert.deepEqual(faults,[],'Bounty JS errors');
 result.status='PASS';
 console.log(JSON.stringify(result,null,2));
 await context.close();
}finally{
 if(browser)await browser.close().catch(()=>{});
 await new Promise(ok=>site.close(ok));
 processAnvil.kill('SIGTERM');
}
