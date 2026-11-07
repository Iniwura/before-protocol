import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';
import {encodeDemoCreate,encodeDemoWithdraw,encodePracticeCreate,encodePracticeProof} from '../web/onchain.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../web');
const mime = { '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.css':'text/css; charset=utf-8' };
const allowed = new Set(['index.html','landing.css','landing.js','app/index.html','app/bounty/index.html','app/wif/index.html','wif.css','wif.js','wif-core.mjs','bounty.css','bounty.js','bounty-core.mjs','bounty-verifier.json','styles.css','app.js','core.mjs','onchain.mjs','deployment.json','bounty-proof.json','favicon.svg']);
const server = createServer(async(req,res)=>{
  const pathname = new URL(req.url,'http://localhost').pathname;
  const file = pathname==='/'?'index.html':pathname==='/app/'||pathname==='/app'?'app/index.html':pathname==='/app/bounty/'||pathname==='/app/bounty'?'app/bounty/index.html':pathname.slice(1);
  if (!allowed.has(file)) {res.writeHead(404);res.end('Not found');return;}
  try {
    const data=await readFile(path.join(root,file));
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});
    res.end(data);
  } catch {res.writeHead(404);res.end('Not found');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const base=origin+'/app/';
const browser=await chromium.launch({headless:true});
const fixture={owner:'0x'+'3'.repeat(40),factory:'0x'+'1'.repeat(40),mockToken:'0x'+'2'.repeat(40),challengeEscrow:'0x'+'6'.repeat(40),vault:'0x'+'4'.repeat(40),arena:'0x'+'5'.repeat(40),practiceVault:'0x'+'7'.repeat(40),tx:'0x'+'a'.repeat(64),demoTx:'0x'+'b'.repeat(64),practiceTx:'0x'+'c'.repeat(64),allowedTx:'0x'+'d'.repeat(64),deniedTx:'0x'+'e'.repeat(64),practiceProofTx:'0x'+'f'.repeat(64)};
const failClosedManifest={chainId:46630,factory:null,mockToken:null,challengeEscrow:null,arena:null,demoTx:null,practiceTx:null,deployer:null,demoVault:null,practiceArena:null,practiceVault:null,allowedTx:null,deniedTx:null,practiceProofTx:null,practiceSolver:null,verified:false,factoryTx:null,mockTokenTx:null,challengeEscrowTx:null};
const padding=addr=>'0x'+'0'.repeat(24)+addr.slice(2);
const transactionRecord=(hash,to,input)=>({hash,from:fixture.owner,to,input,value:'0x0'});
const walletTransactions={
  [fixture.demoTx.toLowerCase()]:transactionRecord(fixture.demoTx,fixture.factory,encodeDemoCreate(fixture.mockToken)),
  [fixture.allowedTx.toLowerCase()]:transactionRecord(fixture.allowedTx,fixture.vault,encodeDemoWithdraw(fixture.owner)),
  [fixture.deniedTx.toLowerCase()]:transactionRecord(fixture.deniedTx,fixture.vault,encodeDemoWithdraw(fixture.owner)),
  [fixture.practiceTx.toLowerCase()]:transactionRecord(fixture.practiceTx,fixture.factory,encodePracticeCreate(fixture.mockToken)),
  [fixture.practiceProofTx.toLowerCase()]:transactionRecord(fixture.practiceProofTx,fixture.arena,encodePracticeProof())
};
function routeRPC(page,{code='0x60016000',codeByAddress={},receiptStatus='0x1',nextChallengeId='0x'+'0'.repeat(63)+'1',transactions=walletTransactions,bountyProof=null}={}) {
  return page.route('https://rpc.testnet.chain.robinhood.com/**', route=>{
    const request=JSON.parse(route.request().postData()||'{}');
    let result=null;
    switch(request.method) {
      case 'eth_chainId':result='0xb626';break;
      case 'eth_blockNumber':result='0x10';break;
      case 'eth_getCode':result=codeByAddress[request.params?.[0]?.toLowerCase()]??code;break;
      case 'eth_getTransactionReceipt':{
        const hash=request.params?.[0]?.toLowerCase();
        const transaction=transactions[hash];
        result=transaction?{status:hash===fixture.deniedTx.toLowerCase()?'0x0':receiptStatus,blockNumber:'0x10',transactionHash:transaction.hash,from:transaction.from,to:transaction.to}:null;
        break;
      }
      case 'eth_getTransactionByHash':result=transactions[request.params?.[0]?.toLowerCase()]??null;break;
      case 'eth_call':{
        const selector=request.params?.[0]?.data?.slice(0,10);
        const to=request.params?.[0]?.to?.toLowerCase();
        if(bountyProof&&to===bountyProof.demo.toLowerCase()){
          const demoResults={
            '0xc040e6b8':'0x'+'0'.repeat(63)+'3',
            '0x570ca735':padding(bountyProof.operator),
            '0xe2fdcc17':padding(bountyProof.escrow),
            '0xfc0c546a':padding(bountyProof.token),
            '0xd4b83992':padding(bountyProof.target)
          };
          result=demoResults[selector]??'0x'+'0'.repeat(63)+'1';
        }else result=selector==='0xee643f9e'?padding(fixture.vault):selector==='0x7f81587e'?padding(fixture.arena):selector==='0xfc67aa50'?nextChallengeId:'0x'+'0'.repeat(63)+'1';
        break;
      }
    }
    return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({jsonrpc:'2.0',id:1,result})});
  });
}
async function axeViolations(page){
  return page.evaluate(async()=>{
    const {violations}=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});
    return violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}));
  });
}
// Public landing should not masquerade as an active wallet product; every link has a working app target.
const landingContext=await browser.newContext({viewport:{width:375,height:820},reducedMotion:'reduce'});
const landingPage=await landingContext.newPage();
await landingPage.goto(origin+'/',{waitUntil:'domcontentloaded'});
assert.match(await landingPage.title(),/BEFORE/,'Landing title must identify the product');
assert.equal(await landingPage.locator('h1').innerText(),'BEFORE®','Landing has its own editorial hero');
assert.equal(await landingPage.locator('a.header-launch').getAttribute('href'),'/app/bounty/','Primary CTA opens user-focused bounty application');
assert.ok(await landingPage.locator('a[href="/app/wif/"]').count()>=1,'Real WIF permission inspector must be accessible from landing');
assert.ok(await landingPage.locator('a[href="/app/bounty/"]').count()>=1,'Public landing must open Bounty Studio');
for(const section of ['protect','challenge','proof']){
  assert.equal(await landingPage.locator('a.experience-row[href="/app/#'+section+'"]').count(),1,'Landing deep link missing: '+section);
}
assert.match(await landingPage.locator('.bounty-caveat').innerText(),/No real WIF is deposited/i,'Landing must clearly exclude real WIF deposits');
await landingPage.addScriptTag({path:path.join(here,'node_modules/axe-core/axe.min.js')});
assert.deepEqual(await axeViolations(landingPage),[],'Public landing page must meet WCAG');
const landingSize=await landingPage.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
assert.ok(landingSize.scroll<=landingSize.client+1,'Landing must not overflow on mobile');
await landingPage.goto(origin+'/#proof');
await landingPage.waitForURL(origin+'/app/#proof');
assert.equal(await landingPage.locator('#tab-proof').getAttribute('aria-selected'),'true','Legacy Proof link must still open Proof');
await landingContext.close();

const problems=[];
let audited=0;
try {
  for(const width of [320,375,768,1280]) {
    const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
    const page=await context.newPage();
    page.on('pageerror',error=>problems.push(width+' browser: '+error.message));
    await routeRPC(page);
    await page.route('**/deployment.json',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(failClosedManifest)}));
    await page.goto(base,{waitUntil:'domcontentloaded'});
    await page.addScriptTag({path:path.join(here,'node_modules/axe-core/axe.min.js')});
    for(const tab of ['protect','challenge','proof']){
      await page.locator('#tab-'+tab).click();
      const result=await page.evaluate(async()=> {
        const {violations}=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});
        return violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.length}));
      });
      if(result.length) problems.push(JSON.stringify({width,tab,result}));
      audited++;
    }
    assert.equal(await page.locator('.app-tabs').evaluate(el=>getComputedStyle(el).position),'sticky','Navigation should stay accessible while scrolling');
    const sizes=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
    if(sizes.scroll>sizes.client+1) problems.push(width+' horizontal overflow: '+JSON.stringify(sizes));
    assert.equal(await page.locator('#onchain-protect').isHidden(),true,'Unverified deployment must not unlock transactions');
    assert.equal(await page.locator('#onchain-challenge').isHidden(),true,'Unverified deployment must not unlock challenges');
    assert.equal(await page.locator('#onchain-escrow').isHidden(),true,'Unverified deployment must not expose escrow state');
    assert.equal(await page.locator('#receipt-shortcuts').isHidden(),true,'Unverified deployment must not expose receipt shortcuts');
    assert.equal(await page.locator('#bounty-proof').isHidden(),true,'Unverified deployment must not reveal bounty evidence');
    if (width===1280) {
      await page.locator('#tab-protect').focus();
      await page.keyboard.press('ArrowRight');
      assert.equal(await page.evaluate(()=>document.activeElement?.id),'tab-challenge');
      await page.keyboard.press('End');
      assert.equal(await page.evaluate(()=>document.activeElement?.id),'tab-proof');
      await page.keyboard.press('Home');
      assert.equal(await page.evaluate(()=>document.activeElement?.id),'tab-protect');
      await page.locator('#tab-protect').click();
      await page.locator('#protect-amount').fill('20');
      await page.locator('#protect-spent').fill('40');
      assert.equal(await page.locator('#protect-result-title').innerText(),'Within policy.','Policy preview should respond immediately to input');
      await page.locator('#protect-form button').click();
      assert.equal(await page.locator('#protect-result-title').innerText(),'Within policy.');
      await page.locator('input[name="destination"][value="other"]').check();
      await page.locator('#protect-form button').click();
      assert.match(await page.locator('#protect-result-text').innerText(),/not approved/);
      await page.locator('#tab-challenge').click();
      await page.locator('#challenge-form button').click();
      assert.match(await page.locator('#challenge-verdict').innerText(),/breaks the intended daily limit/);
      await page.locator('#tab-proof').click();
      await page.locator('#tx-hash').fill('malformed');
      await page.locator('#tx-form button').click();
      assert.match(await page.locator('#tx-result').innerText(),/valid 0x-prefixed/);
    }
    await context.close();
  }
  const missingCodeContext=await browser.newContext({viewport:{width:1280,height:850},reducedMotion:'reduce'});
  const missingCodePage=await missingCodeContext.newPage();
  await routeRPC(missingCodePage,{code:'0x'});
  await missingCodePage.route('**/deployment.json',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({chainId:46630,factory:fixture.factory,mockToken:fixture.mockToken,challengeEscrow:fixture.challengeEscrow,factoryTx:fixture.tx,mockTokenTx:fixture.tx,challengeEscrowTx:fixture.tx,verified:true})}));
  await missingCodePage.goto(base,{waitUntil:'domcontentloaded'});
  await missingCodePage.waitForTimeout(100);
  assert.equal(await missingCodePage.locator('#onchain-protect').isHidden(),true,'Missing runtime code must keep wallet actions hidden');
  assert.equal(await missingCodePage.locator('#onchain-challenge').isHidden(),true,'Missing runtime code must keep challenge actions hidden');
  assert.equal(await missingCodePage.locator('#proof-escrow').innerText(),'Not configured','Missing runtime code must not display escrow as live');
  await missingCodeContext.close();

  const completeManifest={
    chainId:46630,factory:fixture.factory,mockToken:fixture.mockToken,challengeEscrow:fixture.challengeEscrow,
    factoryTx:fixture.tx,mockTokenTx:fixture.tx,challengeEscrowTx:fixture.tx,verified:true,
    deployer:fixture.owner,demoVault:fixture.vault,practiceArena:fixture.arena,practiceVault:fixture.practiceVault,
    demoTx:fixture.demoTx,practiceTx:fixture.practiceTx,allowedTx:fixture.allowedTx,deniedTx:fixture.deniedTx,
    practiceProofTx:fixture.practiceProofTx,practiceSolver:fixture.owner
  };
  const missingOutputContext=await browser.newContext({viewport:{width:1280,height:850},reducedMotion:'reduce'});
  const missingOutputPage=await missingOutputContext.newPage();
  await routeRPC(missingOutputPage,{codeByAddress:{[fixture.vault.toLowerCase()]:'0x'}});
  await missingOutputPage.route('**/deployment.json',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(completeManifest)}));
  await missingOutputPage.goto(base,{waitUntil:'domcontentloaded'});
  await missingOutputPage.waitForTimeout(150);
  assert.equal(await missingOutputPage.locator('#onchain-protect').isHidden(),true,'Missing verified output code must keep wallet actions hidden');
  assert.equal(await missingOutputPage.locator('#proof-demo-meta').getAttribute('hidden'),'','Missing verified output code must keep Proof evidence hidden');
  await missingOutputContext.close();

  const bountyProof={verified:true,chainId:46630,demo:'0x'+'8'.repeat(40),
    escrow:fixture.challengeEscrow,token:fixture.mockToken,target:fixture.practiceVault,
    operator:fixture.owner,reviewType:'synthetic',valuableWifFunded:false,
    transactions:{start:'0x'+'1'.repeat(64),settle:'0x'+'2'.repeat(64),cleanup:'0x'+'3'.repeat(64)}
  };
  const bountyTransactions={...walletTransactions,
    ...Object.fromEntries(Object.values(bountyProof.transactions).map(hash=>[hash.toLowerCase(),transactionRecord(hash,bountyProof.demo,'0x')]))
  };
  const fullManifestContext=await browser.newContext({viewport:{width:1280,height:850},reducedMotion:'reduce'});
  const fullManifestPage=await fullManifestContext.newPage();
  await routeRPC(fullManifestPage,{nextChallengeId:'0x'+'0'.repeat(63)+'3',transactions:bountyTransactions,bountyProof});
  await fullManifestPage.route('**/bounty-proof.json',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(bountyProof)}));
  await fullManifestPage.route('**/deployment.json',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(completeManifest)}));
  await fullManifestPage.goto(base,{waitUntil:'domcontentloaded'});
  await fullManifestPage.addScriptTag({path:path.join(here,'node_modules/axe-core/axe.min.js')});
  await fullManifestPage.locator('#tab-proof').click();
  await fullManifestPage.locator('#proof-demo-meta').waitFor({state:'visible'});
  assert.equal(await fullManifestPage.locator('#proof-demo').innerText(),fixture.vault.slice(0,6)+'…'+fixture.vault.slice(-4));
  assert.equal(await fullManifestPage.locator('#proof-practice').innerText(),fixture.arena.slice(0,6)+'…'+fixture.arena.slice(-4));
  assert.equal(await fullManifestPage.locator('#proof-flow').innerText(),'3 receipts verified');
  assert.equal(await fullManifestPage.locator('#vault-address').inputValue(),fixture.vault,'Verified demo vault should seed the inspector');
  assert.equal(await fullManifestPage.locator('#receipt-shortcuts').isHidden(),false,'Verified manifest should unlock one-click receipt inspection');
  await fullManifestPage.locator('button[data-receipt="allowedTx"]').click();
  assert.equal(await fullManifestPage.locator('#tx-hash').inputValue(),fixture.allowedTx,'Allowed shortcut must use the verified manifest hash');
  await fullManifestPage.waitForFunction(()=>document.querySelector('#tx-result').textContent.includes('Confirmed success'));
  await fullManifestPage.locator('button[data-receipt="deniedTx"]').click();
  assert.equal(await fullManifestPage.locator('#tx-hash').inputValue(),fixture.deniedTx,'Denied shortcut must use the verified manifest hash');
  await fullManifestPage.waitForFunction(()=>document.querySelector('#tx-result').textContent.includes('Execution reverted'));
  assert.equal(await fullManifestPage.locator('button[data-receipt="deniedTx"]').getAttribute('aria-pressed'),'true');
  await fullManifestPage.locator('button[data-receipt="practiceProofTx"]').click();
  assert.equal(await fullManifestPage.locator('#tx-hash').inputValue(),fixture.practiceProofTx,'Practice shortcut must use the verified manifest hash');
  await fullManifestPage.waitForFunction(()=>document.querySelector('#tx-result').textContent.includes('Confirmed success'));
  await fullManifestPage.locator('#tx-hash').fill(fixture.tx);
  assert.equal(await fullManifestPage.locator('button[data-receipt="practiceProofTx"]').getAttribute('aria-pressed'),'false','Manual hash edits reset shortcut selection');
  assert.deepEqual(await axeViolations(fullManifestPage),[],'Complete-manifest Proof must remain accessible');
  await fullManifestPage.locator('#tab-protect').click();
  assert.deepEqual(await axeViolations(fullManifestPage),[],'Complete-manifest Protect must remain accessible');
  assert.equal(await fullManifestPage.locator('#onchain-protect').isHidden(),false,'Complete manifest should unlock testnet Protect actions');
  await fullManifestPage.locator('#tab-challenge').click();
  assert.deepEqual(await axeViolations(fullManifestPage),[],'Complete-manifest Challenge must remain accessible');
  assert.equal(await fullManifestPage.locator('#onchain-escrow').isHidden(),false,'Verified escrow should be connected read-only');
  assert.equal(await fullManifestPage.locator('#onchain-escrow-status').innerText(),'2 testnet challenge record(s) exist. No WIF reward is funded.');
  assert.equal(await fullManifestPage.locator('#onchain-challenge').isHidden(),false,'Complete manifest should unlock testnet Challenge actions');
  await fullManifestPage.locator('#bounty-proof').waitFor({state:'visible'});
  assert.equal(await fullManifestPage.locator('#bounty-proof-steps a').count(),3,'Real receipt proof should show three lifecycle transactions');
  await fullManifestPage.waitForTimeout(350);
  assert.deepEqual(await axeViolations(fullManifestPage),[],'Verified bounty evidence must remain accessible');
  await fullManifestContext.close();

  const rejectedContext=await browser.newContext({viewport:{width:1280,height:850},reducedMotion:'reduce'});
  const rejectedPage=await rejectedContext.newPage();
  await routeRPC(rejectedPage);
  await rejectedPage.route('**/deployment.json',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({chainId:46630,factory:fixture.factory,mockToken:fixture.mockToken,challengeEscrow:fixture.challengeEscrow,factoryTx:fixture.tx,mockTokenTx:fixture.tx,challengeEscrowTx:fixture.tx,verified:true})}));
  await rejectedPage.addInitScript(({owner})=>{
    window.ethereum={request:async({method})=>{
      if(method==='eth_requestAccounts')return [owner];
      if(method==='eth_chainId')return '0xb626';
      if(method==='eth_sendTransaction'){const error=new Error('User rejected the request');error.code=4001;throw error;}
      throw Error('Unexpected wallet method '+method);
    }};
  },{owner:fixture.owner});
  await rejectedPage.goto(base,{waitUntil:'domcontentloaded'});
  await rejectedPage.locator('#onchain-protect').waitFor({state:'visible'});
  await rejectedPage.locator('#create-demo-vault').click();
  await rejectedPage.waitForFunction(()=>document.querySelector('#onchain-protect-status').textContent.includes('User rejected'));
  assert.equal(await rejectedPage.locator('#create-demo-vault').isDisabled(),false,'Rejected wallet action must be retryable');
  assert.doesNotMatch(await rejectedPage.locator('#onchain-protect-status').innerText(),/Vault registered/,'Rejected wallet action must not claim success');
  await rejectedContext.close();

  const revertedContext=await browser.newContext({viewport:{width:1280,height:850},reducedMotion:'reduce'});
  const revertedPage=await revertedContext.newPage();
  await routeRPC(revertedPage,{receiptStatus:'0x0',transactions:{
    [fixture.tx.toLowerCase()]:transactionRecord(fixture.tx,fixture.factory,encodeDemoCreate(fixture.mockToken))
  }});
  await revertedPage.route('**/deployment.json',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({chainId:46630,factory:fixture.factory,mockToken:fixture.mockToken,challengeEscrow:fixture.challengeEscrow,factoryTx:fixture.tx,mockTokenTx:fixture.tx,challengeEscrowTx:fixture.tx,verified:true})}));
  await revertedPage.addInitScript(({owner,tx})=>{
    window.__transactions=[];
    window.__transactionIndex=0;
    window.ethereum={request:async({method,params})=>{
      if(method==='eth_requestAccounts')return [owner];
      if(method==='eth_chainId')return '0xb626';
      if(method==='eth_sendTransaction'){window.__transactions.push(params[0]);return tx;}
      throw Error('Unexpected wallet method '+method);
    }};
  },{owner:fixture.owner,tx:fixture.tx});
  await revertedPage.goto(base,{waitUntil:'domcontentloaded'});
  await revertedPage.locator('#onchain-protect').waitFor({state:'visible'});
  await revertedPage.locator('#create-demo-vault').click();
  await revertedPage.waitForFunction(()=>document.querySelector('#onchain-protect-status').textContent.includes('Transaction reverted'));
  assert.doesNotMatch(await revertedPage.locator('#onchain-protect-status').innerText(),/Vault registered/,'Reverted wallet action must not claim success');
  assert.equal((await revertedPage.evaluate(()=>window.__transactions)).length,1);
  await revertedContext.close();

  const mismatchContext=await browser.newContext({viewport:{width:1280,height:850},reducedMotion:'reduce'});
  const mismatchPage=await mismatchContext.newPage();
  await routeRPC(mismatchPage,{transactions:{
    [fixture.tx.toLowerCase()]:transactionRecord(fixture.tx,fixture.mockToken,encodeDemoCreate(fixture.mockToken))
  }});
  await mismatchPage.route('**/deployment.json',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({chainId:46630,factory:fixture.factory,mockToken:fixture.mockToken,challengeEscrow:fixture.challengeEscrow,factoryTx:fixture.tx,mockTokenTx:fixture.tx,challengeEscrowTx:fixture.tx,verified:true})}));
  await mismatchPage.addInitScript(({owner,tx})=>{
    window.__transactions=[];
    window.ethereum={request:async({method,params})=>{
      if(method==='eth_requestAccounts')return [owner];
      if(method==='eth_chainId')return '0xb626';
      if(method==='eth_sendTransaction'){window.__transactions.push(params[0]);return tx;}
      throw Error('Unexpected wallet method '+method);
    }};
  },{owner:fixture.owner,tx:fixture.tx});
  await mismatchPage.goto(base,{waitUntil:'domcontentloaded'});
  await mismatchPage.locator('#onchain-protect').waitFor({state:'visible'});
  await mismatchPage.locator('#create-demo-vault').click();
  await mismatchPage.waitForFunction(()=>document.querySelector('#onchain-protect-status').textContent.includes('did not match'));
  assert.doesNotMatch(await mismatchPage.locator('#onchain-protect-status').innerText(),/Vault registered/,'Mismatched wallet action must not claim success');
  await mismatchContext.close();

  const context=await browser.newContext({viewport:{width:1280,height:850},reducedMotion:'reduce'});
  const page=await context.newPage();
  page.on('pageerror',error=>problems.push('mock wallet browser: '+error.message));
  await routeRPC(page);
  await page.route('**/deployment.json',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({chainId:46630,factory:fixture.factory,mockToken:fixture.mockToken,challengeEscrow:fixture.challengeEscrow,factoryTx:fixture.tx,mockTokenTx:fixture.tx,challengeEscrowTx:fixture.tx,verified:true})}));
  await page.addInitScript(({owner,txs})=>{
    window.__transactions=[];
    window.__transactionIndex=0;
    window.ethereum={request:async({method,params})=>{
      if(method==='eth_requestAccounts')return [owner];
      if(method==='eth_chainId')return '0xb626';
      if(method==='eth_sendTransaction'){window.__transactions.push(params[0]);return txs[window.__transactionIndex++];}
      throw Error('Unexpected wallet method '+method);
    }};
  },{owner:fixture.owner,txs:[fixture.demoTx,fixture.allowedTx,fixture.practiceTx,fixture.practiceProofTx]});
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.locator('#onchain-protect').waitFor({state:'visible'});
  await page.locator('#create-demo-vault').click();
  await page.locator('#demo-withdraw').waitFor({state:'visible'});
  await page.waitForFunction(()=>document.querySelector('#onchain-protect-status').textContent.includes('Vault registered'));
  await page.locator('#demo-withdraw').click();
  await page.waitForFunction(()=>document.querySelector('#onchain-protect-status').textContent.includes('withdrawal confirmed'));
  await page.locator('#tab-challenge').click();
  await page.locator('#onchain-challenge').waitFor({state:'visible'});
  await page.locator('#create-practice').click();
  await page.locator('#solve-practice').waitFor({state:'visible'});
  await page.locator('#solve-practice').click();
  await page.waitForFunction(()=>document.querySelector('#onchain-challenge-status').textContent.includes('Practice proof confirmed'));
  const tx=await page.evaluate(()=>window.__transactions);
  assert.equal(tx.length,4);
  assert.deepEqual(tx.map(x=>x.data.slice(0,10)),['0x4e6a5acd','0xf3fef3a3','0x1ce59d6c','0x3b1bf525']);
  for(const entry of tx)assert.equal(entry.value,'0x0','Must never send native ETH');
  await context.close();
  assert.equal(problems.length,0,problems.join('\n'));
  console.log(JSON.stringify({viewportWidths:[320,375,768,1280],wcagAudits:audited,fullManifestAudits:3,detectedViolations:0,fullManifestProof:true,mockedWalletTransactions:tx.length,mockedWalletFailurePaths:3,layout:'no horizontal overflow',results:'PASS'},null,2));
} finally {
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
