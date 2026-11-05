import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalizedBytecode,attestCall,attestContract,attestFactoryEvent,attestImmutableRuntime} from './deployment-proof.mjs';

const contract='0x'+'1'.repeat(40);
const tx='0x'+'a'.repeat(64);
const receipt={status:'0x1',transactionHash:tx,contractAddress:contract,blockNumber:'0x64'};
const valid={label:'Factory',address:contract,txHash:tx,receipt,actualCode:'0x60016002',artifactCode:'0x60016002',headBlock:'0x6f',minConfirmations:12};
test('exact bytecode match and 12 confirmations',()=>assert.equal(attestContract(valid).confirmations,12));
test('bytecode is compared case-insensitively',()=>assert.equal(normalizedBytecode('0xABcd'),'0xabcd'));
test('wrong deployed runtime code fails',()=>assert.throws(()=>attestContract({...valid,actualCode:'0x60016003'}),/bytecode does not match/));
test('reverted deployment fails',()=>assert.throws(()=>attestContract({...valid,receipt:{...receipt,status:'0x0'}}),/unsuccessful/));
test('no mined receipt fails',()=>assert.throws(()=>attestContract({...valid,receipt:null}),/missing/));
test('malformed or unrelated transaction fails',()=>assert.throws(()=>attestContract({...valid,txHash:'0x1234'}),/transaction hash/));
test('mismatched receipt transaction fails',()=>assert.throws(()=>attestContract({...valid,receipt:{...receipt,transactionHash:'0x'+'b'.repeat(64)}}),/hash does not match/));
test('mismatched contract creation address fails',()=>assert.throws(()=>attestContract({...valid,receipt:{...receipt,contractAddress:'0x'+'2'.repeat(40)}}),/did not deploy/));
test('a transaction to an existing contract is not a deployment',()=>assert.throws(()=>attestContract({...valid,receipt:{...receipt,contractAddress:null}}),/did not deploy/));
test('insufficient confirmation depth fails',()=>assert.throws(()=>attestContract({...valid,headBlock:'0x6e'}),/more confirmations/));
test('future receipt block fails',()=>assert.throws(()=>attestContract({...valid,headBlock:'0x01'}),/exceeds chain head/));
test('invalid bytecode representations fail',()=>{for(const code of ['0x','0x1','0xnothex',null,''])assert.throws(()=>normalizedBytecode(code));});
test('zero contract address rejected',()=>assert.throws(()=>attestContract({...valid,address:'0x'+'0'.repeat(40)}),/invalid contract address/));

const abiWord=value=>typeof value==='string'?'0x'+'0'.repeat(24)+value.slice(2).toLowerCase():'0x'+BigInt(value).toString(16).padStart(64,'0');
function materialize(artifact,values){
  let code=artifact.deployedBytecode.object.toLowerCase();
  const groups=Object.entries(artifact.deployedBytecode.immutableReferences).sort(([left],[right])=>Number(left)-Number(right));
  for(const [index,[,locations]] of groups.entries())for(const location of locations){
    const start=2+location.start*2, end=start+location.length*2;
    code=code.slice(0,start)+values[index].slice(2,2+location.length*2)+code.slice(end);
  }
  return code;
}
async function artifact(name){
  return JSON.parse(await readFile(new URL('../out/'+name+'.sol/'+name+'.json',import.meta.url),'utf8'));
}

test('immutable runtime proof accepts all created contract types',async()=>{
  const owner='0x'+'1'.repeat(40), token='0x'+'2'.repeat(40), arena='0x'+'3'.repeat(40), vault='0x'+'4'.repeat(40);
  const cases=[
    ['BeforeVault',[abiWord(owner),abiWord(token),abiWord(owner),abiWord(60n*10n**18n),abiWord(100n*10n**18n)]],
    ['TrainingArena',[abiWord(vault),abiWord(token),abiWord(100n*10n**18n)]],
    ['TrainingVault',[abiWord(arena),abiWord(token),abiWord(60n*10n**18n)]],
  ];
  for(const [name,values] of cases){
    const a=await artifact(name);
    assert.equal(attestImmutableRuntime({label:name,address:contract,actualCode:materialize(a,values),artifactCode:a.deployedBytecode.object,immutableReferences:a.deployedBytecode.immutableReferences,immutableValues:values}).immutableGroups,values.length);
  }
});

test('immutable runtime proof rejects wrong constructor state and modified code',async()=>{
  const a=await artifact('BeforeVault');
  const values=[abiWord('0x'+'1'.repeat(40)),abiWord('0x'+'2'.repeat(40)),abiWord('0x'+'1'.repeat(40)),abiWord(60n*10n**18n),abiWord(100n*10n**18n)];
  const actual=materialize(a,values);
  assert.throws(()=>attestImmutableRuntime({label:'BeforeVault',address:contract,actualCode:actual,artifactCode:a.deployedBytecode.object,immutableReferences:a.deployedBytecode.immutableReferences,immutableValues:[...values.slice(0,2),abiWord('0x'+'3'.repeat(40)),...values.slice(3)]}),/immutable value/);
  const immutableBytes=new Set(Object.values(a.deployedBytecode.immutableReferences).flat().flatMap(location=>Array.from({length:location.length},(_,index)=>location.start+index)));
  const outside=Array.from({length:(actual.length-2)/2},(_,index)=>index).find(index=>!immutableBytes.has(index));
  const tampered=actual.slice(0,2+outside*2)+(actual.slice(2+outside*2,4+outside*2)==='00'?'ff':'00')+actual.slice(4+outside*2);
  assert.throws(()=>attestImmutableRuntime({label:'BeforeVault',address:contract,actualCode:tampered,artifactCode:a.deployedBytecode.object,immutableReferences:a.deployedBytecode.immutableReferences,immutableValues:values}),/outside immutable slots/);
});

test('factory event is bound to the factory and indexed context',()=>{
  const event='0x'+'e'.repeat(64), owner='0x'+'2'.repeat(40), token='0x'+'3'.repeat(40);
  const padded=value=>'0x'+'0'.repeat(24)+value.slice(2);
  const receipt={logs:[{address:contract,topics:[event,padded(owner),'0x'+'0'.repeat(24)+'4'.repeat(40),padded(token)],data:'0x'}]};
  assert.equal(attestFactoryEvent({label:'FactoryEvent',receipt,factory:contract,eventTopic:event,indexedAddresses:{1:owner,3:token}}).topics[2].slice(-40),'4'.repeat(40));
  assert.throws(()=>attestFactoryEvent({label:'FactoryEvent',receipt,factory:'0x'+'9'.repeat(40),eventTopic:event}),/exactly one/);
});
test('call proof binds sender, calldata, status and confirmations',()=>{
  const from='0x'+'2'.repeat(40), to='0x'+'3'.repeat(40), call='0x12345678'+'0'.repeat(64), flowTx='0x'+'c'.repeat(64);
  const transaction={hash:flowTx,from,to,input:call};
  const receipt={status:'0x1',transactionHash:flowTx,to,blockNumber:'0x64'};
  assert.equal(attestCall({label:'Flow',txHash:flowTx,transaction,receipt,to,from,input:call,headBlock:'0x6f'}).confirmations,12);
  assert.throws(()=>attestCall({label:'Flow',txHash:flowTx,transaction,receipt:{...receipt,status:'0x0'},to,from,input:call,headBlock:'0x6f'}),/unexpected interaction receipt status/);
});
