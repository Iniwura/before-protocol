import {WIF_TOKEN,WIF_MAINNET_CHAIN_ID,WIF_RPC,WIF_EXPLORER,isAddress,same,allowanceData,readUint,isWifSymbol,revokeApprovalData} from './wif-core.mjs';

// This module cannot transfer WIF. It can only request approve(spender, 0)
// from the owner shown in a freshly completed read-only scan.
const $ = id => document.getElementById(id);
let checked = null, busy = false, scanGeneration = 0;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function publicRpc(method, params=[]){
 const response = await fetch(WIF_RPC,{method:'POST',headers:{'content-type':'application/json'},cache:'no-store',body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
 const body = await response.json();
 if(!response.ok || body.error || body.result === undefined) throw Error(body.error?.message || 'Public mainnet RPC unavailable.');
 return body.result;
}
function message(text, error=false){
 $('revoke-status').textContent=text;
 $('revoke-status').dataset.kind=error?'error':'info';
 $('revoke-status').hidden=false;
}
function reset(){
 scanGeneration++;
 checked=null;
 $('revoke-action').hidden=true;
 $('revoke-confirm').checked=false;
 $('revoke-button').disabled=true;
 $('revoke-proof').hidden=true;
 $('revoke-status').hidden=true;
}
document.addEventListener('before:wif-scan-start', reset);
document.addEventListener('before:wif-scan-complete', event=>{
 reset();
 const {owner,spender,allowance}=event.detail||{};
 if(!isAddress(owner)||!isAddress(spender)||typeof allowance!=='bigint') return;
 if(allowance===0n) return;
 checked={owner,spender,allowance};
 $('revoke-owner').textContent=owner;
 $('revoke-spender').textContent=spender;
 $('revoke-action').hidden=false;
});
$('revoke-confirm').addEventListener('change',()=>{$('revoke-button').disabled=busy||!$('revoke-confirm').checked||!checked;});
$('revoke-button').addEventListener('click',async()=>{
 if(busy||!checked||!$('revoke-confirm').checked)return;
 const target={...checked};
 const thisScan=scanGeneration;
 const wallet=window.ethereum;
 if(!wallet?.request){message('Install or enable a compatible browser wallet to revoke this permission.',true);return;}
 busy=true;$('revoke-button').disabled=true;$('revoke-proof').hidden=true;
 try{
  message('Checking your wallet and the current WIF allowance…');
  const accounts=await wallet.request({method:'eth_requestAccounts'});
  if(!Array.isArray(accounts)||!accounts.some(account=>same(account,target.owner)))throw Error('Connect the wallet that owns this WIF approval. No transaction was requested.');
  const chain=BigInt(await wallet.request({method:'eth_chainId'}));
  if(chain!==BigInt(WIF_MAINNET_CHAIN_ID))throw Error('Change your wallet to Robinhood Chain mainnet (4663), then retry. No transaction was requested.');
  if(BigInt(await publicRpc('eth_chainId'))!==BigInt(WIF_MAINNET_CHAIN_ID))throw Error('Mainnet verification failed.');
  const [symbol,decimals,code,current] = await Promise.all([
   publicRpc('eth_call',[{to:WIF_TOKEN,data:'0x95d89b41'},'latest']),
   publicRpc('eth_call',[{to:WIF_TOKEN,data:'0x313ce567'},'latest']),
   publicRpc('eth_getCode',[WIF_TOKEN,'latest']),
   publicRpc('eth_call',[{to:WIF_TOKEN,data:allowanceData(target.owner,target.spender)},'latest'])
  ]);
  if(!isWifSymbol(symbol)||BigInt(decimals)!==18n||!code||code==='0x')throw Error('Official WIF contract verification failed.');
  if(readUint(current)===0n)throw Error('This spender already has a zero allowance. Run a new check.');
  // Wallet providers must not silently change account or chain between verification and sending.
  if(!same((await wallet.request({method:'eth_accounts'}))[0],target.owner)
      ||BigInt(await wallet.request({method:'eth_chainId'}))!==BigInt(WIF_MAINNET_CHAIN_ID))
   throw Error('Wallet account or network changed. Run a new check.');
  if(thisScan!==scanGeneration || !checked || !same(checked.owner,target.owner) || !same(checked.spender,target.spender))
   throw Error('The checked permission changed. Run a fresh scan before confirming a transaction.');
  const data=revokeApprovalData(target.spender);
  message('Your wallet will ask you to confirm approve(spender, 0). This costs mainnet gas but transfers no WIF.');
  const hash=await wallet.request({method:'eth_sendTransaction',params:[{from:target.owner,to:WIF_TOKEN,data,value:'0x0'}]});
  if(typeof hash!=='string'||!/^0x[0-9a-fA-F]{64}$/.test(hash))throw Error('Wallet did not return a valid transaction hash.');
  message('Submitted. Waiting for the public mainnet transaction receipt…');
  let receipt=null;
  for(let i=0;i<45;i++){
   receipt=await publicRpc('eth_getTransactionReceipt',[hash]);
   if(receipt)break;
   await sleep(2000);
  }
  if(!receipt)throw Error('Transaction submitted but not yet confirmed. Check its hash in your wallet and rescan.');
  const tx=await publicRpc('eth_getTransactionByHash',[hash]);
  if(!tx||!same(tx.from,target.owner)||!same(tx.to,WIF_TOKEN)||!same(tx.input,data)
     ||!same(receipt.from,target.owner)||!same(receipt.to,WIF_TOKEN)
     ||!same(receipt.transactionHash,hash)||receipt.status!=='0x1')
   throw Error('Receipt did not verify as a successful WIF approval revocation. Check the explorer.');
  const remaining=readUint(await publicRpc('eth_call',[{to:WIF_TOKEN,data:allowanceData(target.owner,target.spender)},'latest']));
  $('revoke-proof-link').href=WIF_EXPLORER+'/tx/'+hash;
  $('revoke-proof').hidden=false;
  if(remaining!==0n)throw Error('Transaction succeeded, but the latest allowance is not zero. Do not assume permission was revoked. Rescan.');
  message('Confirmed on Robinhood mainnet: this specific spender now has zero WIF allowance.');
  checked=null;
  $('revoke-action').hidden=true;
 }catch(error){
  const msg=String(error?.message||error);
  message(/rejected|denied|4001/.test(msg.toLowerCase())?'Wallet confirmation was rejected. No revocation confirmed.':msg,true);
 }finally{
  busy=false;
  $('revoke-button').disabled=!checked||!$('revoke-confirm').checked;
 }
});
