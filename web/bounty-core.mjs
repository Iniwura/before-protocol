import {CHAIN_ID,isAddress,isTxHash} from './core.mjs';

export const TOKEN_DECIMALS=18n;
export const UNIT=10n**TOKEN_DECIMALS;
export const BOUNTY_SCOPE='BEFORE BTEST training-vault finding. Testnet only. An appointed reviewer evaluates the submitted evidence; approval is not an automated exploit oracle.';
const MASK=(1n<<64n)-1n;
const RC=[
'0000000000000001','0000000000008082','800000000000808a','8000000080008000',
'000000000000808b','0000000080000001','8000000080008081','8000000000008009',
'000000000000008a','0000000000000088','0000000080008009','000000008000000a',
'000000008000808b','800000000000008b','8000000000008089','8000000000008003',
'8000000000008002','8000000000000080','000000000000800a','800000008000000a',
'8000000080008081','8000000000008080','0000000080000001','8000000080008008'
].map(x=>BigInt('0x'+x));
const R=[
[0,36,3,41,18],[1,44,10,45,2],[62,6,43,15,61],[28,55,25,21,56],[27,20,39,8,14]
];
const rot=(a,n)=>n===0?a:((a<<BigInt(n))|(a>>(64n-BigInt(n))))&MASK;
function permute(s){
 for(const rc of RC){
  const c=Array.from({length:5},(_,x)=>s[x]^s[x+5]^s[x+10]^s[x+15]^s[x+20]);
  for(let x=0;x<5;x++){
   const d=c[(x+4)%5]^rot(c[(x+1)%5],1);
   for(let y=0;y<5;y++)s[x+5*y]^=d;
  }
  const b=new Array(25).fill(0n);
  for(let x=0;x<5;x++)for(let y=0;y<5;y++)b[y+5*((2*x+3*y)%5)]=rot(s[x+5*y],R[x][y]);
  for(let x=0;x<5;x++)for(let y=0;y<5;y++)s[x+5*y]=(b[x+5*y]^((~b[(x+1)%5+5*y])&b[(x+2)%5+5*y]))&MASK;
  s[0]^=rc;
 }
}
export function hexFromBytes(bytes){return '0x'+Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('')}
export function bytesFromHex(value){
 if(typeof value!=='string'||!/^0x(?:[0-9a-fA-F]{2})*$/.test(value))throw Error('Invalid hex bytes.');
 return Uint8Array.from(value.slice(2).match(/.{2}/g)||[],s=>parseInt(s,16));
}
export function utf8Hex(text){return hexFromBytes(new TextEncoder().encode(String(text)))}
export function keccak256(data){
 const bytes=typeof data==='string'?bytesFromHex(data):data;
 if(!(bytes instanceof Uint8Array))throw Error('Expected bytes.');
 const rate=136,padded=new Uint8Array(Math.ceil((bytes.length+1)/rate)*rate||rate);
 padded.set(bytes);padded[bytes.length]=0x01;padded[padded.length-1]|=0x80;
 const state=new Array(25).fill(0n);
 for(let offset=0;offset<padded.length;offset+=rate){
  for(let i=0;i<rate;i++)state[Math.floor(i/8)]^=BigInt(padded[offset+i])<<BigInt(8*(i%8));
  permute(state);
 }
 const result=new Uint8Array(32);
 for(let i=0;i<32;i++)result[i]=Number((state[Math.floor(i/8)]>>BigInt(8*(i%8)))&255n);
 return hexFromBytes(result);
}
export const textHash=(text)=>keccak256(new TextEncoder().encode(text));
export const selector=(signature)=>textHash(signature).slice(0,10);
const HEX32=/^0x[0-9a-fA-F]{64}$/;
export function word(value){
 const v=BigInt(value);
 if(v<0n||v>=1n<<256n)throw Error('Uint256 out of range.');
 return v.toString(16).padStart(64,'0');
}
export function addr(value){
 if(!isAddress(value)||/^0x0{40}$/i.test(value))throw Error('Enter a valid nonzero wallet address.');
 return value.slice(2).toLowerCase().padStart(64,'0');
}
export function bytes32(value){
 if(!HEX32.test(value))throw Error('Expected a bytes32 hash.');
 return value.slice(2).toLowerCase();
}
export function amount(value){
 if(typeof value!=='string'||!/^\d{1,5}(?:\.\d{1,3})?$/.test(value)||Number(value)<=0||Number(value)>10000)throw Error('Enter 0.001–10,000 BTEST, up to 3 decimal places.');
 const [whole,fraction='']=value.split('.');
 return BigInt(whole)*UNIT+BigInt(fraction.padEnd(18,'0')||'0');
}
export function displayAmount(n){
 const number=BigInt(n);const whole=number/UNIT;const frac=(number%UNIT).toString().padStart(18,'0').replace(/0+$/,'');
 return whole.toString()+(frac?'.'+frac.slice(0,4):'');
}
export function encodeCall(signature,words=[]){return selector(signature)+words.join('')}
export function encodeBytes(hex){
 const bytes=bytesFromHex(hex),len=bytes.length;
 return word(len)+hex.slice(2).padEnd(Math.ceil(len/32)*64,'0');
}
export function encodeCreate({token,reward,bond,verifier,target,scopeHash,commitDeadline,revealDeadline}){
 return encodeCall('createChallenge((address,uint256,uint256,address,address,bytes32,uint64,uint64))',[
  addr(token),word(reward),word(bond),addr(verifier),addr(target),bytes32(scopeHash),word(commitDeadline),word(revealDeadline)
 ]);
}
export function encodeCommitmentFor(id,solver,salt,evidenceText){
 return encodeCall('commitmentFor(uint256,address,bytes32,bytes)',[
  word(id),addr(solver),bytes32(salt),word(128),encodeBytes(utf8Hex(evidenceText))
 ]);
}
export function encodeCommit(id,digest){
 return encodeCall('commit(uint256,bytes32)',[word(id),bytes32(digest)]);
}
export function encodeReveal(id,salt,evidenceText){
 return encodeCall('reveal(uint256,bytes32,bytes)',[word(id),bytes32(salt),word(96),encodeBytes(utf8Hex(evidenceText))]);
}
export function encodeApproveFinding({escrow,id,solver,target,scopeHash,evidenceText}){
 return encodeCall('approveFinding(address,uint256,address,address,bytes32,bytes32)',[
  addr(escrow),word(id),addr(solver),addr(target),bytes32(scopeHash),bytes32(textHash(evidenceText))
 ]);
}
export const encodeId=(fn,id)=>encodeCall(fn,[word(id)]);
export const encodeAddress=(fn,address)=>encodeCall(fn,[addr(address)]);
export const encodeAllowance=(owner,spender)=>encodeCall('allowance(address,address)',[addr(owner),addr(spender)]);
export const encodeMint=(who,quantity)=>encodeCall('mint(address,uint256)',[addr(who),word(quantity)]);
export const encodeApprove=(spender,quantity)=>encodeCall('approve(address,uint256)',[addr(spender),word(quantity)]);
export const encodeCommitmentStatus=(id,who)=>encodeCall('commitments(uint256,address)',[word(id),addr(who)]);
export function encodeVerifierCreation(bytecode,reviewers,threshold){
 if(!/^0x[0-9a-fA-F]+$/.test(bytecode)||bytecode.length<500)throw Error('Missing verified reviewer creation code.');
 if(!Array.isArray(reviewers)||reviewers.length<1||reviewers.length>3||new Set(reviewers.map(x=>x.toLowerCase())).size!==reviewers.length)throw Error('Choose 1–3 distinct reviewers.');
 if(!Number.isInteger(threshold)||threshold<1||threshold>reviewers.length)throw Error('Reviewer threshold exceeds the reviewer count.');
 return bytecode+word(64)+word(threshold)+word(reviewers.length)+reviewers.map(addr).join('');
}
export function parseChallenge(result){
 if(!/^0x(?:[0-9a-fA-F]{64}){13}$/.test(result))throw Error('Malformed onchain challenge state.');
 const words=result.slice(2).match(/.{64}/g);
 const address=i=>'0x'+words[i].slice(-40);
 const num=i=>BigInt('0x'+words[i]);
 return {
  sponsor:address(0),token:address(1),verifier:address(2),target:address(3),
  tokenCodeHash:'0x'+words[4],verifierCodeHash:'0x'+words[5],
  reward:num(6),bond:num(7),commitDeadline:num(8),revealDeadline:num(9),
  commitmentCount:num(10),rewardReleased:num(11)!==0n,canceled:num(12)!==0n
 };
}
export function parseCommitment(result){
 if(!/^0x(?:[0-9a-fA-F]{64}){3}$/.test(result))throw Error('Malformed commitment state.');
 const w=result.slice(2).match(/.{64}/g);
 return {digest:'0x'+w[0],bond:BigInt('0x'+w[1]),status:Number(BigInt('0x'+w[2]))};
}
export function decodeAddress(result){
 if(!/^0x[0-9a-fA-F]{64}$/.test(result))throw Error('Invalid ABI address.');
 return '0x'+result.slice(-40);
}
export function decodeNumber(result){
 if(!/^0x[0-9a-fA-F]{64}$/.test(result))throw Error('Invalid ABI uint.');
 return BigInt(result);
}
export function challengeAllowed(c,config){
 return c.token.toLowerCase()===config.mockToken.toLowerCase() &&
  c.target.toLowerCase()===config.practiceVault.toLowerCase();
}
export const reviewScopeHash=textHash(BOUNTY_SCOPE);
export const safeEvidence=(e)=>typeof e==='string'&&e.trim().length>0&&new TextEncoder().encode(e).length<=1500;
export const isValidChallengeId=(s)=>/^\d{1,15}$/.test(String(s))&&BigInt(s)>0n;
export const EXPLORER_TX=(tx)=>'https://explorer.testnet.chain.robinhood.com/tx/'+tx;
export const EXPLORER_ADDRESS=(a)=>'https://explorer.testnet.chain.robinhood.com/address/'+a;
export function encodeReviewKey(escrow,id,solver,target,scopeHash,evidenceText){
 return encodeCall('findingKey(address,uint256,address,address,bytes32,bytes32)',[
  addr(escrow),word(id),addr(solver),addr(target),bytes32(scopeHash),bytes32(textHash(evidenceText))
 ]);
}
export function eventChallengeId(receipt,escrow){
 const topic= textHash('ChallengeCreated(uint256,address,address,address,address,bytes32,uint256,uint256,uint64,uint64)').toLowerCase();
 const logs=(receipt.logs||[]).filter(l=>l.address?.toLowerCase()===escrow.toLowerCase()&&l.topics?.[0]?.toLowerCase()===topic);
 if(logs.length!==1||!HEX32.test(logs[0].topics?.[1]))throw Error('Expected exactly one escrow ChallengeCreated event.');
 return BigInt(logs[0].topics[1]).toString();
}
export {CHAIN_ID,isAddress,isTxHash};
