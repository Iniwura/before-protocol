# BEFORE

**Know who you're paying. Verify what you're sending. Prove what happened.**

BEFORE is a noncustodial **$WIF payment and verification app on Robinhood Chain**. A creator signs a payment request. A supporter checks the recipient, amount and network before approving a transfer in their own wallet. Afterwards, anyone can inspect the actual blockchain receipt.

**The core idea:** make a token payment understandable *before* someone confirms it, and independently verifiable *after* it settles.

[**Launch BEFORE**](https://before-web-theta.vercel.app/) · [**Watch the 2:38 demo**](https://youtu.be/YC7t2mql-cI) · [**Try WIF Support**](https://before-web-theta.vercel.app/app/support/) · [**Verify real transactions**](#real-wif-transactions)

> **Release scope:** Real WIF **Support** transfers have been verified on Robinhood Chain **mainnet**. The security vault, training challenge and bounty studio use **valueless BTEST on testnet only**. BEFORE does not custody real WIF, automate payments or claim a third-party security audit.

## Why BEFORE?

A wallet address, a signed request and a payment screenshot each tell a different story. None alone proves that the payer reviewed the intended destination or that the claimed payment actually happened.

BEFORE connects those steps:

```text
Creator signs a WIF support request
             ↓
Creator shares the link
             ↓
Supporter verifies the signed recipient, token, amount and network
             ↓
Supporter chooses to confirm an exact WIF transfer in their own wallet
             ↓
BEFORE independently checks the transaction, receipt and WIF Transfer event
             ↓
Anyone can inspect the public receipt; returning supporters opt in again
```

**No custody. No automatic debits. No unverifiable success screen.**

## Try it in two minutes

| If you are… | Start here | What you can do |
| --- | --- | --- |
| A creator | [WIF Support](https://before-web-theta.vercel.app/app/support/) | Prepare a signed, shareable request for voluntary WIF support |
| A supporter | [Open WIF Support](https://before-web-theta.vercel.app/app/support/) | Verify a shared request before deciding to sign an exact transfer |
| Checking evidence | [Public WIF history](https://before-web-theta.vercel.app/app/support/) | Search a recipient's previous direct WIF transfers and inspect real receipts **without connecting a wallet** |
| Making a one-off payment | [BEFORE Pay](https://before-web-theta.vercel.app/app/pay/) | Request, check and explicitly authorize a one-time WIF transfer |
| Checking permissions | [WIF Permission Check](https://before-web-theta.vercel.app/app/wif/) | Inspect an identified wallet/spender's WIF allowance without signing |
| Exploring security | [Protect / Challenge / Proof](https://before-web-theta.vercel.app/app/) | Preview spending rules, create a **testnet BTEST** vault with a wallet, and inspect testnet evidence |
| Researching bounties | [Bounty Studio](https://before-web-theta.vercel.app/app/bounty/) | Browse existing BTEST bounties, or run the sponsor → researcher → reviewer workflow on testnet |

**Judges:** [Watch the final walkthrough](https://youtu.be/YC7t2mql-cI), then examine the [two mainnet WIF receipts](#real-wif-transactions), then [inspect the source and reproduce tests](#run-and-verify-locally). This is the fastest path to assess the submitted project.

## Real WIF transactions

BEFORE Support was exercised **through the deployed production route** on November 8, 2026. Two transfers of **200 WIF each** were mined on Robinhood Chain mainnet.

| Verified transfer | Amount | Public transaction |
| --- | ---: | --- |
| Controlled acceptance cycle 1 | 200 WIF | [View mainnet receipt](https://robinhoodchain.blockscout.com/tx/0x4f6b1b2d48f73643408418896a7de886be4a522bf583a1c3d1d9c104c3b42476) |
| Controlled acceptance cycle 2 | 200 WIF | [View mainnet receipt](https://robinhoodchain.blockscout.com/tx/0x7e5ca115c13fed7e36109478c9f454adc81c58c2c114f569624d95792f64033a) |
| **Total** | **400 WIF** | [Full independent verification report](docs/ISSUE_18_MAINNET_SUPPORT_EVIDENCE.md) |

For each transaction, the read-only verifier checked the **official WIF contract, payer, recipient, exact ERC-20 `transfer` calldata, successful receipt, confirmation depth and matching Transfer event**.

**Evidence integrity:** These were **controlled mainnet acceptance tests using an automated local wallet harness**, not outside customer donations, human wallet-extension clicks, organic retention or transactions performed during the narrated demo. The second test used a newly signed support offer. No user keys or secrets were included in the repository.

## Why people would return

A creator can keep sharing their signed support page. A supporter can:

1. Review the terms and make a **voluntary** WIF contribution.
2. Reopen the page, inspect previous verified transfers and decide whether to support again.
3. Optionally export a **single calendar reminder** for manual import. Every new contribution requires another wallet confirmation.

This is BEFORE's **repeat-use mechanism**, not a subscription or guaranteed growth. BEFORE itself sends no notifications, collects no recurring allowances and cannot charge supporters automatically. The two mainnet receipts prove that two deliberate payment cycles work; they **do not prove independent repeat customers**.

The public history reader checks direct WIF transfers to a recipient, including transfers that may have originated **outside** BEFORE. Standard ERC-20 transfers do not include a BEFORE campaign identifier, so it does not attribute every transfer to a particular offer.

## What runs where

| Experience | Network | Current boundary |
| --- | --- | --- |
| **Support** | Robinhood Chain **mainnet · 4663** | Signed EIP-712 offers, explicit standard WIF transfers, verified receipts; two controlled mainnet transfers demonstrated |
| **Pay** | Robinhood Chain **mainnet · 4663** | One-off signed requests, payer preflight and explicit transfer; tested with simulated wallets; **no separate real Pay transfer claimed** |
| **WIF History / Permission Check** | Robinhood Chain **mainnet · 4663** | Read-only balance, transfer and allowance inspection |
| **Protect** | Robinhood Chain **testnet · 46630** | Testnet-only factory creates an owner-controlled BTEST vault with fixed demo limits (60 per transfer, 100 per UTC day); the on-screen policy evaluator is explicitly a local preview |
| **Challenge / Proof** | Robinhood Chain **testnet · 46630** | Deliberately vulnerable BTEST training vault and independently inspectable testnet receipts |
| **Bounty Studio** | Robinhood Chain **testnet · 46630** | Valueless BTEST rewards, commitment, appointed reviewer approval and contract settlement; public bounty list and proof |

The BTEST training and escrow contracts are **not audited production WIF custody contracts**. The one-click testnet vault demo uses fixed limits; custom factory parameters are not exposed by that button.

### Testnet bounty proof

Public BTEST **Bounty #7** completed sponsor creation, researcher commitment, appointed reviewer approval and reward settlement. The three distinct wallets were controlled by **one operator** in an acceptance test, not independent human researchers.

[Create](https://explorer.testnet.chain.robinhood.com/tx/0x5b54ab0f8db383cde66ff40a59ab7b926090d17f1854183a88ca2486b288a9a1) · [Commit](https://explorer.testnet.chain.robinhood.com/tx/0x4a00d1d9133670b738571823ee9e93d0dc861f938fcf832c1cbe121a4ab0ddd3) · [Review](https://explorer.testnet.chain.robinhood.com/tx/0x7682cbf90feac893c20cae875d4c1b8b216eae8a4faca813c2f31b505fab6bec) · [Settle](https://explorer.testnet.chain.robinhood.com/tx/0x17ecb3839f4c249fa1ca7c0283a191675d6f38256a498afda83059ec21750f5c) · [Read the audit](docs/ISSUE_8_PUBLIC_TESTNET_EVIDENCE.md)

## Architecture

The payment path is a **static, client-side application**. A creator's EIP-712 signature authorizes an offer; it **does not** move tokens. The supporter separately approves a standard ERC-20 `transfer` through an EIP-1193 browser wallet. Public Robinhood Chain RPC reads are used to verify the transaction and receipt. BEFORE does not have a backend signer or hold user funds.

**Mainnet official WIF contract:** `0x5173b8eA6923c2d40267890D45C46a3480954773`

**Code map**

| Directory | Purpose |
| --- | --- |
| [`web/`](web/) | Live static app, mainnet Pay/Support/history, read-only WIF checker, testnet demos |
| [`src/`](src/) | Solidity policy vault, restricted testnet factory, training arena, BTEST reward escrow and reviewer verifier |
| [`test/`](test/) · [`checks/`](checks/) | Solidity, reference-model, proof and adversarial tests |
| [`qa/`](qa/) | Browser, accessibility, wallet-flow and RPC acceptance tests |
| [`script/`](script/) | Local Anvil lifecycle, public testnet verification and deployment tooling |
| [`docs/`](docs/) | Evidence, security boundaries, runbooks and **historical checkpoints**; start with the [documentation index](docs/README.md) |

## Run and verify locally

**Prerequisites:** [Foundry](https://getfoundry.sh/) (Forge and Anvil), a recent Node.js LTS release, and Chromium for browser QA. The app itself is plain HTML, CSS and JavaScript and has no runtime package-install step.

```bash
git clone https://github.com/Iniwura/before-protocol.git
cd before-protocol

# Compile contracts and run adversarial/fuzz tests
forge build
forge test --fuzz-runs 1024 -vvv

# Test policy logic, security checks and browser-facing modules
node --test checks/*.test.mjs web/test/*.test.mjs

# Execute actual contract creation, withdrawals, and verification on local Anvil
node script/anvil-e2e.mjs

# Install browser QA dependencies once
npm ci --prefix qa
cd qa && npx playwright install chromium && cd ..

# Run first-time-user and wallet security regressions
node qa/verify.mjs
node qa/pay-e2e.mjs
node qa/support-e2e.mjs
node qa/bounty-e2e.mjs
node qa/wif-verify.mjs
```

To explore the frontend locally, serve the `web/` folder with any static file server, for example `python3 -m http.server 4173 --directory web`, then open `http://localhost:4173/`. This serves the same static routes, but mainnet payment actions still require a compatible EVM wallet, explicit user confirmation, and actual WIF plus gas. **Do not send real WIF while testing.**

For public **read-only** BTEST evidence:

```bash
node qa/issue-8-public-testnet-audit.mjs
node qa/issue-8-fresh-bounty-audit.mjs
```

These checks require RPC connectivity. Some older block-state queries require an archival RPC; a pruned public node may be unable to rerun every historical balance assertion. That does not establish that a transaction failed.

[**Latest production CI**](https://github.com/Iniwura/before-protocol/actions/runs/42879770424) · [**Public live-vault verification**](https://github.com/Iniwura/before-protocol/actions/runs/42894070451) · [**All workflows**](https://github.com/Iniwura/before-protocol/actions)

## Security and limitations

- **No automatic transfers or token custody.** A signed offer is not a payment. Each contribution needs a deliberate wallet confirmation, and mainnet transactions are irreversible.
- **No globally enforced single-use invoice.** Browser locks reduce accidental repeat sends but do not stop another wallet/device from paying a valid signed request again.
- **No unverified payment proof.** The verifier checks the specific token, calldata, receipt and Transfer logs; screenshots alone are not proof.
- **No production WIF vault or real-WIF bounty.** The security lab is restricted to freely mintable BTEST on testnet. It is not safe to infer general security from a training challenge.
- **No independent audit, third-party usage or organic retention claim.** Engineering tests and controlled mainnet transactions are not equivalent to those outcomes.
- **No custody of wallet secrets.** Never paste a private key, seed phrase or funded-wallet keystore into issues, CI, demos or this repository.

Read [Support security assumptions](docs/BEFORE_SUPPORT_SECURITY_AND_RELEASE.md), [Pay limitations](docs/WIF_PAY_SECURITY_AND_RELEASE.md), [testnet verification](docs/TESTNET_PROOF.md) and [technical security notes](docs/SECURITY_NOTES.md).

## Submission and maintainers

Built for the [World Is Flat hackathon](https://worldisflat.fun/build), where the requirement is a product that **uses WIF onchain** and gives people a genuine reason to return. BEFORE's mainnet Support flow is the primary WIF use case; the testnet lab is supporting security infrastructure.

**Developer:** [Iniwura](https://github.com/Iniwura) · [Live product](https://before-web-theta.vercel.app/) · [Final demo](https://youtu.be/YC7t2mql-cI) · [Evidence and documentation](docs/README.md)

Questions and bug reports: [repository issues](https://github.com/Iniwura/before-protocol/issues). For a potential security vulnerability, please avoid publishing exploit details before contacting the maintainer through a private channel.

*This repository is public for judge review and reproducibility. No open-source license has been declared; public visibility alone does not grant reuse rights.*
