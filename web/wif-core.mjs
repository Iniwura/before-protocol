// Official World Is Flat token on Robinhood Chain mainnet. Read-only evidence.
export const WIF_MAINNET_CHAIN_ID=4663;
export const WIF_TOKEN='0x5173b8eA6923c2d40267890D45C46a3480954773';
export const WIF_RPC='https://rpc.mainnet.chain.robinhood.com';
export const WIF_EXPLORER='https://robinhoodchain.blockscout.com';
export const MAX_UINT256=(1n<<256n)-1n;
const ADDRESS=/^0x[0-9a-fA-F]{40}$/;
const HASH=/^0x[0-9a-fA-F]{64}$/;
export const isAddress=value=>typeof value==='string'&&ADDRESS.test(value)&&!/^0x0{40}$/i.test(value);
export const isHash=value=>typeof value==='string'&&HASH.test(value);
export const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
export const wordAddress=value=>{
 if(!isAddress(value))throw Error('Enter a valid, nonzero address (0x followed by 40 characters).');
 return value.slice(2).toLowerCase().padStart(64,'0');
};
export const revokeApprovalData=spender=>'0x095ea7b3'+wordAddress(spender)+'0'.repeat(64);
export const balanceData=owner=>'0x70a08231'+wordAddress(owner);
export const allowanceData=(owner,spender)=>'0xdd62ed3e'+wordAddress(owner)+wordAddress(spender);
export function readUint(hex){
 if(typeof hex!=='string'||!/^0x[0-9a-fA-F]{64}$/.test(hex))throw Error('Malformed onchain ERC-20 result.');
 return BigInt(hex);
}
export const decodeAddressWord=hex=>{
 if(typeof hex!=='string'||!/^0{24}[0-9a-fA-F]{40}$/.test(hex))throw Error('Malformed address argument.');
 return '0x'+hex.slice(24);
};
export function parseApprovalTransaction(tx,receipt){
 if(!tx||!receipt||!isHash(tx.hash)||!same(tx.hash,receipt.transactionHash)
  ||!same(tx.to,WIF_TOKEN)||!same(receipt.to,WIF_TOKEN)
  ||receipt.status!=='0x1'||!isAddress(tx.from)||!same(receipt.from,tx.from)
  ||(tx.chainId!==undefined&&BigInt(tx.chainId)!==BigInt(WIF_MAINNET_CHAIN_ID))
  ||(tx.blockHash&&receipt.blockHash&&!same(tx.blockHash,receipt.blockHash))
  ||!/^0x095ea7b3[0-9a-fA-F]{128}$/.test(tx.input||'')){
  throw Error('This is not a confirmed standard WIF approve(spender, amount) transaction on Robinhood mainnet.');
 }
 const spender=decodeAddressWord(tx.input.slice(10,74));
 if(!isAddress(spender))throw Error('The approval spender is a zero address.');
 const approvedAmount=BigInt('0x'+tx.input.slice(74,138));
 return {owner:tx.from,spender,approvedAmount,hash:tx.hash,approvalBlock:Number(BigInt(receipt.blockNumber))};
}
// Token metadata must be WIF, not just arbitrary bytes containing 574946.
export function isWifSymbol(hex){
 if(typeof hex!=='string'||!/^0x[0-9a-fA-F]+$/.test(hex))return false;
 const body=hex.slice(2).toLowerCase();
 // Standard ABI: offset=32, length=3, UTF-8 string bytes "WIF".
 if(body.length===192)return body.slice(0,64)===(32n).toString(16).padStart(64,'0')
  &&body.slice(64,128)===(3n).toString(16).padStart(64,'0')
  &&body.slice(128)==='574946'.padEnd(64,'0');
 // Rare legacy bytes32 response.
 return body.length===64&&body==='574946'.padEnd(64,'0');
}
export function formatWif(value,precision=5){
 if(value<0n)throw Error('Negative WIF amount.');
 if(value>0n&&value<10n**BigInt(18-precision))return '<0.'+'0'.repeat(precision-1)+'1';
 const whole=value/10n**18n;
 const fraction=(value%10n**18n).toString().padStart(18,'0').slice(0,precision).replace(/0+$/,'');
 return whole.toLocaleString('en-US')+(fraction?'.'+fraction:'');
}
export function permissionSummary(allowance,balance){
 if(allowance===0n)return {label:'No permission for this spender',message:'The WIF contract currently reports a zero allowance for this exact wallet and spender. Other spenders may still have approval.',level:'neutral'};
 if(allowance>=MAX_UINT256/2n)return {label:'Very large approval',message:'This spender has a very large WIF allowance. It could transfer WIF up to that limit whenever sufficient WIF is available. This does not prove malicious behavior.',level:'attention'};
 if(allowance>balance)return {label:'Approval exceeds current balance',message:'The permitted amount is greater than the wallet’s current WIF balance. This allowance may apply to WIF received in the future.',level:'attention'};
 return {label:'Active WIF permission',message:'This spender can transfer WIF up to its remaining onchain allowance, subject to your balance. This is not a security verdict.',level:'active'};
}
export function formatRPCBlock(hex){
 if(typeof hex!=='string'||!/^0x[0-9a-f]+$/i.test(hex))throw Error('Unverified block reference.');
 return Number(BigInt(hex));
}
