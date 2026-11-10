import { chromium } from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const out='/tmp/before-bounty-live';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
const faults=[],consoleErrors=[];
page.on('pageerror',e=>faults.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text().slice(0,150));});
try{
 await page.goto('http://127.0.0.1:8123/app/bounty/',{waitUntil:'domcontentloaded',timeout:40000});
 await page.waitForFunction(()=>{
  const s=document.getElementById('bounty-discovery-status')?.textContent||'';
  return !s.includes('Loading')&&!s.includes('Checking');
 },null,{timeout:80000});
 const state=await page.evaluate(()=>({
  status:document.getElementById('bounty-discovery-status')?.textContent,
  items:[...document.querySelectorAll('.bounty-discovery-link')].map(a=>({text:a.textContent,href:a.getAttribute('href')})),
  action:document.querySelector('#activity-text')?.textContent,
  chain:document.querySelector('#chain-status')?.textContent
 }));
 await page.screenshot({path:out+'/live-bounties.png',fullPage:true});
 await writeFile(out+'/report.json',JSON.stringify({state,faults,consoleErrors},null,2));
 console.log('LIVE DISCOVERY',JSON.stringify({state,faults,consoleErrors}));
 if(faults.length)throw Error('Unexpected JS errors');
 if(state.chain?.includes('UNAVAILABLE'))throw Error('Live RPC unavailable');
 if(state.items.length===0)throw Error('No compatible public testnet bounties discovered; verify scope and onchain state');
 const first=state.items[0];await page.goto('http://127.0.0.1:8123'+first.href,{waitUntil:'domcontentloaded',timeout:40000});
 await page.waitForTimeout(5000);
 console.log('DETAIL',await page.locator('#activity-text').textContent(),'SUMMARY',await page.locator('#challenge-summary').isVisible());
}finally{await browser.close()}
