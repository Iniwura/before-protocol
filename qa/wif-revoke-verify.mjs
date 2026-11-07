import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../web');
const token='0x5173b8eA6923c2d40267890D45C46a3480954773';
const owner='0x'+'1'.repeat(40),other='0x'+'3'.repeat(40),spender='0x'+'2'.repeat(40),hash='0x'+'a'.repeat(64);
const word=n=>BigInt(n).toString(16).padStart(64,'0');
const calldata='0x095ea7b3'+spender.slice(2).padStart(64,'0')+'0'.repeat(64);
const symbol='0x'+word(32)+word(3)+'574946'.padEnd(64,'0');
const allowed=new Set(['app/wif/index.html','wif.css','wif.js','wif-core.mjs','wif-revoke.mjs','favicon.svg']);
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{
 const rel=new URL(req.url,'http://localhost').pathname.replace(/^\//,'')||'app/wif/index.html';
 const file=rel==='app/wif/'?'app/wif/index.html':rel;
 if(!allowed.has(file)){res.writeHead(404);return res.end('Not found');}
 try{res.writeHead(200,{'content-type':mime[path.extname(file)]});res.end(await readFile(path.join(root,file)));}
 catch{res.writeHead(404);res.end('Not found');}
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 for(const scenario of ['success','reject','wrong-chain','wrong-account','changed-account','failed-receipt','nonzero-after','edited-during-check','no-wallet']){
  const page=await browser.newPage({viewport:{width:375,height:850},reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  let allowance=100n*10n**18n,sendCount=0,receiptCount=0;
  await page.route('https://rpc.mainnet.chain.robinhood.com/**',async route=>{
   const req=route.request().postDataJSON();
   let value='0x';
   if(req.method==='eth_chainId')value='0x1237';
   if(req.method==='eth_blockNumber')value='0x123456';
   if(req.method==='eth_getCode')value='0x6001';
   if(req.method==='eth_call'){
    const data=req.params[0].data.toLowerCase();
    value=data==='0x95d89b41'?symbol:data==='0x313ce567'?'0x'+word(18):data.startsWith('0x70a08231')?'0x'+word(100n*10n**18n):data.startsWith('0xdd62ed3e')?'0x'+word(allowance):'0x';
   }
   if(req.method==='eth_getTransactionReceipt'){
    receiptCount++;
    if(scenario==='success')allowance=0n;
    value={transactionHash:hash,from:owner,to:token,status:scenario==='failed-receipt'?'0x0':'0x1',blockNumber:'0x123456'};
   }
   if(req.method==='eth_getTransactionByHash')value={hash,from:owner,to:token,input:calldata};
   await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({jsonrpc:'2.0',id:req.id,result:value})});
  });
  if(scenario!=='no-wallet'){
   await page.addInitScript(({owner,other,scenario,token,calldata,hash})=>{
    let account=owner;
    window.ethereum={request:async({method,params})=>{
     if(method==='eth_requestAccounts'){
      if(scenario==='edited-during-check'){
       const input=document.querySelector('#spender');
       input.value=other;
       input.dispatchEvent(new Event('input',{bubbles:true}));
      }
      return [scenario==='wrong-account'?other:owner];
     }
     if(method==='eth_accounts')return [scenario==='changed-account'?other:account];
     if(method==='eth_chainId')return scenario==='wrong-chain'?'0xb626':'0x1237';
     if(method==='eth_sendTransaction'){
      window.__requests=(window.__requests||[]).concat(params[0]);
      if(scenario==='reject')throw Object.assign(Error('User rejected'),{code:4001});
      return hash;
     }
     throw Error('Unexpected wallet method: '+method);
    }};
   },{owner,other,scenario,token,calldata,hash});
  }
  await page.goto('http://127.0.0.1:'+server.address().port+'/app/wif/');
  await page.locator('#manual-entry summary').click();
  await page.locator('#owner').fill(owner);
  await page.locator('#spender').fill(spender);
  await page.locator('#scan-button').click();
  await page.locator('#revoke-action').waitFor({state:'visible'});
  assert.equal(await page.locator('#revoke-button').isDisabled(),true,'Consent required');
  await page.locator('#revoke-confirm').check();
  await page.locator('#revoke-button').click();
  if(scenario==='success'||scenario==='failed-receipt'||scenario==='nonzero-after'){
   await page.waitForFunction(()=>Array.isArray(window.__requests)&&window.__requests.length===1);
   const tx=await page.evaluate(()=>window.__requests[0]);
   assert.equal(tx.from.toLowerCase(),owner.toLowerCase());
   assert.equal(tx.to.toLowerCase(),token.toLowerCase());
   assert.equal(tx.data,calldata);
   assert.equal(tx.value,'0x0');
  }
  await page.waitForFunction(()=>document.querySelector('#revoke-status')?.dataset.kind==='error'||document.querySelector('#revoke-status')?.textContent.includes('Confirmed on Robinhood mainnet'),null,{timeout:12000}).catch(()=>{});
  // Need the latest mainnet allowance to become zero only after the wallet tx is sent:
  // mock returns zero after the first receipt in the successful case.
  if(scenario==='success'){
   await page.waitForFunction(()=>document.querySelector('#revoke-status')?.textContent.includes('Confirmed on Robinhood mainnet'),null,{timeout:12000});
   assert.equal(await page.locator('#revoke-proof').isVisible(),true);
  }else if(scenario==='edited-during-check'){
   await page.locator('#feedback[data-kind="error"]').waitFor({state:'visible',timeout:12000});
   assert.match(await page.locator('#feedback').innerText(),/checked permission changed/);
  }else{
   await page.locator('#revoke-status[data-kind="error"]').waitFor({state:'visible',timeout:12000});
   assert.equal(await page.locator('#revoke-status').innerText()!=='',true);
  }
  const n=await page.evaluate(()=>window.__requests?.length||0);
  assert.equal(n,['success','reject','failed-receipt','nonzero-after'].includes(scenario)?1:0,'Unexpected wallet confirmation request: '+scenario);
  assert.deepEqual(errors,[],'Browser exception: '+scenario);
  await page.close();
  console.log('PASS '+scenario);
 }
}finally{await browser.close();await new Promise(ok=>server.close(ok));}
