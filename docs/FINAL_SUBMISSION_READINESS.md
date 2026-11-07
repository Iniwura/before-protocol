# BEFORE — combined release and submission readiness

Assessment date: 2026-11-07. Issue #16 candidate branch: `feat/issue-16-before-support`.
**Release status: PENDING exact-head CI and production verification.**
**Hackathon submission status: NOT YET SUBMITTED.** The user's latest authorization covers code integration and production release, but no real-asset transaction has been executed.

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
| Support offer, cycle and repeat-use safety | **PASS locally; exact-head CI pending** | Distinct `SupportOffer` typed data, fresh cycle IDs, explicit “Support again” only after verified proof, device-local receipt revalidation, no automatic cadence. See [Support security gate](BEFORE_SUPPORT_SECURITY_AND_RELEASE.md). |
| Support responsive / wallet adversarial QA | **PASS locally; exact-head CI pending** | 320/375/390/768/1280 responsive + axe, wrong chain, missing wallet, rejected signature, untrusted link, repeated clicks, delayed reload, ambiguous response, RPC failure and deliberate second cycle. |
| Foundry / Node / Anvil / responsive and axe | **PASS on individual PR heads; combined CI pending** | Pay PR #11 at `73735b8`: [CI](https://github.com/Iniwura/before-protocol/actions/runs/42383839833) passed. BTEST audit PR #9 at `67125b7`: [CI](https://github.com/Iniwura/before-protocol/actions/runs/42376037978) passed. Counts must be reported afresh for combined release. |
| Real public WIF payment | **NOT PERFORMED** | Mainnet contract code, symbol and 18 decimals verified read-only; no real WIF transfer, approval, or live receipt has been broadcast by Codex/CI. Mock browser receipts are **not** mainnet evidence. |
| Production deployment | **PENDING** | Do not mark deployed until verified Vercel production alias has the combined release commit and route HTTP checks pass. |
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

The two last scripts require a working public Robinhood testnet RPC. They are **read-only**, never sign transactions. The public acceptance signing runner requires explicitly provisioned local test-only keystores, is not run in CI and must never be run with real assets.

## Hackathon final gate

The previous official event API listed **2026-11-12 17:30 UTC** as the build cutoff, subject to a live portal check. Verify actual eligibility, required fields and media size. Prepare the required demo video with clear actual-source evidence and without showing synthetic data as mainnet WIF. The lack of a real WIF transfer remains a potentially material judging/eligibility gap even with Pay and Support implemented; do not claim otherwise. Support provides a credible repeat-use mechanism, but rule 7 remains unproven until the owner confirms the first and a second deliberate mainnet WIF cycle with public receipts. The final organizer Submit action must be confirmed by an actual platform receipt.
