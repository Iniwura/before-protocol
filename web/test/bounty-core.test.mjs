import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {
 keccak256,textHash,selector,utf8Hex,word,addr,amount,displayAmount,
 encodeCall,encodeCreate,encodeCommitmentFor,encodeCommit,encodeReveal,
 encodeApproveFinding,encodeId,encodeAddress,encodeMint,encodeApprove,
 encodeVerifierCreation,parseChallenge,parseCommitment,challengeAllowed,
 reviewScopeHash,BOUNTY_SCOPE,safeEvidence,isValidChallengeId,
 eventChallengeId,encodeReviewKey
} from '../bounty-core.mjs';

const wallet='0x'+'1'.repeat(40);
const escrow='0x'+'2'.repeat(40);
const token='0x'+'3'.repeat(40);
const target='0x'+'4'.repeat(40);
const reviewer='0x'+'5'.repeat(40);
const digest='0x'+'f'.repeat(64);
const code=JSON.parse(readFileSync(new URL('../bounty-verifier.json',import.meta.url),'utf8'));
test('Keccak-256 matches Ethereum standard known vectors',()=>{
 assert.equal(textHash(''),'0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470');
 assert.equal(textHash('hello'),'0x1c8aff950685c2ed4bc3174f3472287b56d9517b9c948127319a09a7a36deac8');
 assert.equal(selector('transfer(address,uint256)'),'0xa9059cbb');
 assert.equal(selector('mint(address,uint256)'),'0x40c10f19');
 assert.equal(selector('createChallenge((address,uint256,uint256,address,address,bytes32,uint64,uint64))'),'0xa9a61964');
 assert.equal(selector('approveFinding(address,uint256,address,address,bytes32,bytes32)'),'0x3d44475d');
 assert.equal(keccak256(new Uint8Array([])),textHash(''));
});
test('Static ABI and ERC-20 actions encode exact bytes',()=>{
 assert.equal(encodeAddress('balanceOf(address)',wallet),'0x70a08231'+addr(wallet));
 assert.equal(encodeApprove(escrow,100n),'0x095ea7b3'+addr(escrow)+word(100));
 assert.equal(encodeMint(wallet,10n),'0x40c10f19'+addr(wallet)+word(10));
 assert.equal(encodeCommit(1,digest),selector('commit(uint256,bytes32)')+word(1)+digest.slice(2));
 assert.equal(encodeId('cancel(uint256)','2'),selector('cancel(uint256)')+word(2));
 assert.equal(encodeCall('threshold()'),selector('threshold()'));
});
test('Dynamic evidence is correctly padded and offset for commitments and reveal',()=>{
 const salt='0x'+'a'.repeat(64),evidence='A real test';
 const a=encodeCommitmentFor(7,wallet,salt,evidence);
 assert.equal(a.slice(0,10),selector('commitmentFor(uint256,address,bytes32,bytes)'));
 assert.equal(a.slice(10,10+64),word(7));
 assert.equal(a.slice(10+64,10+128),addr(wallet));
 assert.equal(a.slice(10+192,10+256),word(128));
 assert.equal(a.slice(10+256,10+320),word(11));
 assert.equal(a.slice(10+320,10+320+22),utf8Hex(evidence).slice(2));
 const b=encodeReveal(7,salt,evidence);
 assert.equal(b.slice(10+128,10+192),word(96));
 assert.equal(b.slice(10+192,10+256),word(11));
});
test('Sponsor challenge pins BTEST token, scope, approved verifier and target',()=>{
 const data=encodeCreate({token,reward:100n,bond:10n,verifier:reviewer,target,scopeHash:reviewScopeHash,commitDeadline:2000,revealDeadline:4000});
 assert.equal(data.slice(0,10),'0xa9a61964');
 assert.equal(data.slice(10,74),addr(token));
 assert.equal(data.slice(74,138),word(100));
 assert.equal(data.slice(10+5*64,10+6*64),reviewScopeHash.slice(2));
 assert.ok(BOUNTY_SCOPE.includes('BTEST'));
 const verdict=encodeApproveFinding({escrow,id:1,solver:wallet,target,scopeHash:reviewScopeHash,evidenceText:'example'});
 assert.equal(verdict.slice(0,10),'0x3d44475d');
 assert.equal(verdict.slice(-64),textHash('example').slice(2));
 assert.equal(encodeReviewKey(escrow,1,wallet,target,reviewScopeHash,'example').slice(0,10),selector('findingKey(address,uint256,address,address,bytes32,bytes32)'));
});
test('Reviewer constructor ABI encodes array and threshold without guessed offsets',()=>{
 const result=encodeVerifierCreation(code.creationCode,[wallet,reviewer],2);
 assert.equal(result.slice(0,code.creationCode.length),code.creationCode);
 const tail=result.slice(code.creationCode.length);
 assert.equal(tail.slice(0,64),word(64));
 assert.equal(tail.slice(64,128),word(2));
 assert.equal(tail.slice(128,192),word(2));
 assert.equal(tail.slice(192,256),addr(wallet));
 assert.equal(tail.slice(256,320),addr(reviewer));
 assert.throws(()=>encodeVerifierCreation(code.creationCode,[wallet,wallet],1),/distinct/);
 assert.throws(()=>encodeVerifierCreation(code.creationCode,[wallet],2),/threshold/);
});
test('Compiled reviewer bytecode matches committed artifacts and source',()=>{
 const artifact=JSON.parse(readFileSync(new URL('../../out/ReviewedFindingVerifier.sol/ReviewedFindingVerifier.json',import.meta.url),'utf8'));
 assert.equal(code.creationCode,artifact.bytecode.object);
 assert.equal(code.runtimeCode,artifact.deployedBytecode.object);
 const refs=Object.values(artifact.deployedBytecode.immutableReferences).flat().sort((a,b)=>a.start-b.start);
 assert.deepEqual([...code.immutableRefs].sort((a,b)=>a.start-b.start),refs);
 assert.equal(code.sourceSha256,createHash('sha256').update(readFileSync(new URL('../../src/ReviewedFindingVerifier.sol',import.meta.url))).digest('hex'));
});
test('Challenge and commitment decoders refuse forged or malformed states',()=>{
 const w=[addr(wallet),addr(token),addr(reviewer),addr(target),word(8),word(9),word(100n*10n**18n),word(10n*10n**18n),word(1000),word(2000),word(1),word(0),word(0)];
 const c=parseChallenge('0x'+w.join(''));
 assert.equal(c.sponsor.toLowerCase(),wallet.toLowerCase());
 assert.equal(displayAmount(c.reward),'100');
 assert.ok(challengeAllowed(c,{mockToken:token,practiceVault:target}));
 assert.ok(!challengeAllowed(c,{mockToken:escrow,practiceVault:target}));
 assert.equal(parseCommitment('0x'+digest.slice(2)+word(10)+word(1)).status,1);
 assert.throws(()=>parseChallenge('0x1234'),/Malformed/);
});
test('No approval path accepts unbounded input or real-value token choices',()=>{
 assert.equal(amount('12.125'),12125000000000000000n);
 assert.equal(displayAmount(amount('12.125')),'12.125');
 assert.throws(()=>amount('0'),/BTEST/);
 assert.throws(()=>amount('10001'),/BTEST/);
 assert.throws(()=>amount('3.12345'),/BTEST/);
 assert.equal(safeEvidence('repro steps'),true);
 assert.equal(safeEvidence(''),false);
 assert.equal(safeEvidence('a'.repeat(1501)),false);
 assert.equal(isValidChallengeId('1'),true);
 assert.equal(isValidChallengeId('0'),false);
 assert.equal(isValidChallengeId('1e3'),false);
});
test('Challenge creation ID is accepted only from the exact escrow event',()=>{
 const topic=textHash('ChallengeCreated(uint256,address,address,address,address,bytes32,uint256,uint256,uint64,uint64)');
 const receipt={logs:[{address:escrow,topics:[topic,'0x'+word(19)]}]};
 assert.equal(eventChallengeId(receipt,escrow),'19');
 assert.throws(()=>eventChallengeId(receipt,wallet),/Expected/);
});
