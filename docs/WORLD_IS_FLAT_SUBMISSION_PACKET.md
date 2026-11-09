# BEFORE — World Is Flat submission package

Prepared: November 8, 2026. **Not yet submitted.** The engineering build is [frozen and documented](ENGINEERING_RELEASE_FREEZE_2026-11-08.md); mainnet WIF Support evidence is public and independently checked. The demo video, signed-in organizer entry/approval, final portal fields and final submission are still pending.

## Ready-to-paste submission answers

**Project:** BEFORE

**Tagline:** Know who you're paying. Verify what you're sending. Prove what happened.

**One-line description:** BEFORE lets people request $WIF with a signed intent, verify the exact payment before approving it, and independently check its onchain receipt on Robinhood Chain.

**Problem:** Token payments ask users to trust addresses, amounts and screenshots. An ERC-20 transfer is irreversible, and a receipt screenshot alone can be misleading. People need a simple way to know who requested a payment, what a wallet will do, and what the chain actually confirms.

**Solution / what we built:**

BEFORE brings three focused experiences together:

1. **BEFORE Pay (Robinhood Chain mainnet, chain 4663).** A recipient signs an EIP-712 request bound to their address, the official WIF token, chain ID, exact integer amount, expiration and random nonce. The payer opens a shareable link; BEFORE verifies the signature against the recipient, inspects the official token contract and recipient bytecode, checks wallet balance and gas, and only then offers a human-confirmed ERC-20 `transfer`. A public proof independently checks calldata, transaction and receipt identity, confirmations, and the official WIF `Transfer` event.
2. **BEFORE Support (Robinhood Chain mainnet, 4663).** A creator signs a stable `SupportOffer` binding the official WIF, exact recipient and amount, bounded expiry, reminder cadence and campaign ID. A supporter checks the offer and confirms each exact ERC-20 transfer in their wallet. Verified receipts are revalidated on public RPC, and a new cycle requires a fresh wallet confirmation; supporters can optionally export a single calendar event after verified proof. They must import it themselves. BEFORE sends no notifications, and cadence is never a subscription or automatic payment.
3. **Public WIF transfer history (mainnet, read-only).** Look up prior WIF receipts sent directly to any recipient address, across devices, via public WIF Transfer logs and revalidated exact transaction/receipt proof. Each initial lookup covers two million blocks; older windows are on demand. The history is **not** evidence that all transfers were initiated through BEFORE or belong to a specific signed campaign (ERC-20 transfers carry no campaign ID).
4. **WIF Permission Check (mainnet, read-only).** Examine an identified wallet/spender approval at a consistent public block, including spendable allowance relative to balance and evidence of the original approval. The checker is read-only. The optional revocation code in PR #7 is deliberately not in this production release.
5. **Bounty Studio plus Protect → Challenge → Proof (Robinhood Chain testnet, 46630).** A sponsor funds valueless BTEST, a researcher commits a finding and bond, the appointed reviewer approves the exact evidence, and the researcher reveals to settle under the escrow rules. The training vault demonstrates why a per-transfer spending cap does not replace an aggregate daily cap; the protected vault enforces both.

The web product is noncustodial, uses pinned chain/token identities, and fails closed when proofs or wallet state cannot be validated. We deliberately don't ask a contract to custody live WIF. The payment action is only `transfer(recipient, amount)` to the official token after explicit user confirmation. This keeps the onchain action understandable.

**What is independently verifiable today:**

The public BTEST Challenge #7 on Robinhood Chain testnet completed sponsor creation, researcher commitment, appointed reviewer approval and settlement using three owner-authorized accounts. We verified their transaction receipts, events, contract bytecode, quorum and token accounting with a read-only independent audit. These are real testnet transactions controlled by one operator, **not independent human reviews**.

BEFORE Pay and Support's EIP-712, exact calldata, delayed-receipt, duplicate-send lock, reverted-receipt handling, reload recovery, signature and browser cases pass automated tests. On November 8, two exact 200-WIF contributions were initiated through the deployed Support route with an automated local EIP-1193 wallet harness and independently verified from public mainnet receipts. This is automated wallet acceptance, not a human-extension click claim; no private material was published. See [Issue #18 mainnet evidence](ISSUE_18_MAINNET_SUPPORT_EVIDENCE.md).

**Technology:** Solidity/Foundry, vanilla JavaScript ES modules, static HTML/CSS, Node.js, EIP-1193 browser wallets, EIP-712 signed typed data, ERC-20 ABI calls/events, Robinhood Chain mainnet (4663), Robinhood Chain Testnet (46630), Anvil, Playwright, axe-core, GitHub Actions and Vercel. No backend service or proprietary server signer in the payment flow.

**Why BEFORE is useful today:** A creator can ask for voluntary WIF support with a signed offer, let each supporter verify the exact transfer before signing, and show a public receipt that anyone can check. A recipient can also sign a one-off WIF request without custody or allowance. The payer can verify the signed intent before approving an exact ERC-20 transfer, and anyone can independently verify the receipt. Support adds a concrete return loop: the same creator/community page, a device-local next-support date suggestion, an optional one-time calendar export manually imported by the supporter, revalidated device-local receipts and an explicit new cycle that requires a fresh wallet confirmation. BEFORE itself sends no notifications and never schedules a payment. The two public receipts demonstrate repeat-capable movement; they do not prove organic retention, global accounting or a subscription.

**Security limits:** ERC-20 transfer requests are not onchain single-use invoices. Anyone can pay the same signed request again from another device or wallet. BEFORE's client locks an attempted payment during wallet uncertainty, receipts or reloads, but cannot enforce global uniqueness. Real mainnet WIF payments cost real gas and cannot be reversed. Contract tests and automated browser QA are not an independent external security audit.

## Primary links for submission

- Live product: https://before-web-theta.vercel.app/
- WIF Pay: https://before-web-theta.vercel.app/app/pay/
- WIF Support: https://before-web-theta.vercel.app/app/support/
- WIF Permission Check: https://before-web-theta.vercel.app/app/wif/
- Testnet Bounty Studio: https://before-web-theta.vercel.app/app/bounty/
- Protect/Challenge/Proof: https://before-web-theta.vercel.app/app/
- Public source: https://github.com/Iniwura/before-protocol
- Pay security scope: https://github.com/Iniwura/before-protocol/blob/main/docs/WIF_PAY_SECURITY_AND_RELEASE.md
- Independent public-testnet audit: https://github.com/Iniwura/before-protocol/blob/main/docs/ISSUE_8_PUBLIC_TESTNET_EVIDENCE.md
- Exact evidence-head CI: https://github.com/Iniwura/before-protocol/actions/runs/42437341845 (`test` and `browser-quality` passed)
- Vercel production merge commit: https://github.com/Iniwura/before-protocol/commit/58a6622c0a420a27872c3a77071915ad19d38fa4
- Real mainnet Support evidence: https://github.com/Iniwura/before-protocol/blob/main/docs/ISSUE_18_MAINNET_SUPPORT_EVIDENCE.md

### Public BTEST Challenge #7 receipts

- Sponsor create: https://explorer.testnet.chain.robinhood.com/tx/0x5b54ab0f8db383cde66ff40a59ab7b926090d17f1854183a88ca2486b288a9a1
- Researcher commitment: https://explorer.testnet.chain.robinhood.com/tx/0x4a00d1d9133670b738571823ee9e93d0dc861f938fcf832c1cbe121a4ab0ddd3
- Appointed reviewer approval: https://explorer.testnet.chain.robinhood.com/tx/0x7682cbf90feac893c20cae875d4c1b8b216eae8a4faca813c2f31b505fab6bec
- Reveal and settlement: https://explorer.testnet.chain.robinhood.com/tx/0x17ecb3839f4c249fa1ca7c0283a191675d6f38256a498afda83059ec21750f5c

### Public WIF Support receipts — Robinhood Chain mainnet

- First 200 WIF contribution: https://robinhoodchain.blockscout.com/tx/0x4f6b1b2d48f73643408418896a7de886be4a522bf583a1c3d1d9c104c3b42476
- Second 200 WIF contribution: https://robinhoodchain.blockscout.com/tx/0x7e5ca115c13fed7e36109478c9f454adc81c58c2c114f569624d95792f64033a

Both receipts independently match the payer, creator, official WIF contract, exact zero-value `transfer(creator, 200 WIF)` calldata, successful status, three-plus confirmations and one matching `Transfer` event. The first browser proof wait timed out after broadcast and was recovered read-only without retry; the second used a fresh signed offer/cycle. This is evidence of two intentional cycles, not retention proof.

## Final live-walkthrough demo — 110–130 seconds, 1080p

**Primary story:** A creator asks for WIF. A supporter can verify exactly who gets it and what amount will move. BEFORE makes the receipt independently checkable. Real transfers show the utility exists, while a voluntary return loop makes the page useful again. Lead with **BEFORE Support**; do not make a testnet research bounty the center of a WIF hackathon demo.

The earlier private 95-second review video used screenshot transitions; the **final demo must instead show a continuous, real browser walkthrough** with visible pointer actions and app states. Reference: [Seldra Official Demo](https://youtu.be/tP01iL8W8NI). Creator signing may use a controlled demo wallet and off-chain EIP-712 signature, but must be visibly disclosed **DEMO WALLET · NO WIF SENT**. Do not copy the reference video. Use the newly integrated in-app public WIF history (real RPC) and actual Blockscout receipts; no new mainnet transaction is necessary. Check organizer video duration rules.

| Time | Real screen / evidence | What judges should understand |
| --- | --- | --- |
| 0–10s | Before landing → Support page; clear title | “A payment screenshot is not proof. BEFORE makes $WIF requests, transfers and receipts verifiable.” |
| 10–32s | Creator prepares/signs the Support offer; show exact recipient, amount, token, chain and offer expiration | The creator's EIP-712 signature establishes a checkable payment request; signing an offer moves no tokens |
| 32–52s | Supporter opens the shared offer, checks recipient/amount and gas preflight | BEFORE verifies the request against real mainnet WIF rather than trusting a pasted address |
| 52–76s | In the **live app**, select Public WIF transfers, enter the real creator's receiving address and load both previous 200-WIF receipts; click through to genuine Blockscout evidence, without treating unrelated transfers as BEFORE campaign activity | **Genuine mainnet proof:** transaction hashes `0x4f6b…2476` and `0x7e5c…033a`. The first browser proof wait timed out and was recovered read-only; the second used a **fresh signed offer**. Do **not** claim original-button “Support again” was live-exercised with the same signed offer |
| 76–97s | Show the verified-proof panel, optional one-time calendar file, and deliberate “Support again” button in a **clearly labeled simulated wallet** session | Users can import their own calendar reminder, revisit the same signed offer, and confirm each new contribution separately. There is no automatic payment, subscription or BEFORE notification. **SIMULATED WALLET / NO NEW REAL WIF SENT** whenever wallet-send or receipt activity is mocked |
| 97–109s | One-off Pay request + permission checker, quick cuts | A recipient can issue a one-off signed request; a WIF holder can inspect allowance read-only, with no claim that one-off Pay received a separate live mainnet acceptance |
| 109–123s | GitHub PR/green CI + production site + full explorer hashes | Code and evidence can be independently inspected. Close: “Know who you're paying. Verify what you're sending. Prove what happened.” |

**Demo failure modes to avoid:** No fake customer retention, no false human-wallet extension claims, no presenting the BTEST testnet as real WIF usage, no secret wallet keys, no adding a third live transaction, no screenshots that hide the network and official token. Record actual cursor-driven browser interaction, not a slideshow. If a wallet is simulated, disclose that persistently; never claim a simulated confirmation caused the earlier real transaction. A short BTEST clip can be an optional appendix, not part of the primary product story.

**Video production guardrails:** No fake mainnet WIF receipt, staged 'independent researcher' endorsement, secret wallet material, private key, speculative return, copyrighted music or invented transaction. Use ordinary screen recording and natural narration. Any mocked wallet testing must remain conspicuously labeled.

## Final submission QA checklist

- [x] Real live production site deployed on the approved public URL
- [x] Public GitHub repo, merged Support-first source `951626c`, latest exact-head combined CI and confirmed READY production alias
- [x] Public BTEST testnet receipt and accounting evidence
- [x] Mainnet WIF token code/metadata and read-only checks
- [x] WIF Pay code and adversarial simulated-wallet QA
- [x] BEFORE Support code, distinct typed offer, repeat-cycle lock, optional user-imported calendar export and adversarial simulated-wallet QA
- [x] Independent live-route browser smoke test against production Support, including creator signing, payer preflight and exact transfer request
- [x] Independently inspectable real $WIF onchain transfer through BEFORE Support on Robinhood Chain mainnet 4663, with matching WIF Transfer logs and two public receipts. See `ISSUE_18_MAINNET_SUPPORT_EVIDENCE.md`.
- [ ] 1080p video showing product functioning and honest mainnet/testnet distinction; upload to an organizer-accepted publicly accessible destination
- [x] Public mainnet evidence of the first Support contribution and a second deliberate new cycle. The two receipts prove repeat capability, not organic retention; the signer was an automated local acceptance harness. See [Support security gate](BEFORE_SUPPORT_SECURITY_AND_RELEASE.md).
- [x] Official closing date from organizer rules: November 12, 2026, 17:30 UTC; round one ends November 14, final ends November 16 at 17:30 UTC
- [ ] Keep live production accessible through November 16 final; basic availability monitoring set up
- [ ] Confirm BEFORE's signed-in project entry, publication/approval status, required submission fields, allowed categories and video duration (not yet visible among 31 public entries on November 8)
- [ ] Choose suitable categories: Consumer & Payments, Tools & Infra; consider Onboarding only if the resulting workflow is demonstrably novice-friendly
- [ ] Add accessible video URL, final description, team information and category to organizer form
- [ ] Submit and preserve actual organizer confirmation/receipt

No one should treat registration or a merge/deploy as a completed submission. As of this document, no project submission has been confirmed.
