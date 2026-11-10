/**
 * REVIEW FOOTAGE ONLY. Records genuine production browser interactions.
 * NO funded wallet key, NO eth_sendTransaction, NO token approval.
 * The transfer history comes from production RPC; no mocked receipts.
 */
import assert from 'node:assert/strict';
import {mkdir, copyFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {Wallet} from 'ethers';

const SITE = 'https://before-web-theta.vercel.app/app/support/';
const CREATOR_EVIDENCE = '0x02fb3352e593f4bcbff5a845e7a0f90ca4a87f0d';
const ACCEPTANCE_PAYER = '0x11cbedbf9fcd723ce48fbd5a2b55e6e3699c3368';
const WIF = '0x5173b8eA6923c2d40267890D45C46a3480954773';
const RECEIPTS = [
  '0x4f6b1b2d48f73643408418896a7de886be4a522bf583a1c3d1d9c104c3b42476',
  '0x7e5ca115c13fed7e36109478c9f454adc81c58c2c114f569624d95792f64033a'
];
const creator = Wallet.createRandom(); // Ephemeral and unfunded; never print private material.
let role = 'creator';
let sends = 0;
let browser;
const out = path.resolve('demo/output');
await mkdir(out,{recursive:true});

function sleep(ms) {return new Promise(r => setTimeout(r,ms));}
function expectRealHistory(page) {
  return page.waitForFunction(({hashes}) => {
    const links = [...document.querySelectorAll('#public-history-list a')].map(a => a.href.toLowerCase());
    return hashes.every(h => links.some(x => x.includes(h)));
  }, {hashes: RECEIPTS}, {timeout: 90000});
}
async function spot(page, selector, delay=2800) {
  const item = page.locator(selector); await item.scrollIntoViewIfNeeded();
  await sleep(delay);
}
async function mark(page, label) {
  await page.evaluate((name) => {
    let el = document.getElementById('before-review-overlay');
    if (!el) {
      el=document.createElement('div'); el.id='before-review-overlay';
      el.style.cssText='position:fixed;z-index:2147483647;top:18px;right:18px;max-width:520px;padding:12px 16px;background:#061423;color:white;border:1px solid #d6f0ff;border-radius:5px;font:600 15px/1.5 Arial,sans-serif;box-shadow:0 8px 28px #0018;pointer-events:none;letter-spacing:.04em';
      document.body.appendChild(el);
    }
    el.textContent=name;
  },label);
}

try {
  browser = await chromium.launch({headless:true,args:['--no-sandbox']});
  const context = await browser.newContext({
    viewport:{width:1920,height:1080},
    screen:{width:1920,height:1080},
    deviceScaleFactor:1,
    reducedMotion:'reduce',
    recordVideo:{dir:out,size:{width:1920,height:1080}}
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on('pageerror',e=>console.error('BROWSER PAGE ERROR',e.message));
  await page.exposeFunction('__beforeDemoAccount',() => role==='creator'?creator.address:ACCEPTANCE_PAYER);
  await page.exposeFunction('__beforeDemoSign',async (text) => {
    assert.equal(role,'creator','Only the demo recipient may sign the offer');
    const typed = JSON.parse(text);
    assert.equal(typed.primaryType,'SupportOffer');
    assert.equal(String(typed.domain.chainId),'4663');
    assert.equal(typed.message.recipient.toLowerCase(),creator.address.toLowerCase());
    assert.equal(typed.message.token.toLowerCase(),WIF.toLowerCase());
    assert.equal(BigInt(typed.message.amount),200n*10n**18n);
    const types = Object.fromEntries(Object.entries(typed.types).filter(([key])=>key!=='EIP712Domain'));
    return creator.signTypedData(typed.domain,types,typed.message);
  });
  await page.addInitScript(() => {
    window.ethereum = {
      isMetaMask:false,
      on:()=>{},removeListener:()=>{},
      request:async ({method,params=[]}) => {
        if(method==='eth_chainId')return '0x1237'; // 4663
        if(method==='eth_requestAccounts'||method==='eth_accounts')return [await window.__beforeDemoAccount()];
        if(method==='eth_signTypedData_v4')return window.__beforeDemoSign(params[1]);
        if(method==='eth_sendTransaction'||method==='eth_sendRawTransaction'||method==='eth_signTransaction'||method==='personal_sign'){
          throw new Error('VIDEO REVIEW: wallet signing/sending is disabled');
        }
        throw new Error('VIDEO REVIEW: wallet method not allowed: '+method);
      }
    };
  });

  // 1. Open on real receipts, not a splash screen.
  await page.goto(SITE,{waitUntil:'domcontentloaded',timeout:45000});
  await mark(page,'LIVE PRODUCT · ROBINHOOD MAINNET');
  await spot(page,'#public-history-card',4000);
  await page.locator('#public-history-recipient').fill(CREATOR_EVIDENCE);
  await page.locator('#public-history-form button').click();
  await expectRealHistory(page);
  for (const h of RECEIPTS) {
    const link=page.locator('#public-history-list a[href*="'+h+'"]');
    assert.equal(await link.count(),1,'Exact real receipt missing '+h);
  }
  await mark(page,'REAL MAINNET HISTORY · TWO CONTROLLED 200-WIF TRANSFERS');
  await page.screenshot({path:path.join(out,'01-real-receipts.png')});
  await sleep(4500);

  // 2. Actually create a signed offer with a fresh unfunded wallet. No transfer.
  await page.locator('#create-support-card').scrollIntoViewIfNeeded();
  await mark(page,'OFF-CHAIN DEMO SIGNATURE · NO WIF SENT');
  await sleep(2200);
  await page.locator('#support-amount').fill('200');
  await page.locator('#support-interval').selectOption('weekly');
  await page.locator('#support-expiry').fill('30');
  await sleep(3000);
  await page.locator('#create-support').click();
  await page.locator('#share-card').waitFor({state:'visible',timeout:60000});
  const link=await page.locator('#support-share-link').inputValue();
  assert.ok(link.startsWith(SITE+'?offer='),'Legitimate live creator link missing');
  await page.screenshot({path:path.join(out,'02-signed-offer.png')});
  await spot(page,'#share-card',4000);

  // 3. Return via the actual signed link, with a read-only simulated payer identity.
  role='payer';
  await page.goto(link,{waitUntil:'domcontentloaded',timeout:45000});
  await page.locator('#offer-card').waitFor({state:'visible',timeout:45000});
  await mark(page,'SIGNED OFFER VERIFIED · SIMULATED PAYER · NO TRANSFER');
  await spot(page,'#offer-card',4300);
  const shown=await page.locator('#support-amount-display').innerText();
  assert.match(shown,/200.*WIF/i);
  await page.screenshot({path:path.join(out,'03-supporter-checks.png')});
  await spot(page,'#check-card',1500);
  await page.locator('#check-support').click();
  // Preflight must be the real production code and RPC, never a mocked response.
  await Promise.race([
    page.locator('#check-results').waitFor({state:'visible',timeout:45000}),
    page.locator('#support-feedback[data-kind="error"]').waitFor({state:'visible',timeout:45000}).then(async()=>{
      throw new Error('Actual preflight did not pass: '+await page.locator('#support-feedback').innerText());
    })
  ]);
  await spot(page,'#check-results',5000);
  await page.screenshot({path:path.join(out,'04-mainnet-preflight.png')});
  assert.equal(sends,0,'No WIF transaction can be sent by the capture runner');

  // 4. Re-open real public history and conclude with verifiable receipts.
  await page.goto(SITE,{waitUntil:'domcontentloaded',timeout:45000});
  await mark(page,'PUBLIC WIF HISTORY · REAL MAINNET RECEIPTS');
  await page.locator('#public-history-recipient').fill(CREATOR_EVIDENCE);
  await spot(page,'#public-history-card',1400);
  await page.locator('#public-history-form button').click();
  await expectRealHistory(page);
  await spot(page,'#public-history-list',6500);
  await page.screenshot({path:path.join(out,'05-verified-public-history.png')});
  await mark(page,'VOLUNTARY RETURN · NO SUBSCRIPTIONS · NO AUTO PAYMENTS');
  await sleep(3500);
  await page.goto(SITE+'?tour=1',{waitUntil:'domcontentloaded',timeout:45000});
  await mark(page,'OPTIONAL THREE-STEP TOUR · SKIPPABLE');
  await spot(page,'#support-tour-panel',3500);
  await page.locator('#support-tour-close').click();
  await spot(page,'#create-support-card',3000);
  await mark(page,'CREATE A SIGNED WIF SUPPORT LINK · CODE AND PROOF ARE PUBLIC');
  await sleep(5000);
  const video=page.video();
  await context.close();
  const rawPath=await video.path();
  await copyFile(rawPath,path.join(out,'BEFORE_FRESH_REAL_BROWSER_REVIEW.webm'));
  await writeFile(path.join(out,'RECORDING_FACTS.json'),JSON.stringify({
    productionSite:SITE,
    capturedRecipient:CREATOR_EVIDENCE,
    originalHistoricalReceiptHashes:RECEIPTS,
    creatorSignature:'offchain-demo-unfunded',
    payerWallet:'simulated-read-only',
    newMainnetTransfers:0,
    publicHistory:'actual-mainnet-RPC-not-mocked',
    finalVideoStatus:'NOT COMPLETE: raw footage lacks final reviewed voiceover/edit'
  },null,2));
  console.log('Fresh production footage and verified real-history screenshots captured. No onchain sends. NOT a final submission.');
} finally {
  if(browser)await browser.close();
}
