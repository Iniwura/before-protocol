import {CHAIN_ID,RPC_URL,EXPLORER,isAddress,isTxHash,evaluateProtect,evaluateChallenge,parseHexUint,decodeAddress,format18} from './core.mjs';
import {SELECTORS,encodeAddressCall,encodeDemoCreate,encodePracticeCreate,encodeDemoWithdraw,encodePracticeProof,readAddressResult,readBoolResult,readUintResult,deploymentReady} from './onchain.mjs';
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
function compactAddress(address){return address.slice(0,6)+'…'+address.slice(-4);}
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
    if (verifiedDemo) {
      try {
        const registered = readBoolResult(await call(verifiedDemo.factory,encodeAddressCall(SELECTORS.isVault,address)));
        const proof = document.createElement('p');
        proof.textContent = registered
          ? 'This address appears in the configured BEFORE testnet factory registry. Factory registration is not a security audit.'
          : 'This address is NOT registered in the configured BEFORE testnet factory.';
        target.append(proof);
      } catch { /* Do not claim registration if factory lookup fails. */ }
    }
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
initializeOnchain();

let verifiedDemo = null;
let ownedDemoVault = null;
let ownedPractice = null;
let activeWallet = null;

function showOnchainStatus(id, message, txHash = null) {
  const target = $(id);
  target.replaceChildren();
  target.append(document.createTextNode(message));
  if (txHash && isTxHash(txHash)) {
    const link = document.createElement('a');
    link.href = EXPLORER + '/tx/' + txHash;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = ' View transaction ↗';
    target.append(link);
  }
}

async function initializeOnchain() {
  try {
    const response = await fetch('./deployment.json', {cache:'no-store'});
    if (!response.ok) return;
    const config = await response.json();
    if (!deploymentReady(config)) return;
    await assertNetwork();
    const [factoryCode,tokenCode,challengeCode] = await Promise.all([
      rpc('eth_getCode',[config.factory,'latest']),
      rpc('eth_getCode',[config.mockToken,'latest']),
      rpc('eth_getCode',[config.challengeEscrow,'latest'])
    ]);
    if (!factoryCode || factoryCode==='0x' || !tokenCode || tokenCode==='0x' || !challengeCode || challengeCode==='0x') return;
    const hasCreatedOutputs = config.demoVault && config.practiceArena && config.practiceVault;
    if (hasCreatedOutputs) {
      const outputCodes = await Promise.all([
        rpc('eth_getCode',[config.demoVault,'latest']),
        rpc('eth_getCode',[config.practiceArena,'latest']),
        rpc('eth_getCode',[config.practiceVault,'latest'])
      ]);
      if (outputCodes.some(code => !code || code==='0x')) return;
    }
    const nextChallengeId = readUintResult(await call(config.challengeEscrow,SELECTORS.nextChallengeId));
    // The manifest is created only after manual explorer verification; the browser checks chain and existence.
    verifiedDemo = config;
    $('proof-escrow').textContent=compactAddress(config.challengeEscrow);
    $('proof-escrow').title=config.challengeEscrow;
    if (config.demoVault) {
      $('proof-demo-meta').hidden = false;
      $('proof-demo').textContent=compactAddress(config.demoVault);
      $('proof-demo').title=config.demoVault;
      $('vault-address').value=config.demoVault;
    }
    if (config.practiceArena && config.practiceVault) {
      $('proof-practice-meta').hidden = false;
      $('proof-practice').textContent=compactAddress(config.practiceArena);
      $('proof-practice').title=config.practiceArena;
    }
    if (config.allowedTx && config.deniedTx && config.practiceProofTx) {
      $('proof-flow-meta').hidden = false;
      $('proof-flow').textContent='3 receipts verified';
    }
    $('onchain-escrow').hidden = false;
    $('onchain-escrow-status').textContent = nextChallengeId === 1n
      ? 'Escrow deployed and empty. No WIF reward is funded.'
      : String(nextChallengeId - 1n) + ' challenge record(s) exist. No demo reward is funded.';
    $('onchain-protect').hidden = false;
    $('onchain-challenge').hidden = false;
  } catch {
    // Fail closed. Keep the research-only experience available, without blockchain claims.
  }
}

async function getDemoWallet() {
  if (!verifiedDemo) throw new Error('No verified testnet deployment is configured.');
  const provider = window.ethereum;
  if (!provider || typeof provider.request !== 'function') throw new Error('Connect an EVM browser wallet to use the testnet demo.');
  const accounts = await provider.request({method:'eth_requestAccounts'});
  const owner = accounts?.[0];
  if (!isAddress(owner)) throw new Error('Wallet did not provide a valid address.');
  const requested = '0x' + CHAIN_ID.toString(16);
  let current = await provider.request({method:'eth_chainId'});
  if (parseHexUint(current) !== BigInt(CHAIN_ID)) {
    try {
      await provider.request({method:'wallet_switchEthereumChain',params:[{chainId:requested}]});
    } catch (error) {
      if (error?.code !== 4902) throw error;
      await provider.request({method:'wallet_addEthereumChain',params:[{
        chainId:requested,chainName:'Robinhood Chain Testnet',
        nativeCurrency:{name:'Ether',symbol:'ETH',decimals:18},
        rpcUrls:[RPC_URL],blockExplorerUrls:[EXPLORER]
      }]});
      await provider.request({method:'wallet_switchEthereumChain',params:[{chainId:requested}]});
    }
    current = await provider.request({method:'eth_chainId'});
    if (parseHexUint(current) !== BigInt(CHAIN_ID)) throw new Error('Wrong wallet network.');
  }
  await assertNetwork();
  return {provider,owner};
}

async function sendDemoTransaction({to,data,status,successText}) {
  if (!verifiedDemo) throw new Error('Testnet contracts have not been verified.');
  const {provider,owner} = await getDemoWallet();
  if (activeWallet && activeWallet.toLowerCase()!==owner.toLowerCase()) {
    throw new Error('Wallet changed. Refresh to begin with the new account.');
  }
  activeWallet=owner;
  showOnchainStatus(status,'Confirm the testnet transaction in your wallet…');
  const hash=await provider.request({method:'eth_sendTransaction',params:[{from:owner,to,data,value:'0x0'}]});
  if (!isTxHash(hash)) throw new Error('Wallet returned an invalid transaction hash.');
  showOnchainStatus(status,'Submitted. Waiting for onchain confirmation…',hash);
  let receipt=null;
  for (let i=0;i<45;i++) {
    try { receipt=await rpc('eth_getTransactionReceipt',[hash]); } catch { /* retry read errors */ }
    if (receipt) break;
    await new Promise(resolve=>setTimeout(resolve,1400));
  }
  if (!receipt) {
    showOnchainStatus(status,'Transaction submitted; receipt not yet confirmed.',hash);
    return null;
  }
  const transaction=await rpc('eth_getTransactionByHash',[hash]);
  const matchesRequest=transaction
    && typeof transaction.hash==='string'
    && transaction.hash.toLowerCase()===hash.toLowerCase()
    && typeof transaction.from==='string'
    && transaction.from.toLowerCase()===owner.toLowerCase()
    && typeof transaction.to==='string'
    && transaction.to.toLowerCase()===to.toLowerCase()
    && typeof transaction.input==='string'
    && transaction.input.toLowerCase()===data.toLowerCase()
    && parseHexUint(transaction.value??'0x0')===0n;
  if (!matchesRequest) {
    showOnchainStatus(status,'The mined transaction did not match the requested call. No success is claimed.',hash);
    return null;
  }
  if (receipt.status!=='0x1') {
    showOnchainStatus(status,'Transaction reverted. No successful action is claimed.',hash);
    return null;
  }
  showOnchainStatus(status,successText,hash);
  return {receipt,owner,hash};
}

$('create-demo-vault').addEventListener('click',async()=>{
  const button=$('create-demo-vault');button.disabled=true;
  try{
    const result=await sendDemoTransaction({
      to:verifiedDemo?.factory,
      data:encodeDemoCreate(verifiedDemo?.mockToken),
      status:'onchain-protect-status',
      successText:'Mock-token vault created on Robinhood Chain testnet.'
    });
    if (!result) return;
    const latest=readAddressResult(await call(verifiedDemo.factory,encodeAddressCall(SELECTORS.latestVaultOf,result.owner)));
    if (!latest || !readBoolResult(await call(verifiedDemo.factory,encodeAddressCall(SELECTORS.isVault,latest)))) throw new Error('Vault provenance not confirmed.');
    ownedDemoVault=latest;
    $('demo-withdraw').hidden=false;
    $('vault-address').value=latest;
    showOnchainStatus('onchain-protect-status','Vault registered: '+latest+'. Testnet mock assets only.',result.hash);
  }catch(error){showOnchainStatus('onchain-protect-status',error?.message||'Wallet action failed.');}
  finally{button.disabled=false;}
});
$('demo-withdraw').addEventListener('click',async()=>{
  if (!ownedDemoVault || !activeWallet) return;
  const button=$('demo-withdraw');button.disabled=true;
  try{
    const result=await sendDemoTransaction({to:ownedDemoVault,data:encodeDemoWithdraw(activeWallet),status:'onchain-protect-status',successText:'20 BTEST withdrawn under enforced policy.'});
    if(result)showOnchainStatus('onchain-protect-status','Real testnet withdrawal confirmed. 20 valueless BTEST moved.',result.hash);
  }catch(error){showOnchainStatus('onchain-protect-status',error?.message||'Withdrawal failed.');}
  finally{button.disabled=false;}
});
$('create-practice').addEventListener('click',async()=>{
  const button=$('create-practice');button.disabled=true;
  try{
    const result=await sendDemoTransaction({to:verifiedDemo?.factory,data:encodePracticeCreate(verifiedDemo?.mockToken),status:'onchain-challenge-status',successText:'Practice arena created on testnet.'});
    if (!result) return;
    const latest=readAddressResult(await call(verifiedDemo.factory,encodeAddressCall(SELECTORS.latestPracticeOf,result.owner)));
    if (!latest || !readBoolResult(await call(verifiedDemo.factory,encodeAddressCall(SELECTORS.isPractice,latest)))) throw new Error('Practice provenance not confirmed.');
    ownedPractice=latest;
    $('solve-practice').hidden=false;
    showOnchainStatus('onchain-challenge-status','Practice arena ready: '+latest+'. No financial reward.',result.hash);
  }catch(error){showOnchainStatus('onchain-challenge-status',error?.message||'Practice creation failed.');}
  finally{button.disabled=false;}
});
$('solve-practice').addEventListener('click',async()=>{
  if(!ownedPractice)return;
  const button=$('solve-practice');button.disabled=true;
  try{
    const result=await sendDemoTransaction({to:ownedPractice,data:encodePracticeProof(),status:'onchain-challenge-status',successText:'Mock-token split-bypass proven onchain.'});
    if(result){
      $('solve-practice').hidden=true;
      showOnchainStatus('onchain-challenge-status','Practice proof confirmed onchain. No real assets or rewards.',result.hash);
    }
  }catch(error){showOnchainStatus('onchain-challenge-status',error?.message||'Practice proof failed.');}
  finally{button.disabled=false;}
});
