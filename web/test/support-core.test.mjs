import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WIF_MAINNET_CHAIN_ID, WIF_TOKEN, SUPPORT_INTERVALS, SUPPORT_DOMAIN_NAME,
  normalizeSupportOffer, validateSupportOffer, supportTypedDataFor, supportDigest,
  verifySupportSignature, encodeSupportPayload, decodeSupportPayload,
  supportPaymentRequest, isSupportIntervalDue, transferData
} from '../support-core.mjs';
import {validateTransferData} from '../pay-core.mjs';

const recipient = '0x1111111111111111111111111111111111111111';
const payer = '0x2222222222222222222222222222222222222222';
const campaignId = '0x' + 'ab'.repeat(32);
const cycleId = '0x' + 'cd'.repeat(32);
const signature = '0x' + '01'.repeat(32) + '02'.repeat(32) + '1b';
const future = BigInt(Math.floor(Date.now() / 1000)) + 29n * 24n * 60n * 60n;
const offer = {recipient, token: WIF_TOKEN, chainId: WIF_MAINNET_CHAIN_ID, amount: 1250000000000000000n, interval: 'weekly', expiresAt: future, campaignId};

test('Support has a distinct typed offer and binds every public offer fact', () => {
  const typed = supportTypedDataFor(offer);
  assert.equal(typed.primaryType, 'SupportOffer');
  assert.equal(typed.domain.name, SUPPORT_DOMAIN_NAME);
  assert.equal(typed.domain.chainId, 4663);
  assert.equal(typed.message.interval, SUPPORT_INTERVALS.weekly.code);
  assert.equal(typed.message.campaignId, campaignId);
  for (const variant of [
    {...offer, recipient: payer}, {...offer, amount: offer.amount + 1n},
    {...offer, interval: 'monthly'}, {...offer, expiresAt: offer.expiresAt + 1n},
    {...offer, campaignId: '0x' + 'ef'.repeat(32)}
  ]) assert.notEqual(supportDigest(variant), supportDigest(offer));
});
test('Support offer validation is strict and bounded', () => {
  const normalized = validateSupportOffer(offer);
  assert.equal(normalized.recipient, recipient);
  assert.equal(normalized.interval, 'weekly');
  const longer = {...offer, interval: 'monthly', expiresAt: BigInt(Math.floor(Date.now() / 1000)) + 90n * 24n * 60n * 60n};
  assert.equal(validateSupportOffer(longer).interval, 'monthly', 'Monthly support links must survive multiple intentional return cycles');
  assert.equal(validateSupportOffer({...offer, expiresAt: BigInt(Math.floor(Date.now() / 1000)) + 31n * 24n * 60n * 60n}).interval, 'weekly');

  for (const bad of [
    {...offer, chainId: 46630n}, {...offer, token: '0x3333333333333333333333333333333333333333'},
    {...offer, amount: 0n}, {...offer, campaignId: '0x' + '00'.repeat(32)},
    {...offer, interval: 'daily'}, {...offer, expiresAt: 1n},
    {...offer, expiresAt: BigInt(Math.floor(Date.now() / 1000)) + 121n * 24n * 60n * 60n}
  ]) assert.throws(() => validateSupportOffer(bad));
});

test('Support signature recovery is tied to the SupportOffer digest', async () => {
  let observed;
  const verified = await verifySupportSignature(offer, signature, async (method, params) => {
    assert.equal(method, 'eth_call');
    observed = params[0].data;
    return '0x' + '0'.repeat(24) + recipient.slice(2);
  });
  assert.equal(verified.signer, recipient);
  assert.equal(observed, '0x' + supportDigest(offer).slice(2) + '0'.repeat(62) + '1b' + '01'.repeat(32) + '02'.repeat(32));
  await assert.rejects(() => verifySupportSignature({...offer, amount: offer.amount + 1n}, signature, async (method, params) => {
    assert.equal(method, 'eth_call');
    return params[0].data === observed ? '0x' + '0'.repeat(24) + recipient.slice(2) : '0x' + '0'.repeat(64);
  }), /recovery failed|authenticate/);
});

test('Support payload and explicit cycles are public and round-trip without spending permission', () => {
  const payload = encodeSupportPayload(offer, signature);
  const decoded = decodeSupportPayload(payload);
  assert.deepEqual(decoded.offer, {...offer, version: 1, recipient: recipient.toLowerCase(), token: WIF_TOKEN.toLowerCase(), campaignId});
  assert.equal(decoded.signature, signature);
  const request = supportPaymentRequest(offer, cycleId);
  assert.equal(request.nonce, cycleId);
  assert.equal(request.amount, offer.amount);
  assert.equal(validateTransferData(transferData(request), request), true);
  for (const bad of ['', '!', payload.slice(0, -1)]) assert.throws(() => decodeSupportPayload(bad));
  assert.throws(() => supportPaymentRequest(offer, '0x' + '00'.repeat(32)));
});

test('Cadence remains a reminder and never becomes an automatic-send claim', () => {
  const completed = Math.floor(Date.now() / 1000) - 8 * 24 * 60 * 60;
  assert.equal(isSupportIntervalDue(offer, completed), true);
  assert.equal(isSupportIntervalDue({...offer, interval: 'anytime'}, completed), false);
});
