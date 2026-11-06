# BEFORE — World Is Flat requirements and evidence audit

**Checked:** 6 November 2026  
**Official rules:** https://worldisflat.fun/build/rules  
**Official live event data:** https://worldisflat.fun/build/api/event  
**Project:** https://before-web-theta.vercel.app/  
**Source:** https://github.com/Iniwura/before-protocol  
**Engineering release:** `4221851c897c81a70168f76c3b13c1dda1511ada`

## Deadline

The organizer's live event announcement states:

- **Submissions close 12 November 2026, 17:30 UTC**.
- First round **12–14 November 2026**.
- Final **14–16 November 2026**.
- Dates may be extended by organizers, so recheck the official live event data.

**Registration is not proof that the final project form has been submitted.** The project owner confirmed registration; this audit did **not** interact with the authenticated submission form.

## Official rules and BEFORE's current position

| Required/valued item | Status | Evidence / limitation |
|---|---|---|
| Product on Robinhood Chain | **Met (prototype)** | Live WIF mainnet reader on chain 4663 and BTEST testnet escrow on 46630 |
| Onchain $WIF utility in a **real, meaningful way** | **High-risk partial** | Current WIF feature only reads `balanceOf`/`allowance` on the **real WIF mainnet contract**. It does **not** change approvals, pay/lock/transfer WIF, or otherwise create $WIF contract state transitions. Organizers emphasize putting WIF to work, not merely observing it |
| Repeat-use / $WIF flywheel | **Not demonstrated** | Current reader is useful when investigating a known spender, but there is no demonstrated recurring or reinforcing WIF use cycle |
| Live product until final | **Currently met; future monitoring needed** | Public landing + WIF checker + Bounty Studio + Protect/Challenge/Proof are reachable without preview authentication; continued uptime cannot be guaranteed in advance |
| Public source / repo access | **Met** | Public GitHub repository with contracts, tests and docs |
| Real transaction evidence | **Partial** | Four real Robinhood **testnet BTEST** coordinator transactions, successful and signer-bound; synthetic reviewer actors all under one operator. The new user-first multi-wallet Studio workflow has passed locally and on a state fork, but has **not** yet produced fresh public independent-wallet receipts |
| Demonstration video | **Not delivered** | Organizers require a demo video. The project owner explicitly paused video production, so no further video work is authorized |
| Project registration | **User-confirmed** | Registration reported complete; final submission form status has not been verified |
| Good build quality / functioning app | **Met (technical prototype)** | CI passed; 70 Solidity tests, 73 Node tests, responsive/WCAG browser QA, complete local E2E; read-only production RPC/WIF and public testnet proof checks passed |
| Contest-winning claim | **Not established** | Eligibility and judging decisions are organizers' responsibility; no guaranteed win |

**Key rule passages** from the organizer's public rules (paraphrased): projects must use $WIF onchain in a meaningful way, stay live, provide accessible repository and real transactions, include a demonstration video, and possess a reason for users to return. Judges assess actual WIF utility, repeat-use mechanics, and working build quality.

## Actual deployed testnet state

Direct RPC checks of `https://rpc.testnet.chain.robinhood.com` on 6 November 2026:

- Chain ID: **46630**
- Escrow: `0xF9d644dd2024E2dFc425aA7c1059F9b4E720684a`
- BTEST token: `0xf080A1a012F2Dd41c4F416Befd6D70074af75A4C`
- Training target: `0x7e29bC6Df38e60E77513bc1084dB488FeE12947C`
- Coordinator: `0x166E3367cdC9751A02570fedf8d700C4f70fCd1C`; stage `3`
- `nextChallengeId() = 5`, indicating IDs **1–4** in the existing escrow at audit time.
- All four existing IDs have the historical **synthetic demo scope**, which does **not** match the current self-service Studio scope. No self-service Studio-created challenge had been confirmed publicly at audit time.
- Existing start/settle/cleanup and deploy receipts are verifiably successful, but they are **not new user-driven browser receipts**.

## Stronger integration test (not a public broadcast)

The public production Bounty Studio was exercised via `qa/bounty-public-testnet-fork.mjs` on an **isolated Anvil fork of the public testnet** using the actual deployed escrow, BTEST and training target bytecode.

Anvil-only transactions completed:
- Sponsor creation of fork-local challenge #5
- Separate test-account researcher commitment for #5
- Appointed review and reward settlement for #5
- Cancellation of fork-local challenge #6
- Expiry reward and bond refunds for fork-local challenge #7
- Final fork escrow BTEST balance equal to its **pre-run** balance (0 at the time of the check)

The original full browser regression tested 320/375/768/1280px and accessibility. The fork-only integration test isolates blockchain behavior without redundantly rerunning every WCAG screen.

**These transaction IDs exist in the local fork only. The public chain's next ID remains 5 unless an actual new transaction is broadcast.**

## Current action order

1. **Public self-service acceptance:** complete [the three-wallet BTEST testnet walkthrough](PUBLIC_TESTNET_STUDIO_WALKTHROUGH.md) and collect four **new public explorer receipts** for sponsor, researcher, appointed reviewer and settlement. This requires user-approved wallet signatures or an explicitly authorized local signer; no signer is available to this chat.
2. **Close WIF/flywheel gap:** choose and implement a **genuine, recurring $WIF onchain action** that is safe, non-custodial and user-controlled. Do not insert real asset transfers into unaudited testnet contracts or imply the read-only scanner alone guarantees eligibility.
3. **Submission accuracy:** update the authenticated organizer form before the stated deadline, with accurate claims, public links and current evidence.
4. **Required video:** the contest mandates a demo video, but video work remains **paused at the user's direction**. Obtain a new explicit instruction before recording, generating narration or editing it.

## Safety and deployment discipline

- Do not disclose or copy private keys, mnemonics, encrypted keystore passwords or recovery salts to the repo or chat.
- Any real WIF mainnet write action requires a **separate design/security review and an explicit wallet-holder confirmation**.
- Do not replace the approved UI or deployed mock contracts simply to generate a contest transaction.
- Keep public fork-only and historical synthetic-reviewer evidence honestly labeled.
- No judge endorsement, independent security review, mainnet bounty payout, real WIF-funded vault or final submission is claimed by this audit.
