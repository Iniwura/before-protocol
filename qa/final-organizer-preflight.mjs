// No login, no secrets, no edits, no transactions. Public first-time-user/organizer verification.
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const out=path.resolve('qa/results/final-preflight');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const results={checked:new Date().toISOString(),sourceCommit:process.env.GITHUB_SHA||'',pages:[],organizer:{},status:'STARTED'};
const routeNames=['/','/app/','/app/pay/','/app/support/','/app/wif/','/app/bounty/'];
try{
 const context=await browser.newContext({viewport:{width:1366,height:900},reducedMotion:'reduce',ignoreHTTPSErrors:false});
 for(const route of routeNames){
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try{
   const response=await page.goto('https://before-web-theta.vercel.app'+route,{waitUntil:'domcontentloaded',timeout:35000});
   await page.waitForTimeout(900);
   const status=response?.status();
   const title=await page.title();
   const body=await page.locator('body').innerText();
   const r={route,status,title,bytes:body.length,errors:errors.slice(0,5),bodyExcerpt:body.slice(0,1000)};
   if(status!==200)r.problem='HTTP status '+status;
   if(body.length<100)r.problem='Empty or blocked content';
   if(errors.length)r.note='JS errors present; inspect for wallet/dynamic dependencies';
   results.pages.push(r);
   if(route==='/app/bounty/'){
    await page.waitForTimeout(3000);
    r.bountyRows=await page.locator('#bounty-discovery-list li').count().catch(()=>0);
    r.discoveryStatus=await page.locator('#bounty-discovery-status').innerText().catch(()=>'Unavailable');
    await page.screenshot({path:path.join(out,'live-bounty.png')});
   }
   if(route==='/app/'){
    r.hasCreateVaultButton=await page.locator('#create-demo-vault').count()===1;
    r.vaultButtonVisible=await page.locator('#create-demo-vault').isVisible().catch(()=>false);
   }
  }catch(e){results.pages.push({route,error:String(e)})}
  await page.close();
 }
 for(const [name,url] of [
  ['landing','https://worldisflat.fun/build'],
  ['rules','https://worldisflat.fun/build/rules'],
  ['dashboard','https://worldisflat.fun/build/me']
 ]){
  const page=await context.newPage();
  try{
   const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:35000});
   await page.waitForTimeout(2600);
   const body=await page.locator('body').innerText();
   const links=await page.locator('a').evaluateAll(items=>items.map(a=>({text:a.innerText,href:a.getAttribute('href')})).filter(a=>a.text||a.href).slice(0,75));
   const buttons=await page.locator('button').evaluateAll(items=>items.map(b=>b.innerText).slice(0,50));
   const fields=await page.locator('input,textarea,select').evaluateAll(items=>items.map(x=>({tag:x.tagName,type:x.type,name:x.name,placeholder:x.placeholder})));
   results.organizer[name]={url:page.url(),status:response?.status(),title:await page.title(),body,links,buttons,fields};
   await page.screenshot({path:path.join(out,'organizer-'+name+'.png'),fullPage:name==='rules'});
   await writeFile(path.join(out,'organizer-'+name+'.txt'),body+'\n');
  }catch(e){results.organizer[name]={error:String(e),url:page.url()}}
  await page.close();
 }
 results.status='COMPLETE';
 await context.close();
}finally{
 await writeFile(path.join(out,'report.json'),JSON.stringify(results,null,2));
 await browser.close();
}
console.log(JSON.stringify({status:results.status,pages:results.pages.map(x=>({route:x.route,status:x.status,error:x.error,problem:x.problem,errors:x.errors,bountyRows:x.bountyRows,vaultButtonVisible:x.vaultButtonVisible})),organizer:Object.fromEntries(Object.entries(results.organizer).map(([k,v])=>[k,{url:v.url,status:v.status,error:v.error,title:v.title,bodyExcerpt:v.body?.slice(0,10000),fields:v.fields,buttons:v.buttons}]))},null,2));
if(results.pages.some(x=>x.problem||x.error))process.exitCode=1;
