import {CHAIN_ID,RPC_URL,EXPLORER,isAddress,isTxHash,evaluateProtect,evaluateChallenge,parseHexUint,decodeAddress,format18} from './core.mjs';
const $=(id)=>document.getElementById(id);
const all=(selector)=>Array.from(document.querySelectorAll(selector));

function activateTab(name,focus=false){
  for(const button of all('[role="tab"]')) {
    const active=button.dataset.tab===name;
    button.classList.toggle('active',active);
    button.setAttribute('aria-selected',String(active));
    button.tabIndex=active?0:-1;
    if(active&&focus)button.focus();
  }
  for(const panel of all('[role="tabpanel"]')) {
    const active=panel.id==='panel-'+name;
    panel.hidden=!active;
    panel.classList.toggle('active',active);
  }
  history.replaceState(null,'','#'+name);
}
const tabs=all('[role="tab"]');
for(const button of tabs){
  button.addEventListener('click',()=>activateTab(button.dataset.tab));
  button.addEventListener('keydown',(event)=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();
    const index=tabs.indexOf(button);
    const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
    activateTab(tabs[next].dataset.tab,true);
  });
}
const hash=location.hash.slice(1);
if(['protect','challenge','proof'].includes(hash))activateTab(hash);
window.addEventListener('hashchange',()=>{const h=location.hash.slice(1);if(['protect','challenge','proof'].includes(h))activateTab(h);});

function renderPolicy(){
  const box=$('protect-result');
  const approved=document.querySelector('input[name="destination"]:checked')?.value==='approved';
  let result;
  try{result=evaluateProtect({amount:$('protect-amount').value,spent:$('protect-spent').value,approved});}
  catch(error){result={kind:'invalid',reason:error.message};}
  const allowed=result.kind==='allowed';
  box.classList.toggle('is-allowed',allowed);
  $('protect-symbol').textContent=allowed?'✓':result.kind==='invalid'?'!':'×';
  $('protect-tag').textContent=allowed?'ALLOWED':result.kind==='invalid'?'INVALID INPUT':'BLOCKED';
  $('protect-result-title').textContent=allowed?'Within policy.':result.kind==='invalid'?'Check the input.':'Transfer denied.';
  $('protect-result-text').textContent=result.reason;
}
$('protect-form').addEventListener('submit',(event)=>{event.preventDefault();renderPolicy();});
renderPolicy();

function renderPractice(){
  let result;
  try{result=evaluateChallenge({first:$('challenge-a').value,second:$('challenge-b').value});}
  catch(error){result={kind:'invalid',reason:error.message};}
  $('challenge-first-icon').textContent=result.kind==='invalid'?'!':'✓';
  $('challenge-total-icon').textContent=result.kind==='bypass'?'!':result.kind==='not-bypass'?'✓':'–';
  $('challenge-total-label').textContent=result.total?result.total+' total vs 100 allowed':'100-token intended daily cap';
  $('challenge-verdict').textContent=result.reason;
  $('challenge-verdict').style.borderLeftColor=result.kind==='bypass'?'#ea9c6d':result.kind==='not-bypass'?'#1aaf83':'#d2a154';
}
$('challenge-form').addEventListener('submit',(event)=>{event.preventDefault();renderPractice();});
renderPractice();

async function rpc(method,params=[]){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),9000);
  try{
    const response=await fetch(RPC_URL,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:controller.signal,cache:'no-store'});
    if(!response.ok)throw new Error('RPC returned HTTP '+response.status);
    const body=await response.json();
    if(body.error)throw new Error(body.error.message||'RPC error');
    if(body.result===undefined)throw new Error('RPC response was incomplete');
    return body.result;
  } finally {clearTimeout(timeout);}
}
async function assertNetwork(){
  const chain=Number(parseHexUint(await rpc('eth_chainId')));
  if(chain!==CHAIN_ID)throw new Error('Incorrect chain: '+chain);
}
async function refreshNetwork(){
  $('network-status-text').textContent='Testnet · Checking';
  $('network-dot').className='status-dot';
  try{
    await assertNetwork();
    const block=parseHexUint(await rpc('eth_blockNumber'));
    $('network-dot').className='status-dot ok';
    $('network-status-text').textContent='Testnet · Connected';
    $('proof-chain').textContent='Connected';
    $('proof-chain').className='chain-value status-ok';
    $('proof-block').textContent=block.toLocaleString('en-US');
  }catch(error){
    $('network-dot').className='status-dot offline';
    $('network-status-text').textContent='Testnet · Unavailable';
    $('proof-chain').textContent='Unavailable';
    $('proof-chain').className='chain-value status-error';
    $('proof-block').textContent='—';
  }
}
$('refresh-chain').addEventListener('click',refreshNetwork);

function setResult(target,message){target.replaceChildren();target.textContent=message;}
function addLookupRows(target,rows,link){
  const grid=document.createElement('div');grid.className='lookup-grid';
  for(const [label,value] of rows){
    const cell=document.createElement('div');const a=document.createElement('span');a.textContent=label;
    const b=document.createElement('strong');b.textContent=value;cell.append(a,b);grid.append(cell);
  }
  target.replaceChildren(grid);
  if(link){
    const a=document.createElement('a');a.href=link;a.textContent='View on Blockscout ↗';a.target='_blank';a.rel='noopener noreferrer';target.append(document.createElement('p'),a);
  }
}
const selectors={owner:'0x8da5cb5b',allowedRecipient:'0xcb943a37',token:'0xfc0c546a',maxPerTransfer:'0xd1129bf3',dailyLimit:'0x67eeba0c',remainingToday:'0xfc3c5515'};
async function call(address,signature){return rpc('eth_call',[{to:address,data:signature},'latest']);}
$('vault-form').addEventListener('submit',async(event)=>{
  event.preventDefault();
  const target=$('vault-result'),address=$('vault-address').value.trim();
  if(!isAddress(address)){setResult(target,'Enter a valid 0x-prefixed 20-byte address.');return;}
  setResult(target,'Reading contract state…');
  try{
    await assertNetwork();
    const code=await rpc('eth_getCode',[address,'latest']);
    if(!code||code==='0x')throw new Error('No contract code exists at that address.');
    const owner=decodeAddress(await call(address,selectors.owner));
    const recipient=decodeAddress(await call(address,selectors.allowedRecipient));
    const token=decodeAddress(await call(address,selectors.token));
    const perTransfer=format18(parseHexUint(await call(address,selectors.maxPerTransfer)));
    const daily=format18(parseHexUint(await call(address,selectors.dailyLimit)));
    const remaining=format18(parseHexUint(await call(address,selectors.remainingToday)));
    addLookupRows(target,[['Owner',owner],['Approved recipient',recipient],['Token',token],['Max transfer (18 decimals)',perTransfer],['Daily cap (18 decimals)',daily],['Remaining today (18 decimals)',remaining]],EXPLORER+'/address/'+address);
    const note=document.createElement('p');note.textContent='State was read using the BEFORE vault interface. Contract identity, token decimals and source verification are not established by this read.';target.append(note);
  }catch(error){setResult(target,'Unable to read vault: '+error.message);}
});
$('tx-form').addEventListener('submit',async(event)=>{
  event.preventDefault();const target=$('tx-result'),hash=$('tx-hash').value.trim();
  if(!isTxHash(hash)){setResult(target,'Enter a valid 0x-prefixed 32-byte transaction hash.');return;}
  setResult(target,'Fetching transaction receipt…');
  try{
    await assertNetwork();
    const receipt=await rpc('eth_getTransactionReceipt',[hash]);
    if(!receipt){setResult(target,'No mined receipt was found on Robinhood Chain testnet. The transaction may be pending or unknown.');return;}
    const success=receipt.status==='0x1';
    const status=success?'Confirmed success':receipt.status==='0x0'?'Execution reverted':'Unknown';
    const block=parseHexUint(receipt.blockNumber).toLocaleString('en-US');
    addLookupRows(target,[['Execution',status],['Block',block],['Sender',receipt.from??'—'],['Recipient',receipt.to??'Contract creation'],['Created contract',receipt.contractAddress??'—']],EXPLORER+'/tx/'+hash);
    const note=document.createElement('p');note.textContent='This receipt proves chain inclusion and reported execution status, not that a contract is secure.';target.append(note);
  }catch(error){setResult(target,'Unable to inspect transaction: '+error.message);}
});
refreshNetwork();
