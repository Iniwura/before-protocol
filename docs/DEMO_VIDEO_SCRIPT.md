# BEFORE — 90-second judge demo

> **ARCHIVED / historical demo document (November 8, 2026).** This predates BEFORE Pay, BEFORE Support and the verified mainnet WIF transfers. It is **not** the current release, recording or submission instructions. Use [the frozen build handoff](ENGINEERING_RELEASE_FREEZE_2026-11-08.md), [current submission packet](WORLD_IS_FLAT_SUBMISSION_PACKET.md) and [current readiness gate](FINAL_SUBMISSION_READINESS.md). Retained solely for project history.

---

**Editorial goal:** Show one clear concept, one genuinely useful $WIF mainnet read, one testnet onchain settlement, and independently clickable evidence. Avoid a montage of static pages or an unsupported "secure funds" claim.

## Narrative and shots

| Time | On screen | Calm voiceover | Evidence overlay |
|---|---|---|---|
| 00:00–00:10 | Dark opening with the BEFORE wordmark, then real WIF checker | "Before you move tokens, know what you've already authorized. Most permissions are hidden in contract calls. BEFORE makes them readable." | BEFORE® / KNOW WHAT YOU APPROVED |
| 00:10–00:27 | Mainnet WIF Permission Check. Show a real public wallet and spender, then current allowance | "This is the actual World Is Flat token on Robinhood Chain mainnet. Paste a WIF approval, or choose a wallet and spender. BEFORE checks the current allowance against the real contract. No wallet connection, no signing, no funds moved." | ROBINHOOD MAINNET / WIF / CHAIN 4663 / READ ONLY |
| 00:27–00:39 | Enter Bounty Studio from the landing page, select Post a test reward | "The second part turns evidence into a testable security workflow. A project posts a mock-token bounty and appoints reviewers. Nothing here uses real WIF." | ROBINHOOD TESTNET / BTEST / CHAIN 46630 |
| 00:39–00:56 | Show distinct researcher and reviewer views, exact finding commitment and approval | "A researcher commits a finding, then a reviewer checks the exact evidence. The contract binds the commitment and the approval to the same challenge." | SPONSOR → RESEARCHER → REVIEWER |
| 00:56–01:15 | Highlight public Blockscout receipt links for start, settle, cleanup; show coordinator stage 3 | "Here is the proof. A real testnet challenge was created, its reward settled, and unused funds refunded. Every action has a public receipt that can be checked independently." | CONFIRMED TRANSACTIONS / PUBLIC RECEIPTS / STAGE 3 |
| 01:15–01:25 | Return to app and source link | "Our published demonstration uses valueless BTEST and synthetic reviewer accounts. It is not a WIF payout or an independent security audit. That's precisely the point: only claim what the chain proves." | BTEST ONLY · SYNTHETIC DEMO REVIEWERS |
| 01:25–01:32 | Finale with product and source link | "BEFORE. Know what you approved. Prove what happened." | BEFORE® / BEFORE-WEB-THETA.VERCEL.APP |

**Total target:** approximately 90 seconds. Narration should be calm, steady, clear and premium, with deliberate pauses rather than rushed narration.

## Full voiceover transcript

Before you move tokens, know what you've already authorized. Most permissions are hidden in contract calls. BEFORE makes them readable.

This is the actual World Is Flat token on Robinhood Chain mainnet. Paste a WIF approval, or choose a wallet and spender. BEFORE checks the current allowance against the real contract. No wallet connection, no signing, no funds moved.

The second part turns evidence into a testable security workflow. A project posts a mock-token bounty and appoints reviewers. Nothing here uses real WIF.

A researcher commits a finding, then a reviewer checks the exact evidence. The contract binds the commitment and the approval to the same challenge.

Here is the proof. A real testnet challenge was created, its reward settled, and unused funds refunded. Every action has a public receipt that can be checked independently.

Our published demonstration uses valueless BTEST and synthetic reviewer accounts. It is not a WIF payout or an independent security audit. That's precisely the point: only claim what the chain proves.

BEFORE. Know what you approved. Prove what happened.

## Recording requirements

- Record the **real UI**, not an imagined product render or generated picture. Prefer clean 16:9 composition, 1080p, and legible browser text.
- Show the *actual RPC-backed* WIF result. Label it mainnet **read-only**. Do not show a connection prompt or a signing action on the WIF screen.
- Show the existing wallet-based BTEST workflow using disposable accounts and clearly label any local-Anvil sequence as **local demo**. Do not present that local sequence as fresh public Robinhood testnet transactions.
- Cut to **real public** coordinator receipts for start, settle and cleanup. Confirm each hash is visible and the explorer points to Robinhood testnet.
- When referring to the historical bounty review, label **synthetic reviewers controlled by one operator**. Do not imply external independent bug verification.
- Visually distinguish mainnet 4663, testnet 46630 and local Anvil. The demo should not pretend those are the same chain or token.
- Do not reveal private keys, keystore passwords, seed phrases or wallet signing prompts containing sensitive data. No real WIF money should move.
- End on the production app, public GitHub and public explorer receipts.

## Reference URLs

WIF check: `https://before-web-theta.vercel.app/app/wif/`  
Bounty Studio: `https://before-web-theta.vercel.app/app/bounty/`  
Public evidence: `https://before-web-theta.vercel.app/app/#challenge`  
GitHub: `https://github.com/Iniwura/before-protocol`
