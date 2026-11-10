// Read-only first-time-viewer footage of the deployed Bounty Studio discovery.
// No window.ethereum is installed. No wallet connection or transaction can occur.
import {chromium} from 'playwright';
import {mkdir,copyFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
const out=path.resolve('demo/live-bounty-video/output');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1600,height:900},screen:{width:1600,height:900},deviceScaleFactor:1,recordVideo:{dir:out,size:{width:1920,height:1080}},reducedMotion:'reduce'});
const page=await context.newPage();
const faults=[],notes=[];
page.on('pageerror',e=>faults.push(String(e)));
page.on('console',e=>{if(e.type()==='error')faults.push(e.text())});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const snap=async(name)=>{await page.screenshot({path:path.join(out,name+'.png'),animations:'disabled'});notes.push({name,at:Date.now(),url:page.url()})};
try{
 await page.goto('https://before-web-theta.vercel.app/app/bounty/',{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>document.querySelectorAll('#bounty-discovery-list li').length===3,null,{timeout:60000});
 const text=await page.locator('#bounty-discovery-list').innerText();
 if(!text.includes('Bounty #7')||!text.includes('Bounty #6')||!text.includes('Bounty #5'))throw Error('Missing real public testnet history');
 const browse=page.locator('#bounty-discovery');
 await browse.scrollIntoViewIfNeeded();
 await sleep(700);
 await snap('01-public-bounty-list');
 await sleep(2300);
 await page.locator('[data-bounty-filter="finished"]').click();
 await sleep(350);await snap('02-finished-filter');
 await sleep(1650);
 await page.locator('[data-bounty-filter="all"]').click();
 await sleep(700);
 await page.locator('#bounty-discovery-list a').first().hover();
 await sleep(1600);
 await snap('03-public-bounty-example');
 await sleep(900);
 await writeFile(path.join(out,'REPORT.json'),JSON.stringify({origin:page.url(),rows:text,notes,errors:faults,signing:false,mainnetSpend:false},null,2));
 await copyFile(await page.video().path(),path.join(out,'BEFORE_LIVE_BOUNTY_READONLY.webm')).catch(()=>{});
}finally{
 await context.close();
 const video=page.video();
 if(video)try{await copyFile(await video.path(),path.join(out,'BEFORE_LIVE_BOUNTY_READONLY.webm'))}catch{}
 await browser.close();
}
if(faults.length)throw Error('Unexpected browser faults: '+faults.join(' | '));
