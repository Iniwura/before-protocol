# BEFORE — final engineering release freeze

**Signed off:** November 8, 2026.  
**Application source baseline:** `f7dd6bf1bf273846fd35705c851312f534625dbe`. Later documentation-only commits do not modify the application.  
**Engineering decision:** **GO / FEATURE FROZEN**. No known confirmed P0 product, contract, source, CI or production-route defect remains in the tested release. This is a hackathon prototype release, **not** a formal independent security audit or a claim of zero possible defects.  
**Demo:** NOT STARTED. **Organizer project entry / final submission:** NOT VERIFIED / NOT SUBMITTED. Those are separate steps in [Issue #14](https://github.com/Iniwura/before-protocol/issues/14).

## Released product boundaries

| Component | Actual released functionality | Proof and limits |
| --- | --- | --- |
| [BEFORE Pay](https://before-web-theta.vercel.app/app/pay/) | Signed EIP-712 one-off WIF payment request, exact payer preflight, explicit ERC-20 transfer, read-only three-confirmation receipt proof | Pure/Playwright mock-wallet acceptance and CI pass; **no separate real one-off Pay transfer recorded**; client locks are not onchain one-time settlement |
| [BEFORE Support](https://before-web-theta.vercel.app/app/support/) | Recipient-authenticated reusable offer, voluntary contribution, new explicit wallet confirmation each time, device-local receipt history, read-only retry | Two **real mainnet WIF payments** using the production Support route and an automated local EIP-1193 signer. The second used a **new signed offer**, not the original same-offer Support-again interaction. That interaction was tested using a mock wallet and two verified mock receipts, not genuine long-term retention |
| [WIF Permission Check](https://before-web-theta.vercel.app/app/wif/) | Read-only Robinhood mainnet allowance / balance checks against one named owner and spender | No signature, revocation or transfer; optional PR #7 is **excluded** |
| [Bounty Studio](https://before-web-theta.vercel.app/app/bounty/) | BTEST testnet sponsor → researcher → appointed reviewer → settlement | Public challenge #7 receipts and local Anvil E2E. Three separate test wallets were one operator, not independent humans |
| [Protect / Challenge / Proof](https://before-web-theta.vercel.app/app/) | Testnet-only protected vault, intentionally vulnerable practice path and evidence inspection | No live mainnet WIF policy vault, no real-WIF bounty, no independent audit |

## Release test evidence

- [GitHub Actions run 42475822845](https://github.com/Iniwura/before-protocol/actions/runs/42475822845): `test` and `browser-quality` **both successful**, including Foundry build and 1024 fuzz runs, Anvil deployment/settlement checks, Node unit/security tests, Playwright Pay/Support/Bounty/WIF regression, accessibility and responsive cases, JS syntax and error-path tests.
- Independent fresh public Chromium smoke: **seven route/viewport combinations** all HTTP 200, no page/console errors and no horizontal overflow: home 1280, Support 1280/390, Pay 390, WIF 390, Bounty 390, Proof 390. Browser smoke is not proof of an independent wallet usability study.
- Separately rerun pure Pay, Support, WIF and policy logic: **36/36 passed**. A standalone scratch-environment invocation of other tests required prebuilt Foundry `out/` artifacts and was incomplete until the proper build order; the official Actions job compiled first and passed.
- Vercel production: deployment `dpl_HFkCnZ91CSGHRanYPKEkVYqK484J` reported **READY** and official `before-web-theta.vercel.app` alias pointed at the source baseline. Verify current alias after any subsequent docs-only merge.

## Mainnet WIF independently checked

**Robinhood Chain mainnet:** chain ID **4663**. Official WIF ERC-20: `0x5173b8eA6923c2d40267890D45C46a3480954773`, 18 decimals.

- [Support contribution 1](https://robinhoodchain.blockscout.com/tx/0x4f6b1b2d48f73643408418896a7de886be4a522bf583a1c3d1d9c104c3b42476): receipt successful, payer nonce 0, 200 WIF sent.
- [Support contribution 2](https://robinhoodchain.blockscout.com/tx/0x7e5ca115c13fed7e36109478c9f454adc81c58c2c114f569624d95792f64033a): receipt successful, payer nonce 1, 200 WIF sent.
- Separate official mainnet RPC verification checked `eth_chainId`, token decimals, `eth_getTransactionByHash`, `eth_getTransactionReceipt`, sender, recipient, exact `0xa9059cbb` calldata, ERC-20 `Transfer` topics and exact raw amount. Combined creator balance read was 400 WIF on the audited block. Full acceptance limitations are in [Issue #18 evidence](ISSUE_18_MAINNET_SUPPORT_EVIDENCE.md).

**Robinhood testnet:** chain ID **46630**. Read-only public RPC independently confirmed successful real testnet Challenge #7 [create](https://explorer.testnet.chain.robinhood.com/tx/0x5b54ab0f8db383cde66ff40a59ab7b926090d17f1854183a88ca2486b288a9a1), [commit](https://explorer.testnet.chain.robinhood.com/tx/0x4a00d1d9133670b738571823ee9e93d0dc861f938fcf832c1cbe121a4ab0ddd3), [approval](https://explorer.testnet.chain.robinhood.com/tx/0x7682cbf90feac893c20cae875d4c1b8b216eae8a4faca813c2f31b505fab6bec) and [settlement](https://explorer.testnet.chain.robinhood.com/tx/0x17ecb3839f4c249fa1ca7c0283a191675d6f38256a498afda83059ec21750f5c).

## Explicit limitations / no more build scope

- No real one-off Pay mainnet acceptance, independently observed human wallet-extension UX, or organic multi-day Support retention. The same-offer Support-again button is verified in automated mock-browser QA, not the two actual transfers.
- Long-lived Support offers cannot be revoked early. Cadence means local date suggestion only; **no subscription, push notification, automatic payment or global campaign ledger**.
- All payment protections are client-side transaction-intent preflight and proof, not an onchain single-use invoice or mainnet user-custody spending-policy vault. Security training and bounty contracts are **BTEST-only on testnet**.
- Optional revocation PR #7 and older fork-audit PR #6 are outside the frozen product. Do not cherry-pick, merge or ship them merely for optics.
- No additional real-WIF signing, transfers, approvals, staking, extra contracts or UI redesign is needed. If a genuine production defect is discovered, re-open the release gate, make a minimal reviewed patch and repeat exact-head CI.

## Remaining steps are NOT engineering build tasks

1. Confirm project is present in the **authenticated** [World Is Flat submission dashboard](https://worldisflat.fun/build) and is actually accepted/published; as of the November 8 public directory check, BEFORE did **not** appear among 31 public entries. An unpublished draft or approval queue is possible.
2. Record and review the **genuine** demonstration under [current submission packet](WORLD_IS_FLAT_SUBMISSION_PACKET.md). Don't falsely present mock wallet actions, or the fresh second offer, as a live same-offer repeat.
3. Enter accurate team/category/repo/product/video fields and submit before the organizer's **November 12, 2026 at 17:30 UTC** deadline, then preserve its acknowledgment.
4. Keep the site online through the **November 16 final**. Community WIF voting burns tokens; pursue voluntary genuine participation only.

**Final ownership:** Release is frozen and documented here. [Issue #14](https://github.com/Iniwura/before-protocol/issues/14) tracks the separate submission workflow; it must not be closed on engineering evidence alone.
