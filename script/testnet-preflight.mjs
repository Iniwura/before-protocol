// Read-only Robinhood Chain testnet readiness check. Never reads a private key.
import {CHAIN_ID,RPC_URL,isAddress,parseHexUint} from '../web/core.mjs';
const rpcURL=process.env.RH_TESTNET_RPC || RPC_URL;
const address=process.argv[2] || process.env.BEFORE_TEST_DEPLOYER_ADDRESS || '';
if(address && !isAddress(address)){
  console.error('Expected a public, 0x-prefixed 20-byte deployer address. Never pass private keys.');
  process.exit(2);
}
async function rpc(method,params=[]){
  const response=await fetch(rpcURL,{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),
    signal:AbortSignal.timeout(12_000)
  });
  if(!response.ok)throw new Error('RPC HTTP '+response.status);
  const json=await response.json();
  if(json.error || json.result===undefined)throw new Error(json.error?.message || 'Malformed RPC response');
  return json.result;
}
try{
  const id=Number(parseHexUint(await rpc('eth_chainId')));
  if(id!==CHAIN_ID)throw new Error('Wrong chain '+id+' (expected '+CHAIN_ID+').');
  const height=parseHexUint(await rpc('eth_blockNumber'));
  console.log('Robinhood Chain testnet',id,'at block',height.toString());
  if(!address){
    console.log('Read-only network check passed. Pass a PUBLIC deployer address to inspect gas balance.');
  }else{
    const balance=parseHexUint(await rpc('eth_getBalance',[address,'latest']));
    const pending=parseHexUint(await rpc('eth_getTransactionCount',[address,'pending']));
    console.log('Deployer',address);
    console.log('Gas ETH balance (wei)',balance.toString());
    console.log('Pending nonce',pending.toString());
    if(balance===0n){
      console.log('BLOCKED: testnet ETH balance is zero. Fund via the official faucet before deployment.');
      process.exitCode=2;
    }else{
      console.log('Non-zero test ETH found. This does not establish gas sufficiency; run a Foundry simulation before broadcast.');
    }
  }
}catch(error){console.error('Read-only preflight failed:',error.message);process.exitCode=1;}
