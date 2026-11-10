import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const OUT='demo/diag-output';
await mkdir(OUT,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const statuses=[];
const errors=[];
page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text().slice(0,220));});
page.on('pageerror',e=>errors.push('page: '+e.message));
page.on('response',r=>{if(r.url().includes('rpc.mainnet.chain.robinhood.com'))statuses.push({url:r.url(),status:r.status()});});
try{
 await page.goto('https://before-web-theta.vercel.app/app/support/',{waitUntil:'domcontentloaded',timeout:45000});
 await page.locator('#public-history-recipient').fill('0x02fb3352e593f4bcbff5a845e7a0f90ca4a87f0d');
 await page.locator('#public-history-form button').click();
 await page.waitForFunction(()=>!document.querySelector('#public-history-form button').disabled,{timeout:60000}).catch(()=>{});
 const result=await page.evaluate(()=>({
   status:document.querySelector('#public-history-status')?.textContent,
   kind:document.querySelector('#public-history-status')?.dataset.kind,
   links:[...document.querySelectorAll('#public-history-list a')].map(a=>a.href),
   more:!document.querySelector('#public-history-more')?.hidden,
   pageTitle:document.title
 }));
 await page.screenshot({path:OUT+'/diagnostic.png'});
 await writeFile(OUT+'/diagnostic.json',JSON.stringify({result,requests:statuses,errors},null,2));
 console.log('PUBLIC HISTORY DIAG:',JSON.stringify({result,requests:statuses,errors}));
}finally{await browser.close();}
