import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../web');
const token='0x5173b8eA6923c2d40267890D45C46a3480954773';
const owner='0x'+'1'.repeat(40),spender='0x'+'2'.repeat(40),hash='0x'+'a'.repeat(64);
const word=v=>BigInt(v).toString(16).padStart(64,'0');
const symbol='0x'+word(32)+word(3)+'574946'.padEnd(64,'0');
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.svg':'image/svg+xml'};
const allowed=new Set(['app/wif/index.html','wif.css','wif.js','wif-core.mjs','wif-revoke.mjs','favicon.svg']);
const site=createServer(async(req,res)=>{
 const uri=new URL(req.url,'http://localhost');
 const rel=uri.pathname==='/app/wif/'?'app/wif/index.html':uri.pathname.slice(1);
 if(!allowed.has(rel)){res.writeHead(404);return res.end('Not found');}
 try{const content=await readFile(path.join(root,rel));res.writeHead(200,{'content-type':mime[path.extname(rel)]||'text/plain'});res.end(content)}
 catch{res.writeHead(404);res.end('Not found')}
});
await new Promise(ok=>site.listen(0,'127.0.0.1',ok));
const base='http://127.0.0.1:'+site.address().port;
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const outputs=[];
try{
 for(const width of [320,375,768,1280]){
  const page=await browser.newPage({viewport:{width,height:860},reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  let chain='0x1237',incorrectToken=false,txTo=token;
  const methods=[];
  await page.route('https://rpc.mainnet.chain.robinhood.com/**',async route=>{
   const body=route.request().postDataJSON();
   methods.push(body.method);
   let value='0x';
   if(body.method==='eth_chainId')value=chain;
   if(body.method==='eth_blockNumber')value='0x123456';
   if(body.method==='eth_getCode')value=body.params[0].toLowerCase()===spender.toLowerCase()?'0x':'0x60016001';
   if(body.method==='eth_getTransactionByHash')value={hash,from:owner,to:txTo,input:'0x095ea7b3'+spender.slice(2).padStart(64,'0')+word(99n*10n**18n)};
   if(body.method==='eth_getTransactionReceipt')value={transactionHash:hash,from:owner,to:txTo,status:'0x1',blockNumber:'0x123450'};
   if(body.method==='eth_call'){
    const data=body.params[0].data.toLowerCase();
    value=data==='0x95d89b41'?(incorrectToken?'0x':'0x'+symbol.slice(2)):data==='0x313ce567'?'0x'+word(18):data.startsWith('0x70a08231')?'0x'+word(10n*10n**18n):data.startsWith('0xdd62ed3e')?'0x'+word(20n*10n**18n):'0x';
   }
   await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({jsonrpc:'2.0',id:body.id,result:value})});
  });
  await page.goto(base+'/app/wif/',{waitUntil:'domcontentloaded'});
  const dims=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
  assert.ok(dims.scroll<=dims.client+1,'WIF view must not overflow: '+width);
  assert.equal(await page.locator('input[type="password"]').count(),0);
  await page.addScriptTag({path:path.resolve(root,'../qa/node_modules/axe-core/axe.min.js')});
  const axe=async()=>page.evaluate(async()=> (await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}})).violations.map(v=>({id:v.id,impact:v.impact,targets:v.nodes.map(n=>n.target)})));
  assert.deepEqual(await axe(),[],'WIF start page WCAG '+width);
  await page.locator('#manual-entry summary').click();
  await page.locator('#owner').fill(owner);
  await page.locator('#spender').fill(spender);
  await page.locator('#scan-button').click();
  await page.locator('#result').waitFor({state:'visible',timeout:12000});
  assert.equal(await page.locator('#outcome-label').innerText(),'Approval exceeds current balance');
  assert.equal(await page.locator('#allowance-value').innerText(),'20 WIF');
  assert.match(await page.locator('#spender-type').innerText(),/Externally owned/);
  assert.deepEqual(await axe(),[],'WIF result WCAG '+width);
  await page.locator('#approval-tx').fill(hash);
  await page.locator('#scan-button').click();
  await page.locator('#historical-approval').waitFor({state:'visible',timeout:12000});
  assert.equal(await page.locator('#historical-amount').innerText(),'99 WIF at original approval');
  assert.match(await page.locator('#approval-link').getAttribute('href'),new RegExp(hash+'$'));
  chain='0xb626';
  await page.locator('#scan-button').click();
  await page.locator('#feedback').waitFor({state:'visible'});
  await page.waitForFunction(()=>document.querySelector('#feedback').textContent.includes('not Robinhood Chain mainnet'));
  assert.equal(await page.locator('#result').isHidden(),true,'Incorrect chain must fail closed');
  chain='0x1237';txTo=owner;
  await page.locator('#scan-button').click();
  await page.waitForFunction(()=>document.querySelector('#feedback').textContent.includes('not a confirmed standard WIF'));
  assert.equal(await page.locator('#result').isHidden(),true,'Unrelated ERC20 approval must fail closed');
  assert.equal(methods.includes('eth_sendTransaction'),false,'WIF check must never sign or broadcast');
  assert.deepEqual(errors,[],'WIF browser errors '+width);
  outputs.push({width,overflow:false,wcagViolations:0,mainnetRead:true,txDecode:true,failClosed:true,signatures:0});
  await page.close();
 }
 console.log(JSON.stringify({status:'PASS',results:outputs},null,2));
}finally{await browser.close();await new Promise(ok=>site.close(ok))}
