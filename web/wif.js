import {WIF_TOKEN,WIF_MAINNET_CHAIN_ID,WIF_RPC,WIF_EXPLORER,
 isAddress,isHash,same,balanceData,allowanceData,readUint,
 parseApprovalTransaction,formatWif,permissionSummary,formatRPCBlock} from './wif-core.mjs';

const $=id=>document.getElementById(id);
const state={request:0};
const LIMIT=18000;
async function rpc(method,params=[]){
 const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),LIMIT);
 try{
  const res=await fetch(WIF_RPC,{method:'POST',headers:{'content-type':'application/json'},cache:'no-store',signal:abort.signal,
   body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
  const j=await res.json();
  if(!res.ok||j.error||j.result===undefined)throw Error(j.error?.message||'Mainnet RPC unavailable.');
  return j.result;
 }finally{clearTimeout(timer)}
}
function showFeedback(message,kind){
 const feedback=$('feedback');feedback.textContent=message;feedback.dataset.kind=kind||'info';feedback.hidden=false;
}
function setLink(id,address){
 const el=$(id);el.textContent=address+' ↗';el.href=WIF_EXPLORER+'/address/'+address;
}
function render(data){
 const {owner,spender,allowance,balance,block,code,approval}=data;
 const s=permissionSummary(allowance,balance);
 $('result-block').textContent='MAINNET BLOCK '+formatRPCBlock(block).toLocaleString('en-US');
 $('balance-value').textContent=formatWif(balance)+' WIF';
 $('allowance-value').textContent=formatWif(allowance)+' WIF';
 $('outcome-label').textContent=s.label;
 $('outcome-message').textContent=s.message;
 $('outcome').dataset.level=s.level;
 setLink('owner-link',owner);setLink('spender-link',spender);
 $('spender-type').textContent=code==='0x'?'Externally owned address / no contract code detected':'Smart contract / code present';
 $('historical-approval').hidden=!approval;
 $('approval-link-row').hidden=!approval;
 if(approval){
  $('historical-amount').textContent=formatWif(approval.approvedAmount)+' WIF at original approval';
  const link=$('approval-link');link.href=WIF_EXPLORER+'/tx/'+approval.hash;link.textContent='View original approval transaction ↗';
 }
 $('result').hidden=false;
}
async function checkApproval(){
 const hash=$('approval-tx').value.trim();
 const enteredOwner=$('owner').value.trim(),enteredSpender=$('spender').value.trim();
 if(hash){
  if(!isHash(hash))throw Error('Enter a complete 0x-prefixed transaction hash (64 hex characters).');
  const [tx,receipt]=await Promise.all([
   rpc('eth_getTransactionByHash',[hash]),rpc('eth_getTransactionReceipt',[hash])
  ]);
  return parseApprovalTransaction(tx,receipt);
 }
 if(!isAddress(enteredOwner)||!isAddress(enteredSpender)){
  $('manual-entry').open=true;
  throw Error('Paste a WIF approval transaction, or enter both a valid wallet and spender address.');
 }
 return {owner:enteredOwner,spender:enteredSpender,approvedAmount:null,hash:null};
}
$('check-form').addEventListener('submit',async event=>{
 event.preventDefault();
 const index=++state.request;
 const button=$('scan-button');button.disabled=true;
 $('result').hidden=true;
 showFeedback('Checking WIF on Robinhood Chain mainnet…');
 try{
  const chain=BigInt(await rpc('eth_chainId'));
  if(chain!==BigInt(WIF_MAINNET_CHAIN_ID))throw Error('Connected RPC is not Robinhood Chain mainnet. No result is trusted.');
  const snapshot=await rpc('eth_blockNumber');
  const contract=await rpc('eth_getCode',[WIF_TOKEN,snapshot]);
  if(!contract||contract==='0x')throw Error('Official WIF contract code not found on mainnet.');
  const [symbol,decimals,approval]=await Promise.all([
   rpc('eth_call',[{to:WIF_TOKEN,data:'0x95d89b41'},snapshot]),
   rpc('eth_call',[{to:WIF_TOKEN,data:'0x313ce567'},snapshot]),
   checkApproval()
  ]);
  if(BigInt(decimals)!==18n||!/^0x[0-9a-fA-F]+$/.test(symbol)||
     !symbol.toLowerCase().includes('574946'))throw Error('Mainnet contract metadata did not match WIF.');
  const [bal,allowance,spenderCode]=await Promise.all([
   rpc('eth_call',[{to:WIF_TOKEN,data:balanceData(approval.owner)},snapshot]),
   rpc('eth_call',[{to:WIF_TOKEN,data:allowanceData(approval.owner,approval.spender)},snapshot]),
   rpc('eth_getCode',[approval.spender,snapshot])
  ]);
  if(index!==state.request)return;
  render({...approval,balance:readUint(bal),allowance:readUint(allowance),code:spenderCode,block:snapshot,approval:approval.hash?approval:null});
  $('feedback').hidden=true;
  $('result').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
 }catch(error){
  if(index!==state.request)return;
  const raw=String(error?.message||error);
  showFeedback(raw.includes('abort')?'The public RPC did not respond. Retry when the network is available.':raw,'error');
 }finally{if(index===state.request)button.disabled=false}
});
$('approval-tx').addEventListener('input',()=>{
 if($('approval-tx').value.trim()){
  $('owner').value='';$('spender').value='';
 }
});
for(const id of ['owner','spender']){
 $(id).addEventListener('input',()=>{if($(id).value.trim())$('approval-tx').value=''});
}
