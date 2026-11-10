import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const dir='demo/full-capture/allowed-output';
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1600,height:900},deviceScaleFactor:1});
try {
 await page.goto('https://before-web-theta.vercel.app/app/#proof',{waitUntil:'domcontentloaded',timeout:50000});
 await page.locator('[data-receipt="allowedTx"]').waitFor({state:'visible',timeout:25000});
 await page.locator('[data-receipt="allowedTx"]').click();
 await page.waitForFunction(()=>{
  const t=document.querySelector('#tx-result')?.textContent||'';
  return t.includes('Execution')&& !t.includes('Inspecting');
 },null,{timeout:25000});
 await page.locator('#tx-result').scrollIntoViewIfNeeded();
 await page.screenshot({path:dir+'/01-allowed-receipt.png'});
 const result=await page.locator('#tx-result').textContent();
 console.log('ACTUAL ALLOWED RECEIPT:',result?.slice(0,450));
 if(!/successful|success|succeeded/i.test(result))throw Error('No independent successful proof confirmed');
 await writeFile(dir+'/VERIFIED.txt',result);
}finally{await browser.close();}
