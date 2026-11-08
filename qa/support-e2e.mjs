import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {chromium} from 'playwright';
import {WIF_TOKEN, TRANSFER_TOPIC} from '../web/pay-core.mjs';
import {encodeSupportPayload} from '../web/support-core.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../web');
const files = {
  '/': 'index.html', '/app/support/': 'app/support/index.html', '/support.js': 'support.js',
  '/support-core.mjs': 'support-core.mjs', '/pay-core.mjs': 'pay-core.mjs',
  '/pay.css': 'pay.css', '/support.css': 'support.css', '/landing.css': 'landing.css',
  '/favicon.svg': 'favicon.svg'
};
const mime = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml'};
const server = createServer(async (req, res) => {
  const file = files[new URL(req.url, 'http://localhost').pathname];
  if (!file) { res.writeHead(404); res.end('Not found'); return; }
  try { const data = await readFile(path.join(root, file)); res.writeHead(200, {'Content-Type': mime[path.extname(file)]}); res.end(data); }
  catch { res.writeHead(404); res.end('Not found'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = 'http://127.0.0.1:' + server.address().port;
const recipient = '0x1111111111111111111111111111111111111111';
const payer = '0x2222222222222222222222222222222222222222';
const signature = '0x' + '01'.repeat(32) + '02'.repeat(32) + '1b';
const hashes = ['0x' + 'de'.repeat(32), '0x' + 'ad'.repeat(32), '0x' + 'be'.repeat(32)];
const problems = [];
let browser;

function wordAddress(address) { return '0x' + address.slice(2).toLowerCase().padStart(64, '0'); }
function wordUint(value) { return '0x' + BigInt(value).toString(16).padStart(64, '0'); }
function routeRPC(page, options = {}) {
  const config = {chain: '0x1237', recipientCode: '0x', failureMethod: null, ...options};
  const records = new Map();
  const metrics = {sent: 0, calls: []};
  const mockData = '0xa9059cbb' + recipient.slice(2).padStart(64, '0') + (1250000000000000000n).toString(16).padStart(64, '0');
  for (const hash of hashes) {
    const transaction = {hash, from: payer, to: WIF_TOKEN, input: mockData, value: '0x0', blockNumber: '0x64', blockHash: '0x' + 'aa'.repeat(32), transactionIndex: '0x0'};
    const receipt = {transactionHash: hash, status: '0x1', blockNumber: '0x64', blockHash: transaction.blockHash, transactionIndex: '0x0', from: payer, to: WIF_TOKEN, logs: [{address: WIF_TOKEN, topics: [TRANSFER_TOPIC, wordAddress(payer), wordAddress(recipient)], data: '0x' + mockData.slice(74)}]};
    records.set(hash.toLowerCase(), {transaction, receipt});
  }
  page.route('https://rpc.mainnet.chain.robinhood.com/**', async route => {
    const body = JSON.parse(route.request().postData() || '{}');
    metrics.calls.push(body.method);
    if (config.failureMethod === body.method) { await route.abort('failed'); return; }
    let result = null;
    if (body.method === 'eth_chainId') result = config.chain;
    else if (body.method === 'eth_getCode') result = body.params[0].toLowerCase() === recipient.toLowerCase() ? config.recipientCode : '0x60016000';
    else if (body.method === 'eth_call') {
      const call = body.params[0] || {}; const selector = call.data?.slice(0, 10)?.toLowerCase();
      if (call.to?.toLowerCase() === '0x0000000000000000000000000000000000000001') result = '0x' + '0'.repeat(24) + recipient.slice(2);
      else if (selector === '0x95d89b41') result = '0x' + '0'.repeat(62) + '20' + '0'.repeat(62) + '03' + '574946' + '0'.repeat(58);
      else if (selector === '0x313ce567') result = wordUint(18);
      else if (selector === '0x70a08231') result = wordUint(5_000_000_000_000_000_000n);
      else result = wordUint(1);
    } else if (body.method === 'eth_getBalance') result = wordUint(1_000_000_000_000_000_000n);
    else if (body.method === 'eth_gasPrice') result = '0x1';
    else if (body.method === 'eth_estimateGas') result = '0x5208';
    else if (body.method === 'eth_blockNumber') result = '0x66';
    else if (body.method === 'eth_getTransactionByHash') result = records.get(body.params[0]?.toLowerCase())?.transaction || null;
    else if (body.method === 'eth_getTransactionReceipt') result = records.get(body.params[0]?.toLowerCase())?.receipt || null;
    await route.fulfill({status: 200, contentType: 'application/json', headers: {'access-control-allow-origin': '*'}, body: JSON.stringify({jsonrpc: '2.0', id: body.id || 1, result})});
  });
  return {metrics, records};
}

function wallet(page, {mode = 'payer', chain = '0x1237', missing = false, rejectSign = false, sendDelay = 0, transactionError = null, hashes: walletHashes = hashes} = {}) {
  return page.addInitScript(({account, chainId, signatureValue, missingWallet, rejectSignature, transactionDelay, sendError, sendHashes}) => {
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
          window.__typedData = JSON.parse(params[1]); return signatureValue;
        }
        if (method === 'eth_sendTransaction') {
          window.__walletTransactions.push(params[0]);
          if (transactionDelay) await new Promise(resolve => setTimeout(resolve, transactionDelay));
          if (sendError) { const error = new Error(sendError.message || 'Wallet response was ambiguous'); error.code = sendError.code; throw error; }
          return sendHashes[Math.min(window.__walletTransactions.length - 1, sendHashes.length - 1)];
        }
        throw new Error('Unexpected wallet method ' + method);
      }
    };
    window.__emitWalletEvent = (event, value) => { for (const callback of listeners[event] || []) callback(value); };
  }, {account: mode === 'recipient' ? recipient : payer, chainId: chain, signatureValue: signature, missingWallet: missing, rejectSignature: rejectSign, transactionDelay: sendDelay, sendError: transactionError, sendHashes: walletHashes});
}

async function noAxeViolations(page) {
  return page.evaluate(async () => { const {violations} = await axe.run(document, {runOnly: {type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa']}}); return violations.map(v => ({id: v.id, impact: v.impact, nodes: v.nodes.length})); });
}
async function assertNoOverflow(page, width) {
  const size = await page.evaluate(() => ({scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth}));
  assert.ok(size.scroll <= size.client + 1, `${width}px horizontal overflow: ${JSON.stringify(size)}`);
}
function addRecord(rpcFixture, hash, txData) {
  const transaction = {hash, from: payer, to: WIF_TOKEN, input: txData, value: '0x0', blockNumber: '0x64', blockHash: '0x' + 'aa'.repeat(32), transactionIndex: '0x0'};
  const receipt = {transactionHash: hash, status: '0x1', blockNumber: '0x64', blockHash: transaction.blockHash, transactionIndex: '0x0', from: payer, to: WIF_TOKEN, logs: [{address: WIF_TOKEN, topics: [TRANSFER_TOPIC, wordAddress(payer), wordAddress(recipient)], data: '0x' + txData.slice(74)}]};
  rpcFixture.records.set(hash.toLowerCase(), {transaction, receipt});
}

try {
  browser = await chromium.launch({headless: true});
  for (const width of [320, 375, 390, 768, 1280]) {
    const context = await browser.newContext({viewport: {width, height: 900}, reducedMotion: 'reduce'});
    const page = await context.newPage(); page.on('pageerror', error => problems.push(`${width}px page error: ${error.message}`));
    await page.goto(base + '/app/support/', {waitUntil: 'domcontentloaded'}); await page.addScriptTag({path: path.join(here, 'node_modules/axe-core/axe.min.js')});
    assert.deepEqual(await noAxeViolations(page), []); await assertNoOverflow(page, width); assert.equal(await page.locator('#create-support-card').isHidden(), false);
    assert.equal(await page.locator('.support-quick-start a').count(),2,'The first screen must offer clear creator and signed-link paths');
    await page.locator('.support-quick-start a[href="#create-support-card"]').click();
    assert.equal(new URL(page.url()).hash,'#create-support-card','Creator shortcut jumps directly to the form');
    await context.close();
  }

  const missingContext = await browser.newContext({viewport: {width: 390, height: 900}, reducedMotion: 'reduce'}); const missing = await missingContext.newPage();
  await wallet(missing, {missing: true}); await missing.goto(base + '/app/support/', {waitUntil: 'domcontentloaded'}); await missing.locator('#support-amount').fill('1'); await missing.locator('#create-support').click();
  await missing.waitForFunction(() => document.querySelector('#support-feedback').textContent.includes('No EIP-1193 wallet')); await missingContext.close();

  const wrongContext = await browser.newContext({viewport: {width: 390, height: 900}, reducedMotion: 'reduce'}); const wrong = await wrongContext.newPage();
  await wallet(wrong, {mode: 'recipient', chain: '0xb626'}); await wrong.goto(base + '/app/support/', {waitUntil: 'domcontentloaded'}); await wrong.locator('#support-amount').fill('1'); await wrong.locator('#create-support').click();
  await wrong.waitForFunction(() => document.querySelector('#support-feedback').textContent.includes('not connected to Robinhood Chain mainnet')); await wrongContext.close();

  const rejectedContext = await browser.newContext({viewport: {width: 390, height: 900}, reducedMotion: 'reduce'}); const rejected = await rejectedContext.newPage(); const rejectedRpc = routeRPC(rejected);
  await wallet(rejected, {mode: 'recipient', rejectSign: true}); await rejected.goto(base + '/app/support/', {waitUntil: 'domcontentloaded'}); await rejected.locator('#support-amount').fill('1'); await rejected.locator('#create-support').click();
  await rejected.waitForFunction(() => document.querySelector('#support-feedback').textContent.includes('signature was rejected')); assert.equal(await rejected.locator('#share-card').isHidden(), true); assert.equal(await rejected.evaluate(() => window.__walletTransactions.length), 0); await rejectedContext.close();

  const creatorContext = await browser.newContext({viewport: {width: 1280, height: 900}, reducedMotion: 'reduce'}); const creator = await creatorContext.newPage(); routeRPC(creator); await wallet(creator, {mode: 'recipient'});
  await creator.goto(base + '/app/support/', {waitUntil: 'domcontentloaded'}); await creator.locator('#support-amount').fill('1.25'); await creator.locator('#support-interval').selectOption('weekly'); await creator.locator('#create-support').click(); await creator.locator('#share-card').waitFor({state: 'visible'});
  const link = await creator.locator('#support-share-link').inputValue(); assert.match(link, /\/app\/support\/\?offer=/); assert.equal(await creator.evaluate(() => window.__walletTransactions.length), 0); assert.equal(await creator.evaluate(() => window.__typedData.primaryType), 'SupportOffer'); assert.equal(await creator.locator('#support-interval-display').innerText(), 'Weekly suggestion'); await creator.addScriptTag({path: path.join(here, 'node_modules/axe-core/axe.min.js')}); assert.deepEqual(await noAxeViolations(creator), []); await creatorContext.close();

  const linkContext = await browser.newContext({viewport: {width: 390, height: 900}, reducedMotion: 'reduce'}); const linkPage = await linkContext.newPage(); routeRPC(linkPage); await wallet(linkPage);
  await linkPage.goto(base + '/app/support/', {waitUntil: 'domcontentloaded'}); await linkPage.locator('#support-link').fill('https://unrelated.example/app/support/?offer=fake'); await linkPage.locator('#open-support-form button').click(); await linkPage.waitForFunction(() => document.querySelector('#support-feedback').textContent.includes('this website')); assert.equal(await linkPage.evaluate(() => window.__walletTransactions.length), 0);
  await linkPage.locator('#support-link').fill(link); await linkPage.locator('#open-support-form button').click(); await linkPage.waitForURL(url => url.searchParams.has('offer')); await linkPage.locator('#offer-card').waitFor({state: 'visible'}); assert.equal((await linkPage.locator('#support-recipient').innerText()).toLowerCase(), recipient.toLowerCase()); assert.equal(await linkPage.locator('#support-quick-start').isHidden(), true, 'Role choices must not appear on an already signed Support offer'); await assertNoOverflow(linkPage, 390); assert.equal(await linkPage.evaluate(() => window.__walletTransactions.length), 0); await linkContext.close();

  const payerContext = await browser.newContext({viewport: {width: 390, height: 900}, reducedMotion: 'reduce', acceptDownloads: true}); const payerPage = await payerContext.newPage(); const payerRpc = routeRPC(payerPage); await wallet(payerPage);
  await payerPage.goto(link, {waitUntil: 'domcontentloaded'}); await payerPage.locator('#check-support').click(); await payerPage.locator('#check-results').waitFor({state: 'visible'}); assert.equal(await payerPage.locator('#support-now').isDisabled(), false); await payerPage.evaluate(() => { document.querySelector('#support-now').click(); document.querySelector('#support-now').click(); }); await payerPage.waitForFunction(() => window.__beforeSupport?.state.lifecycle === 'verified', null, {timeout: 16000}).catch(async error => {
    const debug = await payerPage.evaluate(() => ({lifecycle: window.__beforeSupport?.state.lifecycle, txHash: window.__beforeSupport?.state.txHash, feedback: document.querySelector('#support-feedback')?.textContent, proofState: document.querySelector('#support-proof-state')?.textContent, nextSuggestion: document.querySelector('#support-next-suggestion')?.textContent, walletCalls: window.__walletTransactions?.length}));
    throw new Error('Support first-cycle verification diagnostic: ' + JSON.stringify(debug) + '; ' + error.message);
  }); const payerSendCount = await payerPage.evaluate(() => window.__walletTransactions.length); assert.equal(payerSendCount, 1, `Repeated support clicks must produce one wallet call; state=${await payerPage.evaluate(() => JSON.stringify({lifecycle: window.__beforeSupport.state.lifecycle, tx: window.__beforeSupport.state.txHash}))}`); assert.equal(await payerPage.locator('#history-list li').count(), 1); assert.match(await payerPage.locator('#support-next-suggestion').innerText(), /Suggested return date:.*BEFORE sends no notifications or automatic payments/i, 'Weekly support must give a truthful return suggestion');
  assert.equal(await payerPage.locator('#support-calendar').isVisible(), true, 'Weekly support offers an optional calendar export only after public proof');
  assert.equal(await payerPage.locator('#support-calendar-note').isVisible(), true, 'Calendar instruction is visible only with a valid reminder');
  const downloadPromise = payerPage.waitForEvent('download'); await payerPage.locator('#support-calendar').click(); const reminderDownload = await downloadPromise;
  assert.match(reminderDownload.suggestedFilename(), /before-wif-support-reminder\.ics/);
  const calendarSource = await readFile(await reminderDownload.path(), 'utf8');
  assert.match(calendarSource, /BEGIN:VCALENDAR/); assert.match(calendarSource.replace(/\r\n /g, ''), /URL:http:\/\/127\.0\.0\.1:.*\/app\/support\/\?offer=/);
  assert.equal(await payerPage.evaluate(() => window.__walletTransactions.length), 1, 'Exporting a reminder must not initiate a WIF transfer'); const firstTx = await payerPage.evaluate(() => window.__walletTransactions[0]); addRecord(payerRpc, hashes[0], firstTx.data);
  // Reload recovery and edited state never unlock a cycle after wallet confirmation begins.
  const reloadContext = await browser.newContext({viewport: {width: 390, height: 900}, reducedMotion: 'reduce'}); const reloadPage = await reloadContext.newPage(); routeRPC(reloadPage); await wallet(reloadPage, {sendDelay: 5000}); await reloadPage.goto(link, {waitUntil: 'domcontentloaded'}); await reloadPage.locator('#check-support').click(); await reloadPage.locator('#check-results').waitFor({state: 'visible'}); await reloadPage.locator('#support-now').click(); await reloadPage.waitForFunction(() => window.__beforeSupport?.state.lifecycle === 'wallet-pending'); assert.match(reloadPage.url(), /status=wallet-pending/); await reloadPage.reload({waitUntil: 'domcontentloaded'}); await reloadPage.waitForFunction(() => window.__beforeSupport?.state.lifecycle === 'uncertain'); assert.match(reloadPage.url(), /status=uncertain/); assert.equal(await reloadPage.locator('#support-now').isVisible(), false); assert.match(await reloadPage.locator('#support-feedback').innerText(), /locked against a duplicate/i); await reloadPage.evaluate(() => document.querySelector('#support-now')?.click()); assert.equal(await reloadPage.evaluate(() => window.__walletTransactions.length), 0); await reloadContext.close();

  const editedContext = await browser.newContext({viewport: {width: 390, height: 900}, reducedMotion: 'reduce'}); const edited = await editedContext.newPage(); routeRPC(edited); await wallet(edited); await edited.goto(link + '&status=verified', {waitUntil: 'domcontentloaded'}); await edited.waitForFunction(() => window.__beforeSupport?.state.lifecycle === 'uncertain'); assert.equal(await edited.locator('#support-now').isVisible(), false); assert.match(await edited.locator('#support-feedback').innerText(), /locked against a duplicate/i); await editedContext.close();

  const eventContext = await browser.newContext({viewport: {width: 390, height: 900}, reducedMotion: 'reduce'}); const eventPage = await eventContext.newPage(); routeRPC(eventPage); await wallet(eventPage, {sendDelay: 5000}); await eventPage.goto(link, {waitUntil: 'domcontentloaded'}); await eventPage.locator('#check-support').click(); await eventPage.locator('#check-results').waitFor({state: 'visible'}); await eventPage.locator('#support-now').click(); await eventPage.waitForFunction(() => window.__beforeSupport?.state.lifecycle === 'wallet-pending'); await eventPage.evaluate(() => window.__emitWalletEvent('accountsChanged', ['0x3333333333333333333333333333333333333333'])); await eventPage.waitForFunction(() => window.__beforeSupport?.state.lifecycle === 'uncertain'); assert.equal(await eventPage.locator('#support-now').isDisabled(), true); assert.equal(await eventPage.evaluate(() => window.__walletTransactions.length), 1); await eventContext.close();

  await payerPage.locator('#support-again').click(); await payerPage.waitForFunction(() => window.__beforeSupport?.state.lifecycle === 'not-submitted'); await payerPage.locator('#check-support').click(); await payerPage.locator('#check-results').waitFor({state: 'visible'}); await payerPage.locator('#support-now').click(); await payerPage.waitForFunction(() => window.__beforeSupport?.state.lifecycle === 'verified'); assert.equal(await payerPage.evaluate(() => window.__walletTransactions.length), 2, 'A deliberate new cycle may request one new wallet confirmation'); const secondTx = await payerPage.evaluate(() => window.__walletTransactions[1]); addRecord(payerRpc, hashes[1], secondTx.data); await payerPage.evaluate(() => window.__beforeSupport.refreshHistory()); await payerPage.waitForFunction(() => document.querySelectorAll('#history-list li').length === 2); await payerContext.close();

  const ambiguousContext = await browser.newContext({viewport: {width: 390, height: 900}, reducedMotion: 'reduce'}); const ambiguous = await ambiguousContext.newPage(); routeRPC(ambiguous); await wallet(ambiguous, {transactionError: {message: 'provider disconnected'}}); await ambiguous.goto(link, {waitUntil: 'domcontentloaded'}); await ambiguous.locator('#check-support').click(); await ambiguous.locator('#check-results').waitFor({state: 'visible'}); await ambiguous.locator('#support-now').click(); await ambiguous.waitForFunction(() => window.__beforeSupport?.state.lifecycle === 'uncertain'); assert.equal(await ambiguous.locator('#support-now').isVisible(), false); assert.match(await ambiguous.locator('#support-feedback').innerText(), /locked against a duplicate/i); await ambiguousContext.close();

  const rpcFailureContext = await browser.newContext({viewport: {width: 390, height: 900}, reducedMotion: 'reduce'}); const rpcFailure = await rpcFailureContext.newPage(); routeRPC(rpcFailure, {failureMethod: 'eth_getBalance'}); await wallet(rpcFailure); await rpcFailure.goto(link, {waitUntil: 'domcontentloaded'}); await rpcFailure.locator('#check-support').click(); await rpcFailure.waitForFunction(() => document.querySelector('#support-feedback').dataset.kind === 'error'); assert.equal(await rpcFailure.evaluate(() => window.__walletTransactions.length), 0, 'RPC failure must not request a wallet transfer'); await rpcFailureContext.close();
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
if (problems.length) throw new Error(problems.join('\n'));
  console.log('Support browser QA passed: 5 responsive/axe views, creator signing, untrusted links, wrong wallet state, duplicate clicks, delayed reload, edited status, pending wallet event, ambiguous wallet response, RPC failure and deliberate repeat cycle.');
