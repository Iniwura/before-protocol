# BEFORE — World Is Flat submission package

Prepared: November 7, 2026. **Not yet submitted.** The most recent verified live site release was PR #15 at main commit `0c97e38a5eba75f0358e333d797c494a96871df9`, Vercel deployment `dpl_oZhM4KEhBkm7K9cVUrkQPxvHWH3Q`. The official hackathon rules supplied by the owner now establish two unresolved mandatory gates: real WIF onchain use and an actual repeat-use WIF flywheel.

## Ready-to-paste submission answers

**Project:** BEFORE

**Tagline:** Know what you're paying. Prove what happened.

**One-line description:** BEFORE lets people request $WIF with a signed intent, verify the exact payment before approving it, and independently check its onchain receipt on Robinhood Chain.

**Problem:** Token payments ask users to trust addresses, amounts and screenshots. An ERC-20 transfer is irreversible, and a receipt screenshot alone can be misleading. People need a simple way to know who requested a payment, what a wallet will do, and what the chain actually confirms.

**Solution / what we built:**

BEFORE brings three focused experiences together:

1. **BEFORE Pay (Robinhood Chain mainnet, chain 4663).** A recipient signs an EIP-712 request bound to their address, the official WIF token, chain ID, exact integer amount, expiration and random nonce. The payer opens a shareable link; BEFORE verifies the signature against the recipient, inspects the official token contract and recipient bytecode, checks wallet balance and gas, and only then offers a human-confirmed ERC-20 `transfer`. A public proof independently checks calldata, transaction and receipt identity, confirmations, and the official WIF `Transfer` event.
2. **WIF Permission Check (mainnet, read-only).** Examine an identified wallet/spender approval at a consistent public block, including spendable allowance relative to balance and evidence of the original approval. The checker is read-only. The optional revocation code in PR #7 is deliberately not in this production release.
3. **Bounty Studio plus Protect → Challenge → Proof (Robinhood Chain testnet, 46630).** A sponsor funds valueless BTEST, a researcher commits a finding and bond, the appointed reviewer approves the exact evidence, and the researcher reveals to settle under the escrow rules. The training vault demonstrates why a per-transfer spending cap does not replace an aggregate daily cap; the protected vault enforces both.

The web product is noncustodial, uses pinned chain/token identities, and fails closed when proofs or wallet state cannot be validated. We deliberately don't ask a contract to custody live WIF. The payment action is only `transfer(recipient, amount)` to the official token after explicit user confirmation. This keeps the onchain action understandable.

**What is independently verifiable today:**

The public BTEST Challenge #7 on Robinhood Chain testnet completed sponsor creation, researcher commitment, appointed reviewer approval and settlement using three owner-authorized accounts. We verified their transaction receipts, events, contract bytecode, quorum and token accounting with a read-only independent audit. These are real testnet transactions controlled by one operator, **not independent human reviews**.

BEFORE Pay's EIP-712, exact calldata, delayed-receipt, duplicate-send lock, reverted-receipt handling, reload recovery, signature and browser cases pass automated tests. The mainnet WIF contract, chain identity and metadata were also verified read-only. **No real WIF transfer has been broadcast through BEFORE Pay yet.** Mocked browser payment results must not be presented as public mainnet receipts.

**Technology:** Solidity/Foundry, vanilla JavaScript ES modules, static HTML/CSS, Node.js, EIP-1193 browser wallets, EIP-712 signed typed data, ERC-20 ABI calls/events, Robinhood Chain mainnet (4663), Robinhood Chain Testnet (46630), Anvil, Playwright, axe-core, GitHub Actions and Vercel. No backend service or proprietary server signer in the payment flow.

**Why BEFORE is useful today:** A recipient can sign a one-off WIF request or a stable voluntary Support offer without custody or allowance. The payer can verify the signed intent before approving an exact ERC-20 transfer, and anyone can independently verify the receipt. Support adds a concrete return loop: the same creator/community page, a labeled cadence reminder, revalidated device-local receipts and an explicit new cycle that requires a fresh wallet confirmation. It is a credible repeat-use mechanism, but it is not a subscription, global ledger or proven long-term retention loop until owner-confirmed mainnet receipts exist.

**Security limits:** ERC-20 transfer requests are not onchain single-use invoices. Anyone can pay the same signed request again from another device or wallet. BEFORE's client locks an attempted payment during wallet uncertainty, receipts or reloads, but cannot enforce global uniqueness. Real mainnet WIF payments cost real gas and cannot be reversed. Contract tests and automated browser QA are not an independent external security audit.

## Primary links for submission

- Live product: https://before-web-theta.vercel.app/
- WIF Pay: https://before-web-theta.vercel.app/app/pay/
- WIF Permission Check: https://before-web-theta.vercel.app/app/wif/
- Testnet Bounty Studio: https://before-web-theta.vercel.app/app/bounty/
- Protect/Challenge/Proof: https://before-web-theta.vercel.app/app/
- Public source: https://github.com/Iniwura/before-protocol
- Pay security scope: https://github.com/Iniwura/before-protocol/blob/main/docs/WIF_PAY_SECURITY_AND_RELEASE.md
- Independent public-testnet audit: https://github.com/Iniwura/before-protocol/blob/main/docs/ISSUE_8_PUBLIC_TESTNET_EVIDENCE.md
- Combined release CI: https://github.com/Iniwura/before-protocol/actions/runs/42384762055
- Vercel production commit: https://github.com/Iniwura/before-protocol/commit/e78fb17d9440633794d78e799846e10ce9cfdc11

### Public BTEST Challenge #7 receipts

- Sponsor create: https://explorer.testnet.chain.robinhood.com/tx/0x5b54ab0f8db383cde66ff40a59ab7b926090d17f1854183a88ca2486b288a9a1
- Researcher commitment: https://explorer.testnet.chain.robinhood.com/tx/0x4a00d1d9133670b738571823ee9e93d0dc861f938fcf832c1cbe121a4ab0ddd3
- Appointed reviewer approval: https://explorer.testnet.chain.robinhood.com/tx/0x7682cbf90feac893c20cae875d4c1b8b216eae8a4faca813c2f31b505fab6bec
- Reveal and settlement: https://explorer.testnet.chain.robinhood.com/tx/0x17ecb3839f4c249fa1ca7c0283a191675d6f38256a498afda83059ec21750f5c

## Suggested demo: 110–130 seconds, 1080p

This is a storyboard for an **actual screen recording**, not a claim that a finished video exists. If the organizer specifies a different maximum length, cut accordingly. Keep the product visible, text readable, and true network/transaction labels on screen.

| Time | Screen | Narration / action |
| --- | --- | --- |
| 0–12s | Production landing → BEFORE Pay | “Before sending WIF, you should know who requested it, what your wallet will do, and how to prove the outcome.” |
| 12–35s | Recipient creates EIP-712 signed request | Show recipient, amount, expiry and wallet's typed-data signature. Explain signing a request moves no tokens. If wallet is mocked, overlay **SIMULATED WALLET · NO REAL WIF SENT**. |
| 35–58s | Payer opens request / independent preflight | Show exact WIF contract, chain 4663, verified recipient, balances and confirmation action. Never click a live spend unless explicitly funded and intended. If mocking send, overlay the simulation disclosure throughout. |
| 58–72s | Receipt verification and failure handling | Show public-proof verification UI. An example mocked receipt is not public mainnet evidence. Explain pending/reload locks and user-controlled signing. |
| 72–103s | Genuine BTEST public challenge #7 | Open public explorer receipts and show create → commit → review → settlement. Clearly label **PUBLIC ROBINHOOD TESTNET · BTEST**, with distinct onchain roles controlled by one operator. |
| 103–122s | Source, tests and close | Show GitHub Actions green, before-protocol repo and production URL. “The same principle across payments and research: verify the intent, enforce the rules, prove the outcome.” |

**Video production guardrails:** No fake mainnet WIF receipt, staged 'independent researcher' endorsement, secret wallet material, private key, speculative return, copyrighted music or invented transaction. Use ordinary screen recording and natural narration. Any mocked wallet testing must remain conspicuously labeled.

## Final submission QA checklist

- [x] Real live production site deployed on the approved public URL
- [x] Public GitHub repo, release commit and exact-head combined CI
- [x] Public BTEST testnet receipt and accounting evidence
- [x] Mainnet WIF token code/metadata and read-only checks
- [x] WIF Pay code and adversarial simulated-wallet QA
- [x] BEFORE Support code, distinct typed offer, repeat-cycle lock and adversarial simulated-wallet QA
- [ ] Independent live-route browser smoke test against production (Vercel confirms deployment and domain alias, but external browser HTTP check not yet completed)
- [ ] **Mandatory:** independently inspectable real $WIF onchain transfer through BEFORE Pay on Robinhood Chain mainnet 4663, with matching WIF Transfer log and wallet-confirmed transaction. No such transaction has been verified yet. Never substitute BTEST testnet receipts.
- [ ] 1080p video showing product functioning and honest mainnet/testnet distinction; upload to an organizer-accepted publicly accessible destination
- [ ] **Mandatory:** owner-confirmed public mainnet evidence of the first Support contribution and a second deliberate new cycle. The code path is implemented and tested, but repeat-use WIF behavior is not yet proven. See [Support security gate](BEFORE_SUPPORT_SECURITY_AND_RELEASE.md).
- [x] Official closing date from organizer rules: November 12, 2026, 17:30 UTC; round one ends November 14, final ends November 16 at 17:30 UTC
- [ ] Keep live production accessible through November 16 final; basic availability monitoring set up
- [ ] Confirm signed-in submission fields, allowed categories and video duration
- [ ] Choose suitable categories: Consumer & Payments, Tools & Infra; consider Onboarding only if the resulting workflow is demonstrably novice-friendly
- [ ] Add accessible video URL, final description, team information and category to organizer form
- [ ] Submit and preserve actual organizer confirmation/receipt

No one should treat registration or a merge/deploy as a completed submission. As of this document, no project submission has been confirmed.
