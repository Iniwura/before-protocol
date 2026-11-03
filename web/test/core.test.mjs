import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateProtect,evaluateChallenge,parseWholeAmount,isAddress,isTxHash,parseHexUint,decodeAddress,format18} from '../core.mjs';
test('valid transfer is allowed',()=>assert.equal(evaluateProtect({amount:'30',spent:'40',approved:true}).remaining,'30'));
test('destination rule blocks',()=>assert.equal(evaluateProtect({amount:'20',spent:'0',approved:false}).code,'DestinationNotAllowed'));
test('single transaction cannot exceed limit',()=>assert.equal(evaluateProtect({amount:'61',spent:'0',approved:true}).code,'TransferTooLarge'));
test('split amount cannot exceed daily limit',()=>assert.equal(evaluateProtect({amount:'41',spent:'60',approved:true}).code,'DailyLimitExceeded'));
test('zero transfer rejected',()=>assert.equal(evaluateProtect({amount:'0',spent:'0',approved:true}).code,'ZeroAmount'));
test('invalid amounts are rejected, not treated as zero',()=>assert.throws(()=>evaluateProtect({amount:'1.5',spent:'0',approved:true})));
test('amount parser rejects scientific and negative formats',()=>{for(const v of ['-1','0.1','1e7','NaN','+10','01'])assert.throws(()=>parseWholeAmount(v));});
test('valid split-bypass is detected',()=>assert.equal(evaluateChallenge({first:'60',second:'50'}).kind,'bypass'));
test('ordinary split is not an exploit',()=>assert.equal(evaluateChallenge({first:'40',second:'40'}).kind,'not-bypass'));
test('oversized practice request is invalid',()=>assert.equal(evaluateChallenge({first:'61',second:'50'}).kind,'invalid'));
test('chain inputs require strict hex formats',()=>{
 assert.equal(isAddress('0x'+'ab'.repeat(20)),true);
 assert.equal(isAddress('0x'+'aa'.repeat(21)),false);
 assert.equal(isTxHash('0x'+'cd'.repeat(32)),true);
 assert.equal(isTxHash('0x'+'cd'.repeat(31)),false);
});
test('RPC uint and ABI address decoding',()=>{
 assert.equal(parseHexUint('0xb626'),46630n);
 assert.equal(decodeAddress('0x'+'0'.repeat(24)+'a'.repeat(40)),'0x'+'a'.repeat(40));
 assert.throws(()=>decodeAddress('0x123'));
});
test('18 decimal formatting is deterministic',()=>{
 assert.equal(format18(60000000000000000000n),'60');
 assert.equal(format18(1234560000000000000n),'1.23456');
});
