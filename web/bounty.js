import {RPC_URL,EXPLORER} from './core.mjs';
import {deploymentReady} from './onchain.mjs';
import {
 CHAIN_ID,isAddress,isTxHash,amount,displayAmount,word,addr,bytes32,textHash,
 encodeCall,encodeCreate,encodeCommitmentFor,encodeCommit,encodeReveal,
 encodeApproveFinding,encodeId,encodeAddress,encodeAllowance,encodeMint,
 encodeApprove,encodeCommitmentStatus,encodeVerifierCreation,encodeReviewKey,
 parseChallenge,parseCommitment,decodeAddress,decodeNumber,challengeAllowed,
 reviewScopeHash,BOUNTY_SCOPE,safeEvidence,isValidChallengeId,hexFromBytes,
 eventChallengeId,EXPLORER_TX,EXPLORER_ADDRESS
} from './bounty-core.mjs';

const $=id=>document.getElementById(id);
const all=selector=>Array.from(document.querySelectorAll(selector));
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
const state={config:null,verifierArtifact:null,wallet:null,id:null,challenge:null,scope:null,busy:false};
const setText=(id,content)=>{$(id).textContent=String(content)};
const statuses=['Not submitted','Committed','Settled','Slashed','Bond refunded'];
function activity(message,receipt){
 setText('activity-text',message);
 const link=$('activity-link');link.hidden=!isTxHash(receipt);
 if(isTxHash(receipt))link.href=EXPLORER_TX(receipt);
}
function errorText(error){
 const message=error?.shortMessage||error?.message||String(error);
 if(/user rejected|user denied|rejected the request|4001/i.test(message))return 'Wallet confirmation was declined. No success is claimed.';
 return String(message).slice(0,350);
}
function setBusy(value){
 state.busy=value;
 for(const button of all('#workbench button,#create-form button,#solve-form button,#review-form button,.recovery-actions button')){
  if(button.id==='wallet-connect')continue;
  if(!button.classList.contains('role'))button.disabled=value;
 }
 // Other controls remain keyboard navigable; transaction handlers enforce state.busy.
}
const pause=ms=>new Promise(ok=>setTimeout(ok,ms));
async function rpc(method,params=[]){
 const controller=new AbortController();
 const t=setTimeout(()=>controller.abort(),13000);
 try{
  const res=await fetch(RPC_URL,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:controller.signal,cache:'no-store'});
  const payload=await res.json();
  if(!res.ok||payload.error||payload.result===undefined)throw Error(payload.error?.message||'Blockchain network unavailable.');
  return payload.result;
 }finally{clearTimeout(t)}
}
const read=(contract,data)=>rpc('eth_call',[{to:contract,data},'latest']);
async function checkChain(){
 const chain=Number(BigInt(await rpc('eth_chainId')));
 if(chain!==CHAIN_ID)throw Error('Wrong RPC network: '+chain);
 return chain;
}
async function getWallet(){
 if(!state.config)throw Error('Verified testnet deployment is unavailable. Refresh after the connection is restored.');
 if(!window.ethereum?.request)throw Error('Install an EVM browser wallet to sign Robinhood testnet transactions.');
 const provider=window.ethereum;
 const accounts=await provider.request({method:'eth_requestAccounts'});
 const wallet=accounts?.[0];
 if(!isAddress(wallet))throw Error('The wallet returned no valid address.');
 const targetChain='0x'+CHAIN_ID.toString(16);
 let chain=await provider.request({method:'eth_chainId'});
 if(BigInt(chain)!==BigInt(CHAIN_ID)){
  try{await provider.request({method:'wallet_switchEthereumChain',params:[{chainId:targetChain}]})}
  catch(e){
   if(e.code!==4902)throw e;
   await provider.request({method:'wallet_addEthereumChain',params:[{
    chainId:targetChain,chainName:'Robinhood Chain Testnet',
    nativeCurrency:{name:'Ether',symbol:'ETH',decimals:18},
    rpcUrls:[RPC_URL],blockExplorerUrls:[EXPLORER]
   }]});
   await provider.request({method:'wallet_switchEthereumChain',params:[{chainId:targetChain}]});
  }
  chain=await provider.request({method:'eth_chainId'});
  if(BigInt(chain)!==BigInt(CHAIN_ID))throw Error('Wallet did not switch to Robinhood testnet.');
 }
 await checkChain();
 if(state.wallet&&!same(state.wallet,wallet))throw Error('Account changed. Reconnect before continuing.');
 state.wallet=wallet;
 setText('wallet-label',wallet.slice(0,6)+'…'+wallet.slice(-4));
 await refreshCommitment();
 return wallet;
}
async function blockTime(){
 const block=await rpc('eth_getBlockByNumber',['latest',false]);
 return BigInt(block.timestamp);
}
async function sendTransaction({from,to,data,description}){
 if(state.busy!==true)throw Error('No transaction is in progress.');
 await checkChain();
 const owner=await getWallet();
 if(!same(from,owner))throw Error('Wallet account changed before signing.');
 if(typeof data!=='string'||!/^0x[0-9a-fA-F]+$/.test(data))throw Error('Invalid transaction calldata.');
 if(to!==null&&!isAddress(to))throw Error('Unexpected transaction destination.');
 activity(description+' · confirm in your wallet.');
 const payload={from:owner,data,value:'0x0'};
 if(to)payload.to=to;
 const hash=await window.ethereum.request({method:'eth_sendTransaction',params:[payload]});
 if(!isTxHash(hash))throw Error('Wallet returned no valid transaction hash.');
 activity(description+' · waiting for a mined receipt.',hash);
 for(let i=0;i<90;i++){
  const [receipt,transaction]=await Promise.all([
   rpc('eth_getTransactionReceipt',[hash]),
   rpc('eth_getTransactionByHash',[hash])
  ]);
  if(receipt){
   if(!transaction||!same(receipt.from,owner)||!same(transaction.from,owner)
    ||receipt.transactionHash?.toLowerCase()!==hash.toLowerCase()
    ||transaction.hash?.toLowerCase()!==hash.toLowerCase()
    ||(to&&!same(receipt.to,to))||(to&&!same(transaction.to,to))
    ||(to===null&&(receipt.to!==null||transaction.to!==null))
    ||transaction.input?.toLowerCase()!==data.toLowerCase()
    ||BigInt(transaction.value||'0x0')!==0n){
     throw Error('Mined transaction does not match the requested wallet action. No success claimed.');
   }
   if(receipt.status!=='0x1')throw Error('Transaction reverted onchain: '+hash);
   activity(description+' · confirmed on Robinhood testnet.',hash);
   return {hash,receipt};
  }
  await pause(1500);
 }
 throw Error('The transaction is still pending. Inspect it on Blockscout: '+hash);
}
async function runAction(label,fn){
 if(state.busy)return;
 state.busy=true;
 for(const b of all('.role-form button,.recovery-actions button'))b.disabled=true;
 try{await fn()}
 catch(e){activity(label+' · '+errorText(e))}
 finally{state.busy=false;for(const b of all('.role-form button,.recovery-actions button'))b.disabled=false}
}
function showRole(which){
 for(const button of all('[role="tab"]')){
  const active=button.dataset.role===which;
  button.classList.toggle('active',active);
  button.setAttribute('aria-selected',String(active));
  button.tabIndex=active?0:-1;
 }
 for(const section of all('[role="tabpanel"]'))section.hidden=section.id!=='role-'+which;
 const url=new URL(location.href);url.hash=which;history.replaceState(null,'',url.toString());
}
for(const button of all('[role="tab"]')){
 button.addEventListener('click',()=>showRole(button.dataset.role));
 button.addEventListener('keydown',e=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
  e.preventDefault();const tabs=all('[role="tab"]');const i=tabs.indexOf(button);
  const n=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
  showRole(tabs[n].dataset.role);tabs[n].focus();
 });
}
if(['sponsor','solver','reviewer','recover'].includes(location.hash.slice(1)))showRole(location.hash.slice(1));
window.addEventListener('hashchange',()=>{const h=location.hash.slice(1);if(['sponsor','solver','reviewer','recover'].includes(h))showRole(h)});

async function loadChallenge(id){
 if(!state.config)throw Error('The verified testnet deployment is not available.');
 if(!isValidChallengeId(id))throw Error('Enter a valid positive challenge ID.');
 await checkChain();
 const [result,scope]=await Promise.all([
  read(state.config.challengeEscrow,encodeId('challenges(uint256)',id)),
  read(state.config.challengeEscrow,encodeId('scopeHashes(uint256)',id))
 ]);
 const challenge=parseChallenge(result);
 if(!isAddress(challenge.sponsor)||/^0x0{40}$/i.test(challenge.sponsor))throw Error('No challenge exists with this ID.');
 if(!challengeAllowed(challenge,state.config)||!same(scope,reviewScopeHash)){
  throw Error('This challenge uses another token, target or review scope. Bounty Studio only supports its BTEST training challenges.');
 }
 const gate=await rpc('eth_getCode',[challenge.verifier,'latest']);
 if(!matchVerifierRuntime(gate,state.verifierArtifact)){
  throw Error('Reviewer gate is not an approved BEFORE ReviewedFindingVerifier deployment.');
 }
 const [threshold,reviewerCount]=await Promise.all([
  read(challenge.verifier,encodeCall('threshold()')),
  read(challenge.verifier,encodeCall('reviewerCount()'))
 ]);
 const quorum=Number(decodeNumber(threshold));
 if(quorum<1||quorum>3||quorum>Number(decodeNumber(reviewerCount)))throw Error('Reviewer quorum is outside studio limits.');
 state.id=String(id);state.challenge=challenge;state.scope=scope;
 $('challenge-id').value=String(id);
 const now=await blockTime();
 const status=challenge.canceled?'Canceled':challenge.rewardReleased?'Closed':now>challenge.revealDeadline?'Expired':now>challenge.commitDeadline?'Reveal open':'Commit open';
 setText('summary-reward',displayAmount(challenge.reward)+' BTEST');
 setText('summary-bond',displayAmount(challenge.bond)+' BTEST');
 setText('summary-state',status);
 setText('summary-commit',new Date(Number(challenge.commitDeadline)*1000).toLocaleString());
 setText('summary-reveal',new Date(Number(challenge.revealDeadline)*1000).toLocaleString());
 setText('summary-quorum',quorum+' of '+decodeNumber(reviewerCount));
 $('challenge-summary').hidden=false;
 $('inspector-footer').hidden=false;
 setText('inspector-addresses','Sponsor '+challenge.sponsor.slice(0,10)+'… · Verifier '+challenge.verifier.slice(0,10)+'…');
 const url=new URL(location.href);url.searchParams.set('id',id);history.replaceState(null,'',url.toString());
 await refreshCommitment();
 activity('Challenge #'+id+' loaded from Robinhood testnet.');
 return challenge;
}
$('load-form').addEventListener('submit',async e=>{
 e.preventDefault();
 try{await loadChallenge($('challenge-id').value.trim())}
 catch(err){state.challenge=null;state.id=null;$('challenge-summary').hidden=true;$('inspector-footer').hidden=true;activity(errorText(err))}
});
$('share-bounty').addEventListener('click',async()=>{
 if(!state.id)return;
 try{await navigator.clipboard.writeText(new URL(location.href).toString());activity('Bounty link copied to clipboard.')}
 catch{activity('Copy this address from your browser: '+location.href)}
});
$('wallet-connect').addEventListener('click',async()=>{
 try{await getWallet();activity('Wallet connected to Robinhood Chain Testnet.')}
 catch(e){activity(errorText(e))}
});

function matchVerifierRuntime(code,artifact){
 if(!/^0x[0-9a-fA-F]+$/.test(code)||code.length<400||!artifact?.runtimeCode)return false;
 const expected=artifact.runtimeCode.toLowerCase(),actual=code.toLowerCase();
 if(expected.length!==actual.length)return false;
 const original=expected.slice(2),deployed=actual.slice(2);
 const masks=artifact.immutableRefs||[];
 const immutables=new Set();
 for(const p of masks)for(let i=p.start*2;i<(p.start+p.length)*2;i++)immutables.add(i);
 for(let i=0;i<original.length;i++)if(!immutables.has(i)&&original[i]!==deployed[i])return false;
 return true;
}
async function verifyReviewerGate(address,reviewers,threshold){
 const code=await rpc('eth_getCode',[address,'latest']);
 if(!matchVerifierRuntime(code,state.verifierArtifact))throw Error('Reviewer contract does not match approved compiled code.');
 if(decodeNumber(await read(address,encodeCall('threshold()')))!==BigInt(threshold))throw Error('Reviewer threshold mismatch.');
 if(decodeNumber(await read(address,encodeCall('reviewerCount()')))!==BigInt(reviewers.length))throw Error('Reviewer count mismatch.');
 for(const reviewer of reviewers){
  const isReviewer=decodeNumber(await read(address,encodeAddress('isReviewer(address)',reviewer)));
  if(isReviewer!==1n)throw Error('Reviewer wallet is not authorized: '+reviewer);
 }
}
const reviewKey=wallet=>'before-btest-gate-'+CHAIN_ID+'-'+wallet.toLowerCase();
async function makeReviewGate(wallet,reviewers,threshold){
 let address=localStorage.getItem(reviewKey(wallet));
 if(address){
  try{await verifyReviewerGate(address,reviewers,threshold);return address}catch{localStorage.removeItem(reviewKey(wallet))}
 }
 if(!state.verifierArtifact?.creationCode)throw Error('Approved reviewer bytecode unavailable.');
 const data=encodeVerifierCreation(state.verifierArtifact.creationCode,reviewers,threshold);
 const tx=await sendTransaction({from:wallet,to:null,data,description:'Deploy reviewer gate'});
 address=tx.receipt.contractAddress;
 if(!isAddress(address))throw Error('No contract created by reviewer-gate deployment.');
 await verifyReviewerGate(address,reviewers,threshold);
 localStorage.setItem(reviewKey(wallet),address);
 return address;
}
async function ensureBTEST(wallet,required){
 const token=state.config.mockToken;
 const current=decodeNumber(await read(token,encodeAddress('balanceOf(address)',wallet)));
 if(current<required){
  await sendTransaction({from:wallet,to:token,data:encodeMint(wallet,required-current),description:'Mint valueless BTEST'});
  const after=decodeNumber(await read(token,encodeAddress('balanceOf(address)',wallet)));
  if(after<required)throw Error('BTEST mint did not produce the required balance.');
 }
 const escrow=state.config.challengeEscrow;
 const allowance=decodeNumber(await read(token,encodeAllowance(wallet,escrow)));
 if(allowance<required){
  await sendTransaction({from:wallet,to:token,data:encodeApprove(escrow,required),description:'Approve exact BTEST transfer'});
  const after=decodeNumber(await read(token,encodeAllowance(wallet,escrow)));
  if(after<required)throw Error('BTEST allowance remains insufficient.');
 }
}
$('create-form').addEventListener('submit',async event=>{
 event.preventDefault();
 await runAction('Publish bounty',async()=>{
  const wallet=await getWallet();
  const reviewers=$('reviewers').value.split(/[\s,]+/).map(x=>x.trim()).filter(Boolean);
  if(reviewers.length<1||reviewers.length>3||reviewers.some(x=>!isAddress(x))||new Set(reviewers.map(x=>x.toLowerCase())).size!==reviewers.length)throw Error('Enter 1–3 different valid reviewer wallet addresses.');
  if(reviewers.some(x=>same(x,wallet)))throw Error('Choose a reviewer wallet different from the sponsor wallet.');
  const threshold=Number($('threshold').value);
  if(threshold<1||threshold>reviewers.length)throw Error('Approval threshold exceeds the reviewer count.');
  const reward=amount($('reward-amount').value.trim()),bond=amount($('bond-amount').value.trim());
  const commitMinutes=Number($('commit-minutes').value),revealMinutes=Number($('reveal-minutes').value);
  if(!Number.isInteger(commitMinutes)||commitMinutes<2||commitMinutes>1440||!Number.isInteger(revealMinutes)||revealMinutes<=commitMinutes+1||revealMinutes>10080)throw Error('Choose a commit window of at least 2 minutes and a later reveal deadline within 7 days.');
  await checkChain();
  const verifier=await makeReviewGate(wallet,reviewers,threshold);
  await ensureBTEST(wallet,reward);
  const now=await blockTime();
  const commitDeadline=now+BigInt(commitMinutes*60);
  const revealDeadline=now+BigInt(revealMinutes*60);
  const data=encodeCreate({
   token:state.config.mockToken,reward,bond,verifier,target:state.config.practiceVault,
   scopeHash:reviewScopeHash,commitDeadline,revealDeadline
  });
  const receipt=await sendTransaction({from:wallet,to:state.config.challengeEscrow,data,description:'Publish BTEST challenge'});
  const id=eventChallengeId(receipt.receipt,state.config.challengeEscrow);
  await loadChallenge(id);
  showRole('solver');
  activity('BTEST bounty #'+id+' is live. Share its URL with a solver and your chosen reviewer.',receipt.hash);
 });
});
const saltKey=(id,wallet)=>'before-btest-salt-'+CHAIN_ID+'-'+id+'-'+wallet.toLowerCase();
async function refreshCommitment(){
 if(!state.id||!state.config||!state.wallet)return;
 try{
  const commitment=parseCommitment(await read(state.config.challengeEscrow,encodeCommitmentStatus(state.id,state.wallet)));
  setText('commitment-state',statuses[commitment.status]||'Unknown commitment status');
  const saved=localStorage.getItem(saltKey(state.id,state.wallet));
  if(saved&&/^0x[0-9a-f]{64}$/.test(saved))$('salt').value=saved;
  if(commitment.status===1)setText('commitment-state','Bond locked, commitment pending. Get reviewer approval, then reveal after the commit deadline.');
 }catch{setText('commitment-state','Could not read your onchain commitment.')}
}
$('generate-salt').addEventListener('click',async()=>{
 if(!state.id){activity('Load a challenge before generating a salt.');return}
 try{
  const wallet=await getWallet();
  const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);
  const value=hexFromBytes(bytes);$('salt').value=value;
  localStorage.setItem(saltKey(state.id,wallet),value);
  activity('Private salt created on this device. Copy it and keep it until reveal.');
 }catch(e){activity(errorText(e))}
});
$('copy-salt').addEventListener('click',async()=>{
 if(!/^0x[0-9a-fA-F]{64}$/.test($('salt').value))return activity('Generate a salt first.');
 try{await navigator.clipboard.writeText($('salt').value);activity('Salt copied. Keep it private until reveal.')}
 catch{activity('Select and copy your salt manually.')}
});
const requireChallenge=()=>{
 if(!state.challenge||!state.id)throw Error('Load a verified BTEST challenge first.');
 return state.challenge;
};
$('solve-form').addEventListener('submit',async e=>{
 e.preventDefault();
 await runAction('Commit finding',async()=>{
  const c=requireChallenge(),wallet=await getWallet();
  const evidence=$('evidence').value;
  if(!safeEvidence(evidence))throw Error('Enter a finding between 1 and 1,500 bytes.');
  const salt=$('salt').value;
  if(!/^0x[0-9a-fA-F]{64}$/.test(salt))throw Error('Generate a private salt and keep it safe.');
  const now=await blockTime();
  if(now>=c.commitDeadline||c.rewardReleased||c.canceled)throw Error('The commitment window has closed.');
  const commitment=parseCommitment(await read(state.config.challengeEscrow,encodeCommitmentStatus(state.id,wallet)));
  if(commitment.status!==0)throw Error('You already have a commitment for this bounty.');
  const digest=await read(state.config.challengeEscrow,encodeCommitmentFor(state.id,wallet,salt,evidence));
  if(!/^0x[0-9a-fA-F]{64}$/.test(digest))throw Error('Onchain commitment hash was invalid.');
  localStorage.setItem(saltKey(state.id,wallet),salt);
  await ensureBTEST(wallet,c.bond);
  const tx=await sendTransaction({from:wallet,to:state.config.challengeEscrow,data:encodeCommit(state.id,digest),description:'Commit finding & BTEST bond'});
  await refreshCommitment();
  activity('Finding committed. Share the exact evidence privately with a reviewer, then reveal after the commit window.',tx.hash);
 });
});
$('reveal-finding').addEventListener('click',()=>runAction('Reveal finding',async()=>{
 const c=requireChallenge(),wallet=await getWallet(),evidence=$('evidence').value,salt=$('salt').value;
 if(!safeEvidence(evidence)||!/^0x[0-9a-fA-F]{64}$/.test(salt))throw Error('Enter the original evidence and private salt for the commitment.');
 const now=await blockTime();
 if(now<=c.commitDeadline||now>c.revealDeadline||c.canceled||c.rewardReleased)throw Error('Reveal is allowed only within the active reveal window.');
 const commitment=parseCommitment(await read(state.config.challengeEscrow,encodeCommitmentStatus(state.id,wallet)));
 if(commitment.status!==1)throw Error('No pending commitment exists for this wallet.');
 const digest=await read(state.config.challengeEscrow,encodeCommitmentFor(state.id,wallet,salt,evidence));
 if(!same(digest,commitment.digest))throw Error('Evidence or salt does not match your original onchain commitment.');
 const key=await read(c.verifier,encodeReviewKey(state.config.challengeEscrow,state.id,wallet,c.target,state.scope,evidence));
 const approvals=decodeNumber(await read(c.verifier,encodeCall('approvalCount(bytes32)',[bytes32(key)])));
 const threshold=decodeNumber(await read(c.verifier,encodeCall('threshold()')));
 if(approvals<threshold)throw Error('Reviewer quorum has not approved this exact evidence. Revealing now would slash your bond.');
 const tx=await sendTransaction({from:wallet,to:state.config.challengeEscrow,data:encodeReveal(state.id,salt,evidence),description:'Reveal approved evidence & settle'});
 await loadChallenge(state.id);
 activity('Approved finding settled; reward and BTEST bond returned to solver.',tx.hash);
}));
$('review-form').addEventListener('submit',e=>{
 e.preventDefault();
 return runAction('Reviewer approval',async()=>{
  const c=requireChallenge(),wallet=await getWallet(),solver=$('solver-address').value.trim(),evidence=$('review-evidence').value;
  if(!isAddress(solver)||!safeEvidence(evidence))throw Error('Enter a valid solver wallet and exact nonempty finding evidence.');
  if(decodeNumber(await read(c.verifier,encodeAddress('isReviewer(address)',wallet)))!==1n)throw Error('This wallet is not an appointed reviewer for this challenge.');
  const commitment=parseCommitment(await read(state.config.challengeEscrow,encodeCommitmentStatus(state.id,solver)));
  if(commitment.status!==1)throw Error('The solver does not have a pending commitment.');
  const tx=await sendTransaction({from:wallet,to:c.verifier,data:encodeApproveFinding({
   escrow:state.config.challengeEscrow,id:state.id,solver,target:c.target,scopeHash:state.scope,evidenceText:evidence
  }),description:'Record binding reviewer approval'});
  const key=await read(c.verifier,encodeReviewKey(state.config.challengeEscrow,state.id,solver,c.target,state.scope,evidence));
  const count=decodeNumber(await read(c.verifier,encodeCall('approvalCount(bytes32)',[bytes32(key)])));
  const quorum=decodeNumber(await read(c.verifier,encodeCall('threshold()')));
  setText('review-status',count+' of '+quorum+' approvals recorded for the exact evidence hash.');
  activity('Reviewer approval recorded for bounty #'+state.id+'.',tx.hash);
 });
});
for(const [id,method,description,guard] of [
 ['cancel-bounty','cancel(uint256)','Cancel unused bounty',async(c,w,now)=>{
   if(!same(c.sponsor,w)||now>=c.commitDeadline||c.commitmentCount!==0n||c.rewardReleased||c.canceled)throw Error('Only the sponsor may cancel a still-open bounty with no commitments.');
 }],
 ['refund-reward','refundExpiredReward(uint256)','Refund expired reward',async(c,w,now)=>{
   if(!same(c.sponsor,w)||now<=c.revealDeadline||c.rewardReleased||c.canceled)throw Error('Only the sponsor can refund an unclaimed reward after reveal expiry.');
 }],
 ['refund-bond','refundExpiredBond(uint256)','Refund unanswered bond',async(c,w,now)=>{
   const commitment=parseCommitment(await read(state.config.challengeEscrow,encodeCommitmentStatus(state.id,w)));
   if(commitment.status!==1||(!c.rewardReleased&&now<=c.revealDeadline))throw Error('No refundable pending bond exists for this wallet yet.');
 }]
]){
 $(id).addEventListener('click',()=>runAction(description,async()=>{
  const c=requireChallenge(),wallet=await getWallet(),now=await blockTime();
  await guard(c,wallet,now);
  const tx=await sendTransaction({from:wallet,to:state.config.challengeEscrow,data:encodeId(method,state.id),description});
  await loadChallenge(state.id);
  activity(description+' confirmed onchain.',tx.hash);
 }));
}
async function initialize(){
 try{
  await checkChain();
  setText('chain-status','ROBINHOOD TESTNET · CONNECTED');
  const [res,artifactRes]=await Promise.all([
   fetch('/deployment.json',{cache:'no-store'}),
   fetch('/bounty-verifier.json',{cache:'no-store'})
  ]);
  if(!res.ok||!artifactRes.ok)throw Error('Verified contracts or reviewer bytecode are unavailable.');
  const config=await res.json(),artifact=await artifactRes.json();
  if(!deploymentReady(config)||config.chainId!==CHAIN_ID||!isAddress(config.practiceVault))throw Error('No verified BTEST deployment is configured.');
  const [escrowCode,tokenCode,targetCode]=await Promise.all([
   rpc('eth_getCode',[config.challengeEscrow,'latest']),
   rpc('eth_getCode',[config.mockToken,'latest']),
   rpc('eth_getCode',[config.practiceVault,'latest'])
  ]);
  if([escrowCode,tokenCode,targetCode].some(c=>!c||c==='0x'))throw Error('One or more verified testnet contracts are unavailable.');
  if(typeof artifact.creationCode!=='string'||typeof artifact.runtimeCode!=='string'||!Array.isArray(artifact.immutableRefs))throw Error('Reviewer bytecode manifest is incomplete.');
  state.config=config;state.verifierArtifact=artifact;
  activity('Ready. Connect your wallet to create a valueless BTEST bounty, or load an existing challenge without a wallet.');
  if(window.ethereum?.request){
   try{
    const a=await window.ethereum.request({method:'eth_accounts'});
    if(a?.[0]&&isAddress(a[0])&&BigInt(await window.ethereum.request({method:'eth_chainId'}))===BigInt(CHAIN_ID)){
     state.wallet=a[0];setText('wallet-label',a[0].slice(0,6)+'…'+a[0].slice(-4));
    }
   }catch{}
   if(window.ethereum.on){
    window.ethereum.on('accountsChanged',accounts=>{
     state.wallet=accounts?.[0]||null;
     setText('wallet-label',state.wallet?state.wallet.slice(0,6)+'…'+state.wallet.slice(-4):'Connect wallet');
     setText('commitment-state','Wallet changed. Load your active commitment again.');
    });
    window.ethereum.on('chainChanged',()=>{state.wallet=null;setText('wallet-label','Connect wallet');activity('Wallet network changed. Reconnect to Robinhood testnet before signing.');});
   }
  }
  const id=new URLSearchParams(location.search).get('id');
  if(id&&isValidChallengeId(id))await loadChallenge(id);
 }catch(err){
  setText('chain-status','TESTNET · UNAVAILABLE');
  activity(errorText(err));
 }
}
initialize();
