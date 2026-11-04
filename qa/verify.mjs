import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../web');
const mime = { '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.css':'text/css; charset=utf-8' };
const allowed = new Set(['index.html','styles.css','app.js','core.mjs','onchain.mjs','deployment.json','favicon.svg']);
const server = createServer(async(req,res)=>{
  const pathname = new URL(req.url,'http://localhost').pathname;
  const file = pathname==='/'?'index.html':pathname.slice(1);
  if (!allowed.has(file)) {res.writeHead(404);res.end('Not found');return;}
  try {
    const data=await readFile(path.join(root,file));
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});
    res.end(data);
  } catch {res.writeHead(404);res.end('Not found');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true});
const fixture={owner:'0x'+'3'.repeat(40),factory:'0x'+'1'.repeat(40),mockToken:'0x'+'2'.repeat(40),challengeEscrow:'0x'+'6'.repeat(40),vault:'0x'+'4'.repeat(40),arena:'0x'+'5'.repeat(40),practiceVault:'0x'+'7'.repeat(40),tx:'0x'+'a'.repeat(64),demoTx:'0x'+'b'.repeat(64),practiceTx:'0x'+'c'.repeat(64),allowedTx:'0x'+'d'.repeat(64),deniedTx:'0x'+'e'.repeat(64),practiceProofTx:'0x'+'f'.repeat(64)};
const padding=addr=>'0x'+'0'.repeat(24)+addr.slice(2);
function routeRPC(page,{code='0x60016000',codeByAddress={},receiptStatus='0x1'}={}) {
  return page.route('https://rpc.testnet.chain.robinhood.com/**', route=>{
    const request=JSON.parse(route.request().postData()||'{}');
    let result=null;
    switch(request.method) {
      case 'eth_chainId':result='0xb626';break;
      case 'eth_blockNumber':result='0x10';break;
      case 'eth_getCode':result=codeByAddress[request.params?.[0]?.toLowerCase()]??code;break;
      case 'eth_getTransactionReceipt':result={status:receiptStatus,blockNumber:'0x10',transactionHash:fixture.tx,from:fixture.owner,to:fixture.factory};break;
      case 'eth_call':{
        const selector=request.params?.[0]?.data?.slice(0,10);
        result=selector==='0xee643f9e'?padding(fixture.vault):selector==='0x7f81587e'?padding(fixture.arena):'0x'+'0'.repeat(63)+'1';
        break;
      }
    }
    return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({jsonrpc:'2.0',id:1,result})});
  });
}
const problems=[];
let audited=0;
try {
  for(const width of [320,375,768,1280]) {
    const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
    const page=await context.newPage();
    page.on('pageerror',error=>problems.push(width+' browser: '+error.message));
    await routeRPC(page);
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
    const sizes=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
    if(sizes.scroll>sizes.client+1) problems.push(width+' horizontal overflow: '+JSON.stringify(sizes));
    assert.equal(await page.locator('#onchain-protect').isHidden(),true,'Unverified deployment must not unlock transactions');
    assert.equal(await page.locator('#onchain-challenge').isHidden(),true,'Unverified deployment must not unlock challenges');
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

  const fullManifestContext=await browser.newContext({viewport:{width:1280,height:850},reducedMotion:'reduce'});
  const fullManifestPage=await fullManifestContext.newPage();
  await routeRPC(fullManifestPage);
  await fullManifestPage.route('**/deployment.json',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
    chainId:46630,factory:fixture.factory,mockToken:fixture.mockToken,challengeEscrow:fixture.challengeEscrow,
    factoryTx:fixture.tx,mockTokenTx:fixture.tx,challengeEscrowTx:fixture.tx,verified:true,
    deployer:fixture.owner,demoVault:fixture.vault,practiceArena:fixture.arena,practiceVault:fixture.practiceVault,
    demoTx:fixture.demoTx,practiceTx:fixture.practiceTx,allowedTx:fixture.allowedTx,deniedTx:fixture.deniedTx,
    practiceProofTx:fixture.practiceProofTx,practiceSolver:fixture.owner
  })}));
  await fullManifestPage.goto(base,{waitUntil:'domcontentloaded'});
  await fullManifestPage.locator('#tab-proof').click();
  await fullManifestPage.locator('#proof-demo-meta').waitFor({state:'visible'});
  assert.equal(await fullManifestPage.locator('#proof-demo').innerText(),fixture.vault.slice(0,6)+'…'+fixture.vault.slice(-4));
  assert.equal(await fullManifestPage.locator('#proof-practice').innerText(),fixture.arena.slice(0,6)+'…'+fixture.arena.slice(-4));
  assert.equal(await fullManifestPage.locator('#proof-flow').innerText(),'3 receipts verified');
  assert.equal(await fullManifestPage.locator('#vault-address').inputValue(),fixture.vault,'Verified demo vault should seed the inspector');
  await fullManifestPage.locator('#tab-protect').click();
  assert.equal(await fullManifestPage.locator('#onchain-protect').isHidden(),false,'Complete manifest should unlock testnet Protect actions');
  await fullManifestPage.locator('#tab-challenge').click();
  assert.equal(await fullManifestPage.locator('#onchain-challenge').isHidden(),false,'Complete manifest should unlock testnet Challenge actions');
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
  await routeRPC(revertedPage,{receiptStatus:'0x0'});
  await revertedPage.route('**/deployment.json',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({chainId:46630,factory:fixture.factory,mockToken:fixture.mockToken,challengeEscrow:fixture.challengeEscrow,factoryTx:fixture.tx,mockTokenTx:fixture.tx,challengeEscrowTx:fixture.tx,verified:true})}));
  await revertedPage.addInitScript(({owner,tx})=>{
    window.__transactions=[];
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

  const context=await browser.newContext({viewport:{width:1280,height:850},reducedMotion:'reduce'});
  const page=await context.newPage();
  page.on('pageerror',error=>problems.push('mock wallet browser: '+error.message));
  await routeRPC(page);
  await page.route('**/deployment.json',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({chainId:46630,factory:fixture.factory,mockToken:fixture.mockToken,challengeEscrow:fixture.challengeEscrow,factoryTx:fixture.tx,mockTokenTx:fixture.tx,challengeEscrowTx:fixture.tx,verified:true})}));
  await page.addInitScript(({owner,tx})=>{
    window.__transactions=[];
    window.ethereum={request:async({method,params})=>{
      if(method==='eth_requestAccounts')return [owner];
      if(method==='eth_chainId')return '0xb626';
      if(method==='eth_sendTransaction'){window.__transactions.push(params[0]);return tx;}
      throw Error('Unexpected wallet method '+method);
    }};
  },{owner:fixture.owner,tx:fixture.tx});
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
  console.log(JSON.stringify({viewportWidths:[320,375,768,1280],wcagAudits:audited,detectedViolations:0,fullManifestProof:true,mockedWalletTransactions:tx.length,mockedWalletFailurePaths:2,layout:'no horizontal overflow',results:'PASS'},null,2));
} finally {
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
