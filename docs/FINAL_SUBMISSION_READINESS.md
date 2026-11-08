# BEFORE — combined release and submission readiness

Assessment date: 2026-11-08. **Current application release:** `951626c4059004ea7a39ac48230e9c06c0c82fc0`, including [merged PR #22](https://github.com/Iniwura/before-protocol/pull/22). The earlier [f7dd6bf engineering freeze](ENGINEERING_RELEASE_FREEZE_2026-11-08.md) is a historical baseline. The live code now presents Support first, authentic mainnet receipts on the homepage and optional one-time manually imported calendar reminders after verified weekly/monthly contributions. The underlying WIF transfer, signed-intent and onchain proof boundaries remain unchanged.
**Release status: ENGINEERING GO / PRODUCTION READY at `951626c`.** On November 8, Vercel returned READY deployment `dpl_3s3ZrEYh2k3ez3SkfiMyaSzzMigZ` assigned to official `before-web-theta.vercel.app` alias at the exact merged source SHA. Independent read-only HTTP smoke returned **6/6** HTTP 200 routes and both actual mainnet proof links on the live homepage. No new WIF transaction was initiated.
**Hackathon submission status: NOT YET SUBMITTED.** Real WIF acceptance evidence is now public; the demo and final organizer submission remain intentionally unperformed.

## Product scope

BEFORE runs four connected but bounded experiences: noncustodial **BEFORE Pay** (signed WIF payment request → verified preflight → user-confirmed transfer → independently checkable proof), **BEFORE Support** (recipient-authenticated repeat voluntary offers with fresh confirmation per cycle and revalidated device-local receipt history), the **WIF Permission Check** (read-only mainnet allowance inspection), and the **BTEST Bounty Studio/Protect → Challenge → Proof** educational testnet flows. The optional WIF approval revocation remains in separate unmerged PR #7 and is **not** included in this release.

BEFORE Pay uses official $WIF `0x5173b8eA6923c2d40267890D45C46a3480954773`, Robinhood mainnet `4663`. Payment only occurs after the human explicitly approves a standard `transfer` in their wallet. It has no custody, spender allowance, auto-transfer, payment router, new mainnet contract or third-party fee. It does not enforce one-time invoices onchain: a signed request could be paid more than once on another device or outside BEFORE. A real transfer is irreversible and incurs real gas.

## Gates

| Gate | Status | Evidence and limits |
| --- | --- | --- |
| BTEST public network / sponsor-reviewer-researcher lifecycle | **PASS, public testnet 46630 only** | Challenge #7 creation, commitment, appointed-reviewer approval, reveal/settlement, actual token balance and event accounting independently checked. See [public testnet evidence](ISSUE_8_PUBLIC_TESTNET_EVIDENCE.md) and `node qa/issue-8-fresh-bounty-audit.mjs`. Three authorized wallets, one operator; **not** independent human review. |
| Bounty #5 preservation | **PASS, public read-only audit** | Existing expired bounty left under original sponsor account, no unauthorized refund or cancellation; see [Issue #8 evidence](ISSUE_8_PUBLIC_TESTNET_EVIDENCE.md). |
| Pay recipient EIP-712 signature and exact WIF calldata | **PASS in automated tests** | Request-bound address/amount/chain/token/nonce/expiry, fail-closed EOA signature recovery, `transfer` only. |
| Pay duplicate-send and pending receipts | **PASS in mocked wallet/browser regression** | Wallet-pending reload, lost hash, RPC outage, 1–2 confirmations, reverted receipt, edited URL status, wallet/account change, read-only verification retry. One simulated send per attempt. |
| Support offer, cycle and repeat-use safety | **PASS in code and hosted CI** | Distinct `SupportOffer` typed data, fresh cycle IDs, explicit “Support again” only after verified proof, device-local receipt revalidation, no automatic cadence. PR #22 adds opt-in one-time `.ics` export after a verified weekly/monthly receipt, without backend notifications, automatic payment or wallet calls. See [Support security gate](BEFORE_SUPPORT_SECURITY_AND_RELEASE.md). |
| Support responsive / wallet adversarial QA | **PASS in hosted CI and live-route acceptance** | 320/375/390/768/1280 responsive + axe, wrong chain, missing wallet, rejected signature, untrusted link, repeated clicks, delayed reload, ambiguous response, RPC failure, deliberate second cycle, and production Support preflight. |
| Foundry / Node / Anvil / responsive and axe | **PASS on merged PR #22 code head** | [CI run 42493477032](https://github.com/Iniwura/before-protocol/actions/runs/42493477032): `test` and `browser-quality` both succeeded at `71325511b89e4723e2a082d99f7ea4cd21b75c14`, including updated landing navigation, calendar export, viewport/axe, signed-offer navigation and full existing wallet/contract regression. Production merge at `951626c` contains the same application sources. Subsequent documentation-only verification commits require their own exact-head CI pass. |
| Real public WIF payment | **PASS for Issue #18 acceptance** | Two distinct production Support transfers of exactly 200 WIF each were independently verified on Robinhood Chain mainnet. See [Issue #18 mainnet evidence](ISSUE_18_MAINNET_SUPPORT_EVIDENCE.md). The signer was an automated local wallet acceptance harness, not a human-extension click claim. |
| Production deployment | **PASS at merged release** | Vercel READY deployment `dpl_3s3ZrEYh2k3ez3SkfiMyaSzzMigZ`, official alias pointing to `951626c`. Fresh public HTTP checks: home, Pay, Support, WIF, Bounty and Proof all 200. Home carries exactly two genuine WIF mainnet receipt links; Support displays first-screen creator/link shortcuts and optional calendar button. Original independent Chromium smoke and current hosted Playwright runs passed. |
| Demo video and organizer submission | **PENDING** | No video has been created or uploaded. Registration is **not** a final submission. Confirm actual portal fields and deadline against organizers. |

## Public BTEST evidence (challenge 7)

- [Create](https://explorer.testnet.chain.robinhood.com/tx/0x5b54ab0f8db383cde66ff40a59ab7b926090d17f1854183a88ca2486b288a9a1)
- [Researcher commitment](https://explorer.testnet.chain.robinhood.com/tx/0x4a00d1d9133670b738571823ee9e93d0dc861f938fcf832c1cbe121a4ab0ddd3)
- [Reviewer approval](https://explorer.testnet.chain.robinhood.com/tx/0x7682cbf90feac893c20cae875d4c1b8b216eae8a4faca813c2f31b505fab6bec)
- [Final settlement](https://explorer.testnet.chain.robinhood.com/tx/0x17ecb3839f4c249fa1ca7c0283a191675d6f38256a498afda83059ec21750f5c)

These are genuine public testnet BTEST transactions. They do not prove live WIF usage. The separate historical synthetic-coordinator lifecycle is described honestly in the public evidence document.

## Reproduction

```sh
forge build --no-cache
forge test --fuzz-runs 1024
node --test checks/reference.test.mjs checks/deployment-proof.test.mjs checks/deployment-cli.test.mjs checks/broadcast-args.test.mjs web/test/core.test.mjs web/test/onchain.test.mjs web/test/pay-core.test.mjs web/test/support-core.test.mjs web/test/bounty-core.test.mjs web/test/wif-core.test.mjs
node script/anvil-e2e.mjs
node script/run-bounty-lifecycle.mjs --local
node qa/verify.mjs
node qa/pay-e2e.mjs
node qa/support-e2e.mjs
node qa/bounty-e2e.mjs
node qa/wif-verify.mjs
node qa/issue-8-public-testnet-audit.mjs
node qa/issue-8-fresh-bounty-audit.mjs
```

The two last scripts require a working public Robinhood testnet RPC. They are **read-only**, never sign transactions. The public acceptance signing runner requires explicitly provisioned local keystores, is not run in CI, and must never be run outside an owner-authorized bounded budget.

## Hackathon final gate

The official public event API and announcement on November 8 list **2026-11-12 17:30 UTC** as the submission deadline; the logged-in portal's required fields still need confirmation. Verify actual eligibility, required fields and media size. Prepare the required demo video with clear actual-source evidence and without showing synthetic data as mainnet WIF. Rule 3 now has two public mainnet Support receipts; rule 7 has repeat-capable movement evidence but not proof of organic retention. The two cycles were executed through the production Support route with automated local wallet acceptance; the second used a fresh signed offer after the first browser proof wait timed out and was recovered read-only. The final organizer Submit action must be confirmed by an actual platform receipt. **Public listing not verified:** BEFORE was absent from 31 public projects returned by the organizer's directory at audit time, which could mean the entry is unpublished, draft or not approved. Owner registration alone cannot substitute for an approved entry. This remains a submission step, not an engineering-build defect.
