/** BEFORE full-product demo footage: real hosted UI, NO wallet signing, no transaction sends. */
import { chromium } from 'playwright';
import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';
const SITE='https://before-web-theta.vercel.app';
const OUT=path.resolve('demo/full-capture/output');
const CREATOR='0x02fb3352e593f4bcbff5a845e7a0f90ca4a87f0d';
const PAYER='0x11cbedbf9fcd723ce48fbd5a2b55e6e3699c3368';
const RECEIPTS=['0x4f6b1b2d48f73643408418896a7de886be4a522bf583a1c3d1d9c104c3b42476','0x7e5ca115c13fed7e36109478c9f454adc81c58c2c114f569624d95792f64033a'];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await mkdir(OUT,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const start=Date.now(),trace=[],errors=[];
const context=await browser.newContext({viewport:{width:1600,height:900},screen:{width:1600,height:900},deviceScaleFactor:1,recordVideo:{dir:OUT,size:{width:1600,height:900}},reducedMotion:'reduce'});
// This capture deliberately has NO window.ethereum. No wallet request or transfer can take place.
const page=await context.newPage();page.setDefaultTimeout(14000);
page.on('pageerror',e=>errors.push(String(e.message)));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,240));});
const sec=()=>Math.round((Date.now()-start)/100)/10;
async function scene(name,selector,hold=2.8) {
 if(selector) {
  const el=page.locator(selector).first();
  await el.scrollIntoViewIfNeeded({timeout:14000});
 }
 await sleep(350);
 const file=name+'.png';
 await page.screenshot({path:path.join(OUT,file),animations:'disabled'});
 trace.push({name,time:sec(),file,url:page.url(),title:await page.title()});
 console.log('SHOT',name,sec(),'URL',page.url());
 await sleep(hold*1000);
}
async function step(name,fn){
 try{await fn();console.log('PASS',name);}
 catch(e){errors.push(name+': '+e.message);console.log('WARN',name,e.message);}
}
try{
 await page.goto(SITE+'/',{waitUntil:'domcontentloaded',timeout:60000});
 await scene('00-landing','body',3);
 await page.goto(SITE+'/app/#protect',{waitUntil:'domcontentloaded',timeout:60000});
 await scene('01-protect-intro','#panel-protect .view-heading',2);
 await page.locator('#protect-amount').fill('75');
 await page.locator('#protect-spent').fill('40');
 await page.locator('#protect-form button').click();
 await scene('02-protect-blocked','#protect-result',3.5);
 await page.locator('#protect-amount').fill('40');
 await page.locator('#protect-spent').fill('40');
 await page.locator('#protect-form button').click();
 await scene('03-protect-allowed','#protect-result',3.5);
 await page.locator('#tab-challenge').click();
 await scene('04-challenge-intro','#panel-challenge .view-heading',2.2);
 await page.locator('#challenge-a').fill('60');
 await page.locator('#challenge-b').fill('50');
 await page.locator('#challenge-form button').click();
 await scene('05-challenge-bypass','#challenge-verdict',4);
 await page.locator('#tab-proof').click();
 await scene('06-proof-intro','#panel-proof .view-heading',2.2);
 await step('inspect real denied receipt', async()=>{
  const shortcut=page.locator('[data-receipt="deniedTx"]');
  await shortcut.waitFor({state:'visible',timeout:20000});
  await shortcut.click();
  await page.waitForFunction(()=>!document.querySelector('#tx-result')?.textContent?.includes('Reading'),null,{timeout:25000});
  await scene('07-proof-denied','#tx-result',4);
 });
 await step('inspect real practice proof', async()=>{
  const shortcut=page.locator('[data-receipt="practiceProofTx"]');
  await shortcut.waitFor({state:'visible',timeout:12000});
  await shortcut.click();
  await sleep(900);
  await scene('08-proof-practice','#tx-result',3.5);
 });
 await page.goto(SITE+'/app/bounty/',{waitUntil:'domcontentloaded',timeout:45000});
 await scene('09-bounty-workflow','.entry-choice',3.5);
 await page.locator('[data-start="sponsor"]').first().click();
 await scene('10-bounty-sponsor','#role-sponsor .role-heading',3);
 await step('inspect real public BTEST bounty',async()=>{
  await page.locator('#challenge-id').fill('7');
  await page.locator('#load-form button').click();
  await sleep(2800);
  await scene('11-bounty-onchain-example','#challenge-inspector',3);
 });
 await page.goto(SITE+'/app/wif/',{waitUntil:'domcontentloaded',timeout:45000});
 await scene('12-wif-intro','.work-head',2.5);
 await page.locator('#manual-entry summary').click();
 await page.locator('#owner').fill(PAYER);
 await page.locator('#spender').fill(CREATOR);
 await page.locator('#scan-button').click();
 await step('WIF mainnet permission result',async()=>{
  await page.locator('#result').waitFor({state:'visible',timeout:26000});
  await scene('13-wif-inspection','#result .result-head',4);
 });
 await page.goto(SITE+'/app/support/',{waitUntil:'domcontentloaded',timeout:45000});
 await scene('14-support-intro','.pay-hero',2.5);
 await page.locator('#public-history-recipient').fill(CREATOR);
 await page.locator('#public-history-form button').click();
 await step('verify two historical WIF receipts',async()=>{
  await page.waitForFunction((hashes)=>hashes.every(h=>[...document.querySelectorAll('#public-history-list a')].some(a=>a.href.toLowerCase().includes(h))),RECEIPTS,{timeout:60000});
  await scene('15-support-real-transfers','#public-history-list',4.8);
 });
 await page.goto(SITE+'/app/',{waitUntil:'domcontentloaded',timeout:45000});
 await scene('16-product-close','#tab-protect',2.8);
 const video=page.video();
 await context.close();
 await copyFile(await video.path(),path.join(OUT,'BEFORE_FULL_PRODUCT_RAW.webm'));
}finally{
 await writeFile(path.join(OUT,'CAPTURE_MANIFEST.json'),JSON.stringify({origin:SITE,trace,errors,network:'real production / remote RPC',walletSigning:'none',newTransfers:0,testnetMode:'local simulations plus real read-only testnet receipts',wifEvidence:'two historical acceptance transfers only'},null,2));
 await browser.close();
}
if(!trace.some(t=>t.name==='02-protect-blocked')||!trace.some(t=>t.name==='05-challenge-bypass'))throw Error('Core application proof footage missing');
if(!trace.some(t=>t.name==='15-support-real-transfers'))throw Error('Authentic historical WIF receipts not captured; review capture');
