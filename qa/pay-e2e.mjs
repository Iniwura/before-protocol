import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {chromium} from 'playwright';
import {WIF_TOKEN,TRANSFER_TOPIC} from '../web/pay-core.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../web');
const files={
  '/':'index.html','/app/pay/':'app/pay/index.html','/pay.js':'pay.js','/pay-core.mjs':'pay-core.mjs','/pay.css':'pay.css','/favicon.svg':'favicon.svg',
  '/styles.css':'styles.css','/app.js':'app.js','/core.mjs':'core.mjs','/onchain.mjs':'onchain.mjs','/deployment.json':'deployment.json'
};
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.css':'text/css; charset=utf-8'};
const server=createServer(async(req,res)=>{
  const file=files[new URL(req.url,'http://localhost').pathname];
  if(!file){res.writeHead(404);res.end('Not found');return;}
  try{const data=await readFile(path.join(root,file));res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(data)}catch{res.writeHead(404);res.end('Not found')}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
const recipient='0x1111111111111111111111111111111111111111';
const payer='0x2222222222222222222222222222222222222222';
const signature='0x'+'01'.repeat(32)+'02'.repeat(32)+'1b';
const txHash='0x'+'de'.repeat(32);
const problems=[];
let browser;

function wordAddress(address){return '0x'+address.slice(2).toLowerCase().padStart(64,'0')}
function wordUint(value){return '0x'+BigInt(value).toString(16).padStart(64,'0')}
function routeRPC(page,{chain='0x1237',account=payer,recipientCode='0x',rejectSign=false,rejectSend=false}={}){
  let sentTx=null;
  const mockData='0xa9059cbb'+recipient.slice(2).padStart(64,'0')+(1250000000000000000n).toString(16).padStart(64,'0');
  return page.route('https://rpc.mainnet.chain.robinhood.com/**',route=>{
    const body=JSON.parse(route.request().postData()||'{}');
    let result=null;
    if(body.method==='eth_chainId')result=chain;
    else if(body.method==='eth_getCode')result=body.params[0].toLowerCase()===recipient.toLowerCase()?recipientCode:'0x60016000';
    else if(body.method==='eth_call'){
      const call=body.params[0]||{}; const selector=call.data?.slice(0,10)?.toLowerCase();
      if(call.to?.toLowerCase()==='0x0000000000000000000000000000000000000001')result='0x'+'0'.repeat(24)+recipient.slice(2);
      else if(selector==='0x95d89b41')result='0x'+'0'.repeat(62)+'20'+'0'.repeat(62)+'03'+'574946'+'0'.repeat(58);
      else if(selector==='0x313ce567')result=wordUint(18);
      else if(selector==='0x70a08231')result=wordUint(5_000_000_000_000_000_000n);
      else result=wordUint(1);
    } else if(body.method==='eth_getBalance')result=wordUint(1_000_000_000_000_000_000n);
    else if(body.method==='eth_gasPrice')result='0x1';
    else if(body.method==='eth_estimateGas')result='0x5208';
    else if(body.method==='eth_blockNumber')result='0x66';
    else if(body.method==='eth_getTransactionByHash'){
      result={hash:txHash,from:sentTx?.from||payer,to:sentTx?.to||WIF_TOKEN,input:sentTx?.data||mockData,value:sentTx?.value||'0x0',chainId:'0x1237'};
    } else if(body.method==='eth_getTransactionReceipt'){
      result={transactionHash:txHash,status:'0x1',blockNumber:'0x64',from:sentTx?.from||payer,to:sentTx?.to||WIF_TOKEN,logs:[{
        address:WIF_TOKEN,topics:[TRANSFER_TOPIC,wordAddress(sentTx?.from||payer), '0x'+(sentTx?.data||mockData).slice(10,74)],data:'0x'+(sentTx?.data||mockData).slice(74)
      }]};
    }
    return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({jsonrpc:'2.0',id:1,result})});
  }).then(()=>sentTx);
}
function wallet(page,{mode='payer',chain='0x1237',missing=false,rejectSign=false,rejectSend=false}={}){
  return page.addInitScript(({account,chain,signature,missing,rejectSign,rejectSend,txHash})=>{
    window.__walletTransactions=[];
    if(missing)return;
    window.ethereum={
      on:()=>{},
      request:async({method,params})=>{
        if(method==='eth_chainId')return chain;
        if(method==='eth_requestAccounts'||method==='eth_accounts')return [account];
        if(method==='eth_signTypedData_v4'){
          if(rejectSign){const error=new Error('User rejected the request');error.code=4001;throw error;}
          window.__typedData=JSON.parse(params[1]); return signature;
        }
        if(method==='eth_sendTransaction'){
          if(rejectSend){const error=new Error('User rejected the request');error.code=4001;throw error;}
          window.__walletTransactions.push(params[0]); return txHash;
        }
        throw new Error('Unexpected wallet method '+method);
      }
    };
  },{account:mode==='recipient'?recipient:payer,chain,signature,rejectSign,rejectSend,missing,txHash});
}
async function noAxeViolations(page){
  return page.evaluate(async()=>{const {violations}=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.length}))});
}
async function assertNoOverflow(page,width){const size=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));if(size.scroll>size.client+1)problems.push(`${width}px horizontal overflow ${JSON.stringify(size)}`)}

try{
  browser=await chromium.launch({headless:true});
  for(const width of [320,375,390,768,1280]){
    const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
    const page=await context.newPage();
    page.on('pageerror',e=>problems.push(`${width}px page error: ${e.message}`));
    await page.goto(base+'/app/pay/',{waitUntil:'domcontentloaded'});
    await page.addScriptTag({path:path.join(here,'node_modules/axe-core/axe.min.js')});
    assert.deepEqual(await noAxeViolations(page),[]);
    await assertNoOverflow(page,width);
    assert.equal(await page.locator('#create-card').isHidden(),false);
    await context.close();
  }

  const missingContext=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'});
  const missingPage=await missingContext.newPage();
  await wallet(missingPage,{missing:true});
  await missingPage.goto(base+'/app/pay/',{waitUntil:'domcontentloaded'});
  await missingPage.locator('#pay-amount').fill('1');
  await missingPage.locator('#create-request').click();
  await missingPage.waitForFunction(()=>document.querySelector('#pay-feedback').textContent.includes('No EIP-1193 wallet'));
  assert.equal(await missingPage.locator('#pay-feedback').getAttribute('data-kind'),'error');
  await missingContext.close();

  const wrongChainContext=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'});
  const wrongChainPage=await wrongChainContext.newPage();
  await wallet(wrongChainPage,{mode:'recipient',chain:'0xb626'});
  await wrongChainPage.goto(base+'/app/pay/',{waitUntil:'domcontentloaded'});
  await wrongChainPage.locator('#pay-amount').fill('1'); await wrongChainPage.locator('#create-request').click();
  await wrongChainPage.waitForFunction(()=>document.querySelector('#pay-feedback').textContent.includes('not connected to Robinhood Chain mainnet'));
  await wrongChainContext.close();

  const rejectedContext=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'});
  const rejectedPage=await rejectedContext.newPage();
  await wallet(rejectedPage,{mode:'recipient',rejectSign:true});
  await rejectedPage.goto(base+'/app/pay/',{waitUntil:'domcontentloaded'});
  await rejectedPage.locator('#pay-amount').fill('1'); await rejectedPage.locator('#create-request').click();
  await rejectedPage.waitForFunction(()=>document.querySelector('#pay-feedback').textContent.includes('signature was rejected'));
  assert.equal(await rejectedPage.locator('#share-card').isHidden(),true);
  await rejectedContext.close();

  const creatorContext=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'});
  const creator=await creatorContext.newPage();
  await wallet(creator,{mode:'recipient'}); await routeRPC(creator,{account:recipient});
  await creator.goto(base+'/app/pay/',{waitUntil:'domcontentloaded'});
  await creator.locator('#pay-amount').fill('1.25'); await creator.locator('#create-request').click();
  await creator.locator('#share-card').waitFor({state:'visible'});
  const link=await creator.locator('#share-link').inputValue();
  assert.match(link,/\/app\/pay\/\?request=/);
  assert.equal(await creator.evaluate(()=>window.__walletTransactions.length),0,'Creating a request must never send a transaction');
  assert.equal(await creator.locator('#request-state').innerText(),'Signed · needs check');
  await creator.addScriptTag({path:path.join(here,'node_modules/axe-core/axe.min.js')});
  assert.deepEqual(await noAxeViolations(creator),[]);
  await creatorContext.close();

  const payerContext=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'});
  const payerPage=await payerContext.newPage();
  await wallet(payerPage,{mode:'payer'}); await routeRPC(payerPage,{account:payer});
  await payerPage.goto(link,{waitUntil:'domcontentloaded'});
  await payerPage.locator('#check-card').waitFor({state:'visible'});
  await payerPage.locator('#check-payment').click();
  await payerPage.locator('#check-results').waitFor({state:'visible'});
  assert.equal(await payerPage.locator('#pay-now').isDisabled(),false);
  await payerPage.locator('#pay-now').click();
  await payerPage.locator('#proof-card').waitFor({state:'visible'});
  assert.equal(await payerPage.locator('#proof-confirmations').innerText(),'3 confirmations');
  const txs=await payerPage.evaluate(()=>window.__walletTransactions);
  assert.equal(txs.length,1,'Repeated click must not send more than one transaction');
  assert.equal(txs[0].to.toLowerCase(),WIF_TOKEN.toLowerCase());
  assert.equal(txs[0].value,'0x0');
  assert.equal(txs[0].data.slice(0,10),'0xa9059cbb');
  assert.equal(txs[0].data.length,138);
  const proofUrl=payerPage.url(); assert.match(proofUrl,/&tx=0x/);
  await payerPage.addScriptTag({path:path.join(here,'node_modules/axe-core/axe.min.js')});
  assert.deepEqual(await noAxeViolations(payerPage),[]);
  await payerContext.close();

  const reloadContext=await browser.newContext({viewport:{width:390,height:900},reducedMotion:'reduce'});
  const reloadPage=await reloadContext.newPage(); await routeRPC(reloadPage,{account:payer});
  await reloadPage.goto(proofUrl,{waitUntil:'domcontentloaded'}); await reloadPage.locator('#proof-card').waitFor({state:'visible'});
  assert.match(await reloadPage.locator('#pay-feedback').innerText(),/independently revalidated/);
  assert.equal(await reloadPage.evaluate(()=>window.__walletTransactions?.length??0),0,'Receipt proof reload must be read-only');
  await reloadContext.close();
  assert.equal(problems.length,0,problems.join('\n'));
  console.log(JSON.stringify({viewports:[320,375,390,768,1280],axeAudits:7,missingWallet:'PASS',wrongNetwork:'PASS',rejectedSignature:'PASS',requestCreationNoBroadcast:'PASS',exactMockedTransfer:'PASS',independentProofReload:'PASS',results:'PASS'},null,2));
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve))}
