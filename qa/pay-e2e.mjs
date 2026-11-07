import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {chromium} from 'playwright';
import {WIF_TOKEN, TRANSFER_TOPIC} from '../web/pay-core.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../web');
const files = {
  '/': 'index.html', '/app/pay/': 'app/pay/index.html', '/pay.js': 'pay.js', '/pay-core.mjs': 'pay-core.mjs',
  '/pay.css': 'pay.css', '/favicon.svg': 'favicon.svg', '/styles.css': 'styles.css', '/app.js': 'app.js',
  '/core.mjs': 'core.mjs', '/onchain.mjs': 'onchain.mjs', '/deployment.json': 'deployment.json'
};
const mime = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.css': 'text/css; charset=utf-8'};
const server = createServer(async (req, res) => {
  const file = files[new URL(req.url, 'http://localhost').pathname];
  if (!file) { res.writeHead(404); res.end('Not found'); return; }
  try {
    const data = await readFile(path.join(root, file));
    res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream'});
    res.end(data);
  } catch { res.writeHead(404); res.end('Not found'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = 'http://127.0.0.1:' + server.address().port;
const recipient = '0x1111111111111111111111111111111111111111';
const payer = '0x2222222222222222222222222222222222222222';
const signature = '0x' + '01'.repeat(32) + '02'.repeat(32) + '1b';
const txHash = '0x' + 'de'.repeat(32);
const blockHash = '0x' + 'aa'.repeat(32);
const problems = [];
let browser;

function wordAddress(address) { return '0x' + address.slice(2).toLowerCase().padStart(64, '0'); }
function wordUint(value) { return '0x' + BigInt(value).toString(16).padStart(64, '0'); }

function routeRPC(page, options = {}) {
  const config = {
    chain: '0x1237', recipientCode: '0x', receiptSequence: null, blockSequence: ['0x66'],
    receiptFailures: 0, receiptStatus: '0x1', ...options
  };
  let sentTx = null;
  let receiptCalls = 0;
  let blockCalls = 0;
  const metrics = {receiptCalls: 0, blockCalls: 0};
  const mockData = '0xa9059cbb' + recipient.slice(2).padStart(64, '0') + (1250000000000000000n).toString(16).padStart(64, '0');
  const makeTransaction = () => ({
    hash: txHash, from: sentTx?.from || payer, to: sentTx?.to || WIF_TOKEN, input: sentTx?.data || mockData,
    value: sentTx?.value || '0x0', chainId: '0x1237', blockNumber: '0x64', blockHash, transactionIndex: '0x0'
  });
  const makeReceipt = (status = config.receiptStatus, blockNumber = '0x64') => ({
    transactionHash: txHash, status, blockNumber, blockHash, transactionIndex: '0x0',
    from: sentTx?.from || payer, to: sentTx?.to || WIF_TOKEN,
    logs: [{
      address: WIF_TOKEN,
      topics: [TRANSFER_TOPIC, wordAddress(sentTx?.from || payer), '0x' + (sentTx?.data || mockData).slice(10, 74)],
      data: '0x' + (sentTx?.data || mockData).slice(74)
    }]
  });
  page.route('https://rpc.mainnet.chain.robinhood.com/**', async route => {
    const body = JSON.parse(route.request().postData() || '{}');
    let result = null;
    if (body.method === 'eth_chainId') result = config.chain;
    else if (body.method === 'eth_getCode') result = body.params[0].toLowerCase() === recipient.toLowerCase() ? config.recipientCode : '0x60016000';
    else if (body.method === 'eth_call') {
      const call = body.params[0] || {};
      const selector = call.data?.slice(0, 10)?.toLowerCase();
      if (call.to?.toLowerCase() === '0x0000000000000000000000000000000000000001') result = '0x' + '0'.repeat(24) + recipient.slice(2);
      else if (selector === '0x95d89b41') result = '0x' + '0'.repeat(62) + '20' + '0'.repeat(62) + '03' + '574946' + '0'.repeat(58);
      else if (selector === '0x313ce567') result = wordUint(18);
      else if (selector === '0x70a08231') result = wordUint(5_000_000_000_000_000_000n);
      else result = wordUint(1);
    } else if (body.method === 'eth_getBalance') result = wordUint(1_000_000_000_000_000_000n);
    else if (body.method === 'eth_gasPrice') result = '0x1';
    else if (body.method === 'eth_estimateGas') result = '0x5208';
    else if (body.method === 'eth_blockNumber') {
      metrics.blockCalls++;
      const index = Math.min(blockCalls++, config.blockSequence.length - 1);
      result = config.blockSequence[index];
    } else if (body.method === 'eth_getTransactionByHash') result = makeTransaction();
    else if (body.method === 'eth_getTransactionReceipt') {
      metrics.receiptCalls++;
      if (config.receiptFailures > 0) { config.receiptFailures--; await route.abort('failed'); return; }
      const index = Math.min(receiptCalls++, (config.receiptSequence?.length || 1) - 1);
      const entry = config.receiptSequence?.[index];
      if (config.receiptSequence && entry === null) result = null;
      else if (entry && typeof entry === 'object') result = makeReceipt(entry.status || config.receiptStatus, entry.blockNumber || '0x64');
      else result = makeReceipt();
    }
    await route.fulfill({status: 200, contentType: 'application/json', headers: {'access-control-allow-origin': '*'}, body: JSON.stringify({jsonrpc: '2.0', id: body.id || 1, result})});
  });
  return metrics;
}

function wallet(page, {mode = 'payer', chain = '0x1237', missing = false, rejectSign = false, rejectSend = false, sendError = null, sendDelay = 0} = {}) {
  return page.addInitScript(({account, chainId, signatureValue, missingWallet, rejectSignature, rejectTransaction, transactionError, transactionDelay, hash}) => {
    window.__walletTransactions = [];
    const listeners = {};
    if (missingWallet) return;
    window.ethereum = {
      on: (event, callback) => { (listeners[event] ||= []).push(callback); },
      request: async ({method, params}) => {
        if (method === 'eth_chainId') return chainId;
        if (method === 'eth_requestAccounts' || method === 'eth_accounts') return [account];
        if (method === 'eth_signTypedData_v4') {
          if (rejectSignature) { const error = new Error('User rejected the request'); error.code = 4001; throw error; }
          window.__typedData = JSON.parse(params[1]);
          return signatureValue;
        }
        if (method === 'eth_sendTransaction') {
          window.__walletTransactions.push(params[0]);
          if (transactionDelay) await new Promise(resolve => setTimeout(resolve, transactionDelay));
          if (rejectTransaction) { const error = new Error('User rejected the request'); error.code = 4001; throw error; }
          if (transactionError) { const error = new Error(transactionError.message || 'Wallet request failed ambiguously'); error.code = transactionError.code; throw error; }
          return hash;
        }
        throw new Error('Unexpected wallet method ' + method);
      }
    };
    window.__emitWalletEvent = (event, value) => { for (const callback of listeners[event] || []) callback(value); };
  }, {account: mode === 'recipient' ? recipient : payer, chainId: chain, signatureValue: signature, missingWallet: missing, rejectSignature: rejectSign, rejectTransaction: rejectSend, transactionError: sendError, transactionDelay: sendDelay, hash: txHash});
}

async function noAxeViolations(page) {
  return page.evaluate(async () => { const {violations} = await axe.run(document, {runOnly: {type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa']}}); return violations.map(v => ({id: v.id, impact: v.impact, nodes: v.nodes.length})); });
}
async function assertNoOverflow(page, width) {
  const size = await page.evaluate(() => ({scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth}));
  if (size.scroll > size.client + 1) problems.push(`${width}px horizontal overflow ${JSON.stringify(size)}`);
}
async function checkAndPay(page) {
  await page.locator('#check-card').waitFor({state: 'visible'});
  await page.locator('#check-payment').click();
  await page.locator('#check-results').waitFor({state: 'visible'});
  assert.equal(await page.locator('#pay-now').isDisabled(), false);
  await page.evaluate(() => {
    document.querySelector('#pay-now').click();
    document.querySelector('#pay-now').click();
  });
}

try {
  browser = await chromium.launch({headless: true});
  for (const width of [320, 375, 390, 768, 1280]) {
    const context = await browser.newContext({viewport: {width, height: 900}, reducedMotion: 'reduce'});
    const page = await context.newPage();
    page.on('pageerror', error => problems.push(`${width}px page error: ${error.message}`));
    await page.goto(base + '/app/pay/', {waitUntil: 'domcontentloaded'});
    await page.addScriptTag({path: path.join(here, 'node_modules/axe-core/axe.min.js')});
    assert.deepEqual(await noAxeViolations(page), []);
    await assertNoOverflow(page, width);
    assert.equal(await page.locator('#create-card').isHidden(), false);
    await context.close();
  }

  const missingContext = await browser.newContext({viewport: {width: 1280, height: 900}, reducedMotion: 'reduce'});
  const missingPage = await missingContext.newPage();
  await wallet(missingPage, {missing: true});
  await missingPage.goto(base + '/app/pay/', {waitUntil: 'domcontentloaded'});
  await missingPage.locator('#pay-amount').fill('1'); await missingPage.locator('#create-request').click();
  await missingPage.waitForFunction(() => document.querySelector('#pay-feedback').textContent.includes('No EIP-1193 wallet'));
  assert.equal(await missingPage.locator('#pay-feedback').getAttribute('data-kind'), 'error');
  await missingContext.close();

  const wrongChainContext = await browser.newContext({viewport: {width: 1280, height: 900}, reducedMotion: 'reduce'});
  const wrongChainPage = await wrongChainContext.newPage();
  await wallet(wrongChainPage, {mode: 'recipient', chain: '0xb626'});
  await wrongChainPage.goto(base + '/app/pay/', {waitUntil: 'domcontentloaded'});
  await wrongChainPage.locator('#pay-amount').fill('1'); await wrongChainPage.locator('#create-request').click();
  await wrongChainPage.waitForFunction(() => document.querySelector('#pay-feedback').textContent.includes('not connected to Robinhood Chain mainnet'));
  await wrongChainContext.close();

  const rejectedContext = await browser.newContext({viewport: {width: 1280, height: 900}, reducedMotion: 'reduce'});
  const rejectedPage = await rejectedContext.newPage();
  await wallet(rejectedPage, {mode: 'recipient', rejectSign: true});
  routeRPC(rejectedPage);
  await rejectedPage.goto(base + '/app/pay/', {waitUntil: 'domcontentloaded'});
  await rejectedPage.locator('#pay-amount').fill('1'); await rejectedPage.locator('#create-request').click();
  await rejectedPage.waitForFunction(() => document.querySelector('#pay-feedback').textContent.includes('signature was rejected'));
  assert.equal(await rejectedPage.locator('#share-card').isHidden(), true);
  await rejectedContext.close();

  const creatorContext = await browser.newContext({viewport: {width: 1280, height: 900}, reducedMotion: 'reduce'});
  const creator = await creatorContext.newPage();
  await wallet(creator, {mode: 'recipient'}); routeRPC(creator);
  await creator.goto(base + '/app/pay/', {waitUntil: 'domcontentloaded'});
  await creator.locator('#pay-amount').fill('1.25'); await creator.locator('#create-request').click();
  await creator.locator('#share-card').waitFor({state: 'visible'});
  const link = await creator.locator('#share-link').inputValue();
  assert.match(link, /\/app\/pay\/\?request=/);
  assert.equal(await creator.evaluate(() => window.__walletTransactions.length), 0, 'Creating a request must never send a transaction');
  assert.equal(await creator.locator('#request-state').innerText(), 'Signed · needs check');
  await creator.addScriptTag({path: path.join(here, 'node_modules/axe-core/axe.min.js')});
  assert.deepEqual(await noAxeViolations(creator), []);
  await creatorContext.close();

  const delayedContext = await browser.newContext({viewport: {width: 1280, height: 900}, reducedMotion: 'reduce'});
  const delayedPage = await delayedContext.newPage();
  const delayedMetrics = routeRPC(delayedPage, {receiptSequence: [null, {blockNumber: '0x64'}, {blockNumber: '0x64'}, {blockNumber: '0x64'}], blockSequence: ['0x64', '0x64', '0x65', '0x66']});
  await wallet(delayedPage);
  await delayedPage.goto(link, {waitUntil: 'domcontentloaded'});
  await checkAndPay(delayedPage);
  await delayedPage.waitForFunction(() => document.querySelector('#proof-state').textContent.includes('Submitted') || document.querySelector('#proof-state').textContent.includes('Mined'));
  assert.equal(await delayedPage.locator('#pay-now').isDisabled(), true, 'Pay must remain disabled while receipt/confirmations are pending');
  await delayedPage.evaluate(() => window.__emitWalletEvent('accountsChanged', ['0x3333333333333333333333333333333333333333']));
  assert.equal(await delayedPage.locator('#pay-now').isDisabled(), true, 'Wallet changes must not unlock a pending payment');
  await delayedPage.locator('#proof-card').waitFor({state: 'visible'});
  await delayedPage.waitForFunction(() => document.querySelector('#pay-feedback').textContent.includes('proof verified'));
  assert.equal(await delayedPage.evaluate(() => window.__walletTransactions.length), 1, 'Delayed receipt and repeated clicks must broadcast exactly once');
  assert.ok(delayedMetrics.receiptCalls >= 4, 'Receipt polling must observe pending and confirmation stages');
  await delayedContext.close();

  const reloadPendingContext = await browser.newContext({viewport: {width: 390, height: 900}, reducedMotion: 'reduce'});
  const reloadPendingPage = await reloadPendingContext.newPage();
  routeRPC(reloadPendingPage, {receiptSequence: [null, null, null, null, null, null, null, null, null, null, null]});
  await wallet(reloadPendingPage);
  await reloadPendingPage.goto(link, {waitUntil: 'domcontentloaded'});
  await checkAndPay(reloadPendingPage);
  await reloadPendingPage.waitForFunction(() => document.querySelector('#proof-state').textContent.includes('Submitted'));
  const pendingUrl = reloadPendingPage.url();
  assert.match(pendingUrl, /[?&]tx=0x/);
  assert.equal(await reloadPendingPage.evaluate(() => window.__walletTransactions.length), 1);
  assert.equal(await reloadPendingPage.locator('#pay-now').isDisabled(), true);
  await reloadPendingContext.close();

  const reloadRecoveryContext = await browser.newContext({viewport: {width: 390, height: 900}, reducedMotion: 'reduce'});
  const reloadRecoveryPage = await reloadRecoveryContext.newPage();
  routeRPC(reloadRecoveryPage, {receiptSequence: [{blockNumber: '0x64'}], blockSequence: ['0x66']});
  await reloadRecoveryPage.goto(pendingUrl, {waitUntil: 'domcontentloaded'});
  await reloadRecoveryPage.waitForFunction(() => document.querySelector('#proof-feedback') === null || document.querySelector('#pay-feedback').textContent.includes('proof verified'));
  await reloadRecoveryPage.locator('#proof-card').waitFor({state: 'visible'});
  await reloadRecoveryPage.waitForFunction(() => document.querySelector('#proof-state').textContent.includes('Verified'));
  assert.equal(await reloadRecoveryPage.evaluate(() => window.__walletTransactions?.length ?? 0), 0, 'Reload recovery must be read-only');
  assert.equal(await reloadRecoveryPage.locator('#check-card').isHidden(), true);
  await reloadRecoveryContext.close();

  const rpcFailureContext = await browser.newContext({viewport: {width: 1280, height: 900}, reducedMotion: 'reduce'});
  const rpcFailurePage = await rpcFailureContext.newPage();
  const rpcFailureMetrics = routeRPC(rpcFailurePage, {receiptFailures: 1, receiptSequence: [{blockNumber: '0x64'}], blockSequence: ['0x66', '0x66']});
  await wallet(rpcFailurePage); await rpcFailurePage.goto(link, {waitUntil: 'domcontentloaded'});
  await checkAndPay(rpcFailurePage);
  await rpcFailurePage.waitForFunction(() => document.querySelector('#pay-feedback').textContent.includes('proof verified'));
  assert.equal(await rpcFailurePage.evaluate(() => window.__walletTransactions.length), 1, 'RPC failure must not trigger a second broadcast');
  assert.ok(rpcFailureMetrics.receiptCalls >= 2, 'RPC failure must be retried read-only');
  await rpcFailureContext.close();

  const revertedContext = await browser.newContext({viewport: {width: 1280, height: 900}, reducedMotion: 'reduce'});
  const revertedPage = await revertedContext.newPage();
  routeRPC(revertedPage, {receiptSequence: [{status: '0x0'}], blockSequence: ['0x66']});
  await wallet(revertedPage); await revertedPage.goto(link, {waitUntil: 'domcontentloaded'});
  await checkAndPay(revertedPage);
  await revertedPage.waitForFunction(() => document.querySelector('#proof-state').textContent.includes('Known reverted'));
  assert.match(await revertedPage.locator('#pay-feedback').innerText(), /reports failure|did not settle/);
  assert.equal(await revertedPage.locator('#pay-now').isDisabled(), true);
  assert.equal(await revertedPage.evaluate(() => window.__walletTransactions.length), 1, 'Reverted receipt must remain locked and never retry automatically');
  await revertedContext.close();

  const uncertainContext = await browser.newContext({viewport: {width: 1280, height: 900}, reducedMotion: 'reduce'});
  const uncertainPage = await uncertainContext.newPage();
  routeRPC(uncertainPage);
  await wallet(uncertainPage, {sendError: {code: -32000, message: 'provider timeout after acceptance'}});
  await uncertainPage.goto(link, {waitUntil: 'domcontentloaded'});
  await checkAndPay(uncertainPage);
  await uncertainPage.waitForFunction(() => document.querySelector('#proof-state').textContent.includes('Uncertain'));
  assert.equal(await uncertainPage.locator('#pay-now').isDisabled(), true);
  assert.match(await uncertainPage.locator('#pay-feedback').innerText(), /Do not retry|uncertain/i);
  assert.equal(await uncertainPage.evaluate(() => window.__walletTransactions.length), 1, 'Unknown wallet result must fail closed after one attempted send');
  await uncertainContext.close();

  assert.equal(problems.length, 0, problems.join('\n'));
  console.log(JSON.stringify({
    viewports: [320, 375, 390, 768, 1280], axeAudits: 7,
    missingWallet: 'PASS', wrongNetwork: 'PASS', rejectedSignature: 'PASS', requestCreationNoBroadcast: 'PASS',
    delayedReceiptPolling: 'PASS', lowConfirmationPolling: 'PASS', repeatedClickSingleSend: 'PASS',
    reloadRecoveryReadOnly: 'PASS', rpcFailureNoDuplicate: 'PASS', revertedReceiptFailClosed: 'PASS',
    walletPendingUncertainty: 'PASS', results: 'PASS'
  }, null, 2));
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
