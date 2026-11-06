#!/usr/bin/env node
// Extract public deployment evidence from a Foundry broadcast file. Never reads keys or broadcasts.
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {isAddress,isTxHash} from '../web/core.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

function hashOf(tx,label){
  const hash=tx?.hash??tx?.transactionHash;
  if(!isTxHash(hash))throw new Error(label+': missing public transaction hash.');
  return hash;
}

function addressOf(tx,label){
  const address=tx?.contractAddress??tx?.address;
  if(!isAddress(address)||/^0x0{40}$/i.test(address))throw new Error(label+': missing public contract address.');
  return address;
}

function transactionsOf(payload){
  if(!payload||!Array.isArray(payload.transactions))throw new Error('Broadcast file has no transactions array.');
  return payload.transactions;
}

function findCreate(transactions,contractName){
  const matches=transactions.filter(tx=>tx?.transactionType==='CREATE'&&tx?.contractName===contractName);
  if(matches.length!==1)throw new Error(contractName+': expected exactly one CREATE transaction.');
  return matches[0];
}

function findCall(transactions,functionName){
  const matches=transactions.filter(tx=>{
    if(tx?.transactionType!=='CALL'||tx?.contractName!=='BeforeFactory')return false;
    const method=String(tx.function??tx.method??'');
    return method===functionName||method.startsWith(functionName+'(');
  });
  if(matches.length!==1)throw new Error(functionName+': expected exactly one BeforeFactory CALL transaction.');
  return matches[0];
}

export function extractBroadcastEvidence(payload){
  const chainId=Number(payload?.chainId??payload?.chain??0);
  if(chainId!==31337&&chainId!==46630)throw new Error('Broadcast must target chain 31337 or Robinhood testnet 46630.');
  const transactions=transactionsOf(payload);
  const factory=findCreate(transactions,'BeforeFactory');
  const mockToken=findCreate(transactions,'MockERC20');
  const challengeEscrow=findCreate(transactions,'WifSecurityChallenge');
  const demo=findCall(transactions,'createDemoVault');
  const practice=findCall(transactions,'createPractice');
  return {
    chainId,
    factory:addressOf(factory,'BeforeFactory'),
    factoryTx:hashOf(factory,'BeforeFactory'),
    mockToken:addressOf(mockToken,'MockERC20'),
    mockTokenTx:hashOf(mockToken,'MockERC20'),
    challengeEscrow:addressOf(challengeEscrow,'WifSecurityChallenge'),
    challengeEscrowTx:hashOf(challengeEscrow,'WifSecurityChallenge'),
    demoTx:hashOf(demo,'createDemoVault'),
    practiceTx:hashOf(practice,'createPractice'),
  };
}

export function verifierCommand(evidence){
  const values=[evidence.factory,evidence.factoryTx,evidence.mockToken,evidence.mockTokenTx,evidence.challengeEscrow,evidence.challengeEscrowTx,evidence.demoTx,evidence.practiceTx];
  if(values.some(value=>typeof value!=='string'))throw new Error('Incomplete public deployment evidence.');
  return [
    'node script/verify-testnet.mjs \\',
    '  '+values.slice(0,2).join(' ')+' \\',
    '  '+values.slice(2,4).join(' ')+' \\',
    '  '+values.slice(4,6).join(' ')+' \\',
    '  '+values.slice(6,8).join(' '),
  ].join('\n');
}

async function main(file){
  const source=file?path.resolve(file):path.join(root,'broadcast','DeployBefore.s.sol','46630','run-latest.json');
  const payload=JSON.parse(await readFile(source,'utf8'));
  const evidence=extractBroadcastEvidence(payload);
  console.log(JSON.stringify(evidence,null,2));
  console.log('\nDry-run verifier command (append the three public flow hashes before --write):\n');
  console.log(verifierCommand(evidence));
}

if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
  main(process.argv[2]).catch(error=>{console.error('NOT VERIFIED: '+error.message);process.exitCode=1;});
}
