import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WIF_MAINNET_CHAIN_ID, WIF_TOKEN, TRANSFER_TOPIC, MAX_UINT256,
  keccakHex, parseTokenAmount, formatTokenAmount, typedDataFor, requestDigest,
  ecrecoverCallData, verifyRequestSignature, validateRequest, transferData,
  validateTransferData, validateRecipientCode, decodeSymbolResult, encodeSharePayload,
  decodeSharePayload, validateMinedTransfer, explorerTransactionUrl, normalizeRequest
} from '../pay-core.mjs';

const recipient = '0x1111111111111111111111111111111111111111';
const payer = '0x2222222222222222222222222222222222222222';
const nonce = '0x' + 'ab'.repeat(32);
const signature = '0x' + '01'.repeat(32) + '02'.repeat(32) + '1b';
const future = BigInt(Math.floor(Date.now() / 1000)) + 3600n;
const request = {recipient, token: WIF_TOKEN, chainId: WIF_MAINNET_CHAIN_ID, amount: 1250000000000000000n, expiresAt: future, nonce};

test('EVM Keccak vectors and official Transfer topic are exact', () => {
  assert.equal(keccakHex(new Uint8Array()), '0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470');
  assert.equal(keccakHex(new TextEncoder().encode('abc')), '0x4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45');
  assert.equal(TRANSFER_TOPIC, '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef');
});

test('amount encoding accepts exact 18-decimal integers and rejects unsafe values', () => {
  assert.equal(parseTokenAmount('1.25'), 1250000000000000000n);
  assert.equal(formatTokenAmount(parseTokenAmount('1.250000000000000000')), '1.25');
  for (const value of ['', '0', '01', '1e2', '1.1234567890123456789', '-1', ' 1 ']) assert.throws(() => parseTokenAmount(value));
  assert.throws(() => validateRequest({...request, amount: 0n}));
  assert.throws(() => validateRequest({...request, amount: MAX_UINT256 + 1n}));
});

test('typed data is bound to recipient, WIF, chain, amount, expiry and nonce', () => {
  const typed = typedDataFor(request);
  assert.equal(typed.primaryType, 'PaymentRequest');
  assert.equal(typed.domain.chainId, 4663);
  assert.equal(typed.domain.verifyingContract.toLowerCase(), WIF_TOKEN.toLowerCase());
  assert.equal(typed.message.amount, request.amount.toString());
  const variants = [
    {...request, recipient: payer},
    {...request, amount: request.amount + 1n},
    {...request, expiresAt: request.expiresAt + 1n},
    {...request, nonce: '0x' + 'cd'.repeat(32)}
  ];
  for (const variant of variants) assert.notEqual(requestDigest(variant), requestDigest(request));
  assert.throws(() => requestDigest({...request, chainId: 46630n}), /mainnet/);
  assert.throws(() => requestDigest({...request, token: '0x3333333333333333333333333333333333333333'}), /official WIF/);
});

test('signature verification fails closed when the EIP-712 digest is mutated', async () => {
  const expectedCall = ecrecoverCallData(requestDigest(request), signature).toLowerCase();
  const calls = [];
  const mockRpc = async (method, params) => {
    calls.push({method, params});
    if (method !== 'eth_call') throw new Error('unexpected RPC method');
    return params[0].data.toLowerCase() === expectedCall ? '0x' + '0'.repeat(24) + recipient.slice(2) : '0x' + '0'.repeat(64);
  };
  const verified = await verifyRequestSignature(request, signature, mockRpc);
  assert.equal(verified.signer, recipient);
  assert.equal(calls.length, 1);
  await assert.rejects(() => verifyRequestSignature({...request, amount: request.amount + 1n}, signature, mockRpc), /recovery failed|authenticate/);
  await assert.rejects(() => verifyRequestSignature({...request, nonce: '0x' + 'cd'.repeat(32)}, signature, mockRpc), /recovery failed|authenticate/);
});

test('receipt proof can be revalidated after request expiry without reopening Pay', async () => {
  const expired = {...request, expiresAt: 1n};
  await assert.rejects(() => verifyRequestSignature(expired, signature, async () => '0x' + '0'.repeat(64)), /expired/);
  const expectedCall = ecrecoverCallData(requestDigest(normalizeRequest(expired)), signature).toLowerCase();
  const recovered = await verifyRequestSignature(expired, signature, async (method, params) => {
    assert.equal(method, 'eth_call');
    assert.equal(params[0].data.toLowerCase(), expectedCall);
    return '0x' + '0'.repeat(24) + recipient.slice(2);
  }, {allowExpired: true});
  assert.equal(recovered.signer, recipient);
});

test('malformed, high-s and wrong-recovery signatures are rejected before RPC', async () => {
  for (const bad of ['0x', '0x' + '00'.repeat(64) + '1c', '0x' + '01'.repeat(32) + 'ff'.repeat(32) + '1b']) {
    await assert.rejects(() => verifyRequestSignature(request, bad, async () => '0x' + '0'.repeat(64)), /signature|scalar/i);
  }
});

test('request validation rejects changed chain, token, recipient contract, expiry and nonce', () => {
  assert.throws(() => validateRequest({...request, chainId: 46630n}), /mainnet/);
  assert.throws(() => validateRequest({...request, token: '0x3333333333333333333333333333333333333333'}), /official WIF/);
  assert.throws(() => validateRequest({...request, expiresAt: 1n}), /expired/);
  assert.throws(() => validateRequest({...request, nonce: '0x' + '00'.repeat(32)}), /nonce/);
  assert.throws(() => validateRequest({...request, recipient: '0x0000000000000000000000000000000000000001'}), /precompile/);
  assert.throws(() => validateRequest({...request, recipient: WIF_TOKEN}), /token contract/);
  assert.throws(() => validateRecipientCode('0x60016000'), /EIP-1271/);
  assert.throws(() => validateRecipientCode('not-hex'), /malformed/);
});

test('transfer calldata is exact and rejects short, extra, recipient and amount mutations', () => {
  const data = transferData(request);
  assert.equal(data.length, 138);
  assert.equal(validateTransferData(data, request), true);
  for (const bad of [data.slice(0, -2), data + '00', data.replace(recipient.slice(2), payer.slice(2)), data.slice(0, -1) + (data.endsWith('0') ? '1' : '0')]) {
    assert.throws(() => validateTransferData(bad, request), /calldata/);
  }
});

test('share payload round-trips only public request material and rejects malformed payloads', () => {
  const payload = encodeSharePayload(request, signature);
  const decoded = decodeSharePayload(payload);
  assert.deepEqual(decoded.request, {...request, version: 1, recipient: recipient.toLowerCase(), token: WIF_TOKEN.toLowerCase(), nonce});
  assert.equal(decoded.signature, signature);
  for (const bad of ['', '!', payload.slice(0, -1)]) assert.throws(() => decodeSharePayload(bad));
});

test('mined proof requires sender, destination, exact calldata, success and one matching Transfer log', () => {
  const hash = '0x' + 'de'.repeat(32);
  const block = '0x64';
  const blockHash = '0x' + 'aa'.repeat(32);
  const tx = {hash, from: payer, to: WIF_TOKEN, input: transferData(request), value: '0x0', blockNumber: block, blockHash, transactionIndex: '0x0'};
  const receipt = {
    transactionHash: hash, status: '0x1', blockNumber: block, blockHash, transactionIndex: '0x0', from: payer, to: WIF_TOKEN,
    logs: [{address: WIF_TOKEN, topics: [TRANSFER_TOPIC, '0x' + payer.slice(2).padStart(64, '0'), '0x' + recipient.slice(2).padStart(64, '0')], data: '0x' + request.amount.toString(16).padStart(64, '0')}]
  };
  const proof = validateMinedTransfer({transaction: tx, receipt, request, sender: payer, currentBlock: '0x66', confirmations: 3});
  assert.equal(proof.confirmations, 3);
  assert.equal(explorerTransactionUrl(hash), 'https://robinhoodchain.blockscout.com/tx/' + hash);
  for (const mutation of [
    {...tx, from: recipient}, {...tx, to: recipient}, {...tx, input: transferData({...request, amount: request.amount + 1n})},
    {...receipt, status: '0x0'}, {...receipt, logs: []}, {...receipt, transactionHash: '0x' + 'ad'.repeat(32)},
    {...receipt, blockHash: '0x' + 'bb'.repeat(32)}, {...receipt, transactionIndex: '0x1'}
  ]) {
    const isReceipt = mutation === receipt || Object.prototype.hasOwnProperty.call(mutation, 'logs');
    assert.throws(() => validateMinedTransfer({transaction: isReceipt ? tx : mutation, receipt: isReceipt ? mutation : receipt, request, sender: payer, currentBlock: '0x66', confirmations: 3}));
  }
});

test('WIF metadata parser is strict', () => {
  const good = '0x' + '0'.repeat(62) + '20' + '0'.repeat(62) + '03' + '574946' + '0'.repeat(58);
  assert.equal(decodeSymbolResult(good), 'WIF');
  assert.throws(() => decodeSymbolResult('0x' + '574947' + '0'.repeat(58)));
});
