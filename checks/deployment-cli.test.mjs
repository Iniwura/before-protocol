import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const factory='0x'+'1'.repeat(40), token='0x'+'2'.repeat(40), escrow='0x'+'3'.repeat(40);
const txA='0x'+'a'.repeat(64), txB='0x'+'b'.repeat(64), txC='0x'+'c'.repeat(64);
const deployer='0x'+'4'.repeat(40), demoVault='0x'+'5'.repeat(40), practiceArena='0x'+'6'.repeat(40), practiceVault='0x'+'7'.repeat(40);
const txD='0x'+'d'.repeat(64), txE='0x'+'e'.repeat(64);
const allowedTx='0x'+'8'.repeat(64), deniedTx='0x'+'9'.repeat(64), proofTx='0x'+'f'.repeat(64);
const params=['script/verify-testnet.mjs',factory,txA,token,txB];
const word=address=>'0x'+'0'.repeat(24)+address.slice(2);
const words=(...values)=>'0x'+values.map(value=>typeof value==='string'?value.replace(/^0x/,'').padStart(64,'0'):BigInt(value).toString(16).padStart(64,'0')).join('');
const amount150='0x'+(150n*10n**18n).toString(16).padStart(64,'0');
const vaultEvent='0x12cd41479914d3ffb29c1abbe7cef9f1c4d3a03603eafa901c21e4b0c826955a';
const practiceEvent='0x8a0923f7b9bc4930ee8c8e7773325c8ecead718d54032c702b2690438c0b3a1e';
const withdrawalEvent='0x75e161b3e824b114fc1a33274bd7091918dd4e639cede50b78b15a4eea956a21';
const proofEvent='0x9f9d7c25919433aa3abd6a8bd1e610f30294b74f06edd9d104809ac2d72c9db9';
const proofInput='0x3b1bf525'+words(32n,2n,60n*10n**18n,50n*10n**18n).slice(2);
function launchCLI(url,cliParams=params) {
  return new Promise((resolve,reject)=>{
    let stdout='',stderr='';
    const child=spawn(process.execPath,cliParams,{cwd:root,env:{...process.env,RH_TESTNET_RPC:url}});
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

test('three-contract proof includes the empty challenge escrow',async()=>{
  const artifact=async(name)=>JSON.parse(await readFile(path.join(root,'out',name+'.sol',name+'.json'),'utf8'));
  const [f,t,e]=await Promise.all([artifact('BeforeFactory'),artifact('MockERC20'),artifact('WifSecurityChallenge')]);
  const server=createServer(async(req,res)=>{
    const chunks=[];
    for await(const data of req)chunks.push(data);
    const q=JSON.parse(Buffer.concat(chunks).toString());
    let result=null;
    if(q.method==='eth_chainId')result='0xb626';
    if(q.method==='eth_blockNumber')result='0x200';
    if(q.method==='eth_getTransactionReceipt'){
      const entries=[[txA,factory],[txB,token],[txC,escrow]];
      const match=entries.find(([hash])=>q.params[0]===hash);
      result=match?{status:'0x1',contractAddress:match[1],transactionHash:match[0],blockNumber:'0x1f0'}:null;
    }
    if(q.method==='eth_getCode'){
      const entries=[[factory,f.deployedBytecode.object],[token,t.deployedBytecode.object],[escrow,e.deployedBytecode.object]];
      result=entries.find(([address])=>q.params[0]===address)?.[1]||'0x';
    }
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(JSON.stringify({jsonrpc:'2.0',id:1,result}));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url='http://127.0.0.1:'+server.address().port;
  try {
    const valid=await launchCLI(url,['script/verify-testnet.mjs',factory,txA,token,txB,escrow,txC]);
    assert.equal(valid.code,0,valid.stderr);
    assert.match(valid.stdout,/PASS: three deployment receipts/);
  } finally {
    await new Promise(resolve=>server.close(resolve));
  }
});

test('abbreviated proof can never write an enabled browser manifest',async()=>{
  const result=await launchCLI('http://127.0.0.1:1',['script/verify-testnet.mjs',factory,txA,token,txB,escrow,txC,'--write']);
  assert.equal(result.code,2);
  assert.match(result.stderr,/complete deployment and public Protect\/Challenge evidence/);
});

test('eight-argument proof verifies factory interactions and created demo outputs',async()=>{
  const artifact=async(name)=>JSON.parse(await readFile(path.join(root,'out',name+'.sol',name+'.json'),'utf8'));
  const [f,t,e,v,a,p]=await Promise.all([
    artifact('BeforeFactory'),artifact('MockERC20'),artifact('WifSecurityChallenge'),
    artifact('BeforeVault'),artifact('TrainingArena'),artifact('TrainingVault'),
  ]);
  let tamper=false;
  const server=createServer(async(req,res)=>{
    const chunks=[];
    for await(const data of req)chunks.push(data);
    const q=JSON.parse(Buffer.concat(chunks).toString());
    let result=null;
    if(q.method==='eth_chainId')result='0xb626';
    if(q.method==='eth_blockNumber')result='0x200';
    if(q.method==='eth_getTransactionReceipt'){
      const entries={
        [txA]:{status:'0x1',contractAddress:factory,transactionHash:txA,to:null},
        [txB]:{status:'0x1',contractAddress:token,transactionHash:txB,to:null},
        [txC]:{status:'0x1',contractAddress:escrow,transactionHash:txC,to:null},
        [txD]:{status:'0x1',transactionHash:txD,to:factory,logs:[{address:factory,topics:[vaultEvent,word(deployer),word(demoVault),word(token)],data:words(deployer,60n*10n**18n,100n*10n**18n,1n)}]},
        [txE]:{status:'0x1',transactionHash:txE,to:factory,logs:[{address:factory,topics:[practiceEvent,word(deployer),word(practiceArena),word(token)],data:'0x'}]},
      };
      result=entries[q.params[0]]?{...entries[q.params[0]],blockNumber:'0x1f0'}:null;
    }
    if(q.method==='eth_getTransactionByHash'){
      const entries={
        [txD]:{hash:txD,from:deployer,to:factory,input:(tamper?'0x1ce59d6c':'0x4e6a5acd')+token.slice(2).padStart(64,'0')},
        [txE]:{hash:txE,from:deployer,to:factory,input:'0x1ce59d6c'+token.slice(2).padStart(64,'0')},
      };
      result=entries[q.params[0]]||null;
    }
    if(q.method==='eth_getCode'){
      const entries=[[factory,f.deployedBytecode.object],[token,t.deployedBytecode.object],[escrow,e.deployedBytecode.object],[demoVault,v.deployedBytecode.object],[practiceArena,a.deployedBytecode.object],[practiceVault,p.deployedBytecode.object]];
      result=entries.find(([address])=>q.params[0]===address)?.[1]||'0x';
    }
    if(q.method==='eth_call'){
      const call=q.params[0], selector=call.data.slice(0,10), address=call.to;
      if(selector==='0xee643f9e')result=word(demoVault);
      if(selector==='0x7f81587e')result=word(practiceArena);
      if(selector==='0xfbfa77cf')result=word(practiceVault);
      if(selector==='0x8da5cb5b'&&address===demoVault)result=word(deployer);
      if(selector==='0xcb943a37'&&address===demoVault)result=word(deployer);
      if(selector==='0xfc0c546a'&&(address===demoVault||address===practiceArena))result=word(token);
      if(selector==='0x70a08231')result=amount150;
    }
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(JSON.stringify({jsonrpc:'2.0',id:1,result}));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url='http://127.0.0.1:'+server.address().port;
  const args=['script/verify-testnet.mjs',factory,txA,token,txB,escrow,txC,txD,txE];
  try {
    const valid=await launchCLI(url,args);
    assert.equal(valid.code,0,valid.stderr);
    assert.match(valid.stdout,/PASS: factory interaction receipts/);
    assert.match(valid.stdout,/demoVault/);
    tamper=true;
    const bad=await launchCLI(url,args);
    assert.equal(bad.code,1,bad.stdout+bad.stderr);
    assert.match(bad.stderr,/calldata does not match/);
  } finally {
    await new Promise(resolve=>server.close(resolve));
  }
});

test('eleven-argument proof verifies the public Protect and Challenge flow',async()=>{
  const artifact=async(name)=>JSON.parse(await readFile(path.join(root,'out',name+'.sol',name+'.json'),'utf8'));
  const [f,t,e,v,a,p]=await Promise.all([
    artifact('BeforeFactory'),artifact('MockERC20'),artifact('WifSecurityChallenge'),
    artifact('BeforeVault'),artifact('TrainingArena'),artifact('TrainingVault'),
  ]);
  const server=createServer(async(req,res)=>{
    const chunks=[];
    for await(const data of req)chunks.push(data);
    const q=JSON.parse(Buffer.concat(chunks).toString());
    let result=null;
    if(q.method==='eth_chainId')result='0xb626';
    if(q.method==='eth_blockNumber')result='0x200';
    if(q.method==='eth_getTransactionReceipt'){
      const entries={
        [txA]:{status:'0x1',contractAddress:factory,transactionHash:txA,to:null},
        [txB]:{status:'0x1',contractAddress:token,transactionHash:txB,to:null},
        [txC]:{status:'0x1',contractAddress:escrow,transactionHash:txC,to:null},
        [txD]:{status:'0x1',transactionHash:txD,to:factory,logs:[{address:factory,topics:[vaultEvent,word(deployer),word(demoVault),word(token)],data:words(deployer,60n*10n**18n,100n*10n**18n,1n)}]},
        [txE]:{status:'0x1',transactionHash:txE,to:factory,logs:[{address:factory,topics:[practiceEvent,word(deployer),word(practiceArena),word(token)],data:'0x'}]},
        [allowedTx]:{status:'0x1',transactionHash:allowedTx,to:demoVault,logs:[{address:demoVault,topics:[withdrawalEvent,word(deployer),words(1n)],data:words(20n*10n**18n,20n*10n**18n)}]},
        [deniedTx]:{status:'0x0',transactionHash:deniedTx,to:demoVault,logs:[]},
        [proofTx]:{status:'0x1',transactionHash:proofTx,to:practiceArena,logs:[{address:practiceArena,topics:[proofEvent,word(deployer)],data:words(110n*10n**18n,100n*10n**18n)}]},
      };
      result=entries[q.params[0]]?{...entries[q.params[0]],blockNumber:'0x1f0'}:null;
    }
    if(q.method==='eth_getTransactionByHash'){
      const entries={
        [txD]:{hash:txD,from:deployer,to:factory,input:'0x4e6a5acd'+token.slice(2).padStart(64,'0')},
        [txE]:{hash:txE,from:deployer,to:factory,input:'0x1ce59d6c'+token.slice(2).padStart(64,'0')},
        [allowedTx]:{hash:allowedTx,from:deployer,to:demoVault,input:'0xf3fef3a3'+word(deployer).slice(2)+words(20n*10n**18n).slice(2)},
        [deniedTx]:{hash:deniedTx,from:deployer,to:demoVault,input:'0xf3fef3a3'+word(deployer).slice(2)+words(75n*10n**18n).slice(2)},
        [proofTx]:{hash:proofTx,from:deployer,to:practiceArena,input:proofInput},
      };
      result=entries[q.params[0]]||null;
    }
    if(q.method==='eth_getCode'){
      const entries=[[factory,f.deployedBytecode.object],[token,t.deployedBytecode.object],[escrow,e.deployedBytecode.object],[demoVault,v.deployedBytecode.object],[practiceArena,a.deployedBytecode.object],[practiceVault,p.deployedBytecode.object]];
      result=entries.find(([address])=>q.params[0]===address)?.[1]||'0x';
    }
    if(q.method==='eth_call'){
      const call=q.params[0], selector=call.data.slice(0,10), address=call.to;
      if(selector==='0xee643f9e')result=word(demoVault);
      if(selector==='0x7f81587e')result=word(practiceArena);
      if(selector==='0xfbfa77cf')result=word(practiceVault);
      if(selector==='0x8da5cb5b'&&address===demoVault)result=word(deployer);
      if(selector==='0xcb943a37'&&address===demoVault)result=word(deployer);
      if(selector==='0xfc0c546a'&&(address===demoVault||address===practiceArena))result=word(token);
      if(selector==='0x70a08231')result=amount150;
      if(selector==='0x799320bb'&&address===practiceArena)result=words(1n);
    }
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(JSON.stringify({jsonrpc:'2.0',id:1,result}));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url='http://127.0.0.1:'+server.address().port;
  try {
    const valid=await launchCLI(url,['script/verify-testnet.mjs',factory,txA,token,txB,escrow,txC,txD,txE,allowedTx,deniedTx,proofTx]);
    assert.equal(valid.code,0,valid.stderr);
    assert.match(valid.stdout,/public Protect and Challenge receipts/);
    assert.match(valid.stdout,/practiceProofTx/);
  } finally {
    await new Promise(resolve=>server.close(resolve));
  }
});
