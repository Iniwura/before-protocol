import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const factory='0x'+'1'.repeat(40), token='0x'+'2'.repeat(40);
const txA='0x'+'a'.repeat(64), txB='0x'+'b'.repeat(64);
const params=['script/verify-testnet.mjs',factory,txA,token,txB];
function launchCLI(url) {
  return new Promise((resolve,reject)=>{
    let stdout='',stderr='';
    const child=spawn(process.execPath,params,{cwd:root,env:{...process.env,RH_TESTNET_RPC:url}});
    child.stdout.on('data',chunk=>stdout+=chunk);
    child.stderr.on('data',chunk=>stderr+=chunk);
    child.once('error',reject);
    child.once('close',code=>resolve({code,stdout,stderr}));
  });
}
test('read-only deployment CLI accepts exact evidence but rejects tampered bytecode',async()=>{
  const artifact=async(name)=>JSON.parse(await readFile(path.join(root,'out',name+'.sol',name+'.json'),'utf8'));
  const [f,t]=await Promise.all([artifact('BeforeFactory'),artifact('MockERC20')]);
  let tamper=false;
  const server=createServer(async(req,res)=>{
    const chunks=[];
    for await(const data of req)chunks.push(data);
    const q=JSON.parse(Buffer.concat(chunks).toString());
    let result=null;
    if(q.method==='eth_chainId')result='0xb626';
    if(q.method==='eth_blockNumber')result='0x200';
    if(q.method==='eth_getTransactionReceipt'){
      const isFactory=q.params[0]===txA;
      result={status:'0x1',contractAddress:isFactory?factory:token,transactionHash:isFactory?txA:txB,blockNumber:'0x1f0'};
    }
    if(q.method==='eth_getCode')
      result=q.params[0]===factory?(tamper?'0x6001':f.deployedBytecode.object):t.deployedBytecode.object;
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(JSON.stringify({jsonrpc:'2.0',id:1,result}));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url='http://127.0.0.1:'+server.address().port;
  try {
    const valid=await launchCLI(url);
    assert.equal(valid.code,0,valid.stderr);
    assert.match(valid.stdout,/PASS: two deployment receipts/);
    assert.match(valid.stdout,/Dry-run only/);
    tamper=true;
    const bad=await launchCLI(url);
    assert.equal(bad.code,1,bad.stdout+bad.stderr);
    assert.match(bad.stderr,/runtime bytecode does not match/);
    const manifest=JSON.parse(await readFile(path.join(root,'web/deployment.json'),'utf8'));
    assert.equal(manifest.verified,false);
  } finally {
    await new Promise(resolve=>server.close(resolve));
  }
});
