#!/usr/bin/env node
const url = process.env.RH_TESTNET_RPC || 'https://rpc.testnet.chain.robinhood.com';
const r = await fetch(url, {
  method: 'POST',
  headers: {'content-type': 'application/json'},
  body: JSON.stringify({jsonrpc:'2.0', id:1, method:'eth_chainId', params:[]}),
  signal: AbortSignal.timeout(12000),
});
if (!r.ok) throw Error('RPC HTTP ' + r.status);
const body = await r.json();
if (body.error || typeof body.result !== 'string') throw Error('RPC failed: ' + JSON.stringify(body));
const chainId = Number.parseInt(body.result, 16);
console.log('Connected to chain ' + chainId);
if (chainId !== 46630) throw Error('Wrong chain: expected Robinhood Chain testnet (46630)');
console.log('Read-only testnet connection verified. No funds moved.');
