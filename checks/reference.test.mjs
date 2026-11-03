import test from 'node:test';
import assert from 'node:assert/strict';
import { VaultPolicy } from '../reference/policy.mjs';

const base = () => new VaultPolicy({owner:'owner', recipient:'recipient', perTransfer:60n, dailyLimit:100n});
const tx = (amount, overrides={}) => ({caller:'owner', recipient:'recipient', amount:BigInt(amount), timestamp:120000, ...overrides});

test('allowed payment succeeds', () => {
  const p=base(); assert.equal(p.attempt(tx(60)).total,60n);
});
test('outsider cannot withdraw', () => {
  const p=base(); assert.throws(()=>p.attempt(tx(1,{caller:'other'})),/Unauthorized/);
});
test('approved owner cannot change destination', () => {
  const p=base(); assert.throws(()=>p.attempt(tx(1,{recipient:'other'})),/DestinationNotAllowed/);
});
test('no withdrawal may exceed per-transfer limit', () => {
  const p=base(); assert.throws(()=>p.attempt(tx(61)),/TransferTooLarge/);
});
test('split transfers cannot bypass 100 per day', () => {
  const p=base(); p.attempt(tx(60)); p.attempt(tx(40));
  assert.throws(()=>p.attempt(tx(1)),/DailyLimitExceeded/);
  assert.equal(p.spent,100n);
});
test('budget resumes in next 86400-second epoch', () => {
  const p=base(); p.attempt(tx(60)); p.attempt(tx(40));
  assert.equal(p.attempt(tx(60,{timestamp:190000})).total,60n);
});
test('rejected request never consumes budget', () => {
  const p=base(); p.attempt(tx(50));
  assert.throws(()=>p.attempt(tx(61)),/TransferTooLarge/);
  assert.equal(p.spent,50n);
});
test('invalid initial policy fails', () => {
  assert.throws(()=>new VaultPolicy({owner:'o',recipient:'r',perTransfer:20n,dailyLimit:10n}),/Invalid configuration/);
});
test('the practice vault failure is reproducible: two individually valid transfers exceed day cap', () => {
  const transfers=[60n,50n];
  assert.ok(transfers.every(x=>x<=60n));
  assert.ok(transfers.reduce((a,b)=>a+b,0n)>100n);
  const p=base(); p.attempt(tx(60));
  assert.throws(()=>p.attempt(tx(50)),/DailyLimitExceeded/);
});
