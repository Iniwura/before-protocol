# World Is Flat submission packet

Copy-ready material for the [World Is Flat hackathon](https://worldisflat.fun/build). Keep the status language accurate until public testnet receipts are verified.

## Project fields

**Name:** BEFORE

**Tagline:** Evidence-bound ERC-20 protection and security bounties for Robinhood Chain.

**Categories:** Tools and infrastructure · Consumer and payments

**About:** BEFORE makes token safety inspectable. Protect demonstrates an immutable per-transfer and daily spending policy. Challenge isolates the missing cumulative rule in a mock-only training vault. Proof lets anyone inspect the chain, contract state and receipts without a wallet.

The production mechanism is a separate ERC-20 escrow for meaningful security findings. A sponsor pins the target contract, runtime code, written scope, verifier and reward token. Solvers use a wallet-bound commit/reveal and bond; a fixed reviewer quorum approves the exact evidence before settlement. Invalid evidence loses only the bond, expiry returns funds, and code changes fail closed.

**Product:** https://before-b9x9gm40p-iniwura-akurus-projects.vercel.app

**Source:** https://github.com/Iniwura/before-protocol

**Verification PR:** https://github.com/Iniwura/before-protocol/pull/3

## Judge flow

1. **Protect:** submit 75 with 40 already spent to see the 60-token transfer cap block the request; submit 20 to see an allowed local policy result.
2. **Challenge:** submit 60 + 50. Each transfer is individually valid, but the combined amount exceeds the 100-token daily limit.
3. **Proof:** inspect the read-only network state, then use the verified manifest path to inspect the demo vault, practice arena and public receipt evidence.

## Evidence checkpoint

- 65 Solidity tests, including adversarial accounting, replay, expiry, verifier quorum, code-pinning, transfer-callback mutation and empty-evidence cases.
- 55 JavaScript checks, including exact deployment receipt/event/runtime proof and public broadcast extraction checks.
- Browser QA: 12 responsive/accessibility audits plus 3 complete-manifest accessibility states, zero violations, no horizontal overflow, mocked wallet success and failure paths.
- [CI run 100](https://github.com/Iniwura/before-protocol/actions/runs/41924251806) passed both jobs for the documented security-hardening head `df35ae9`.
- Robinhood Chain read-only RPC confirms chain ID 46630.

## Claim boundary

The browser preview and local/CI evidence are real. Robinhood testnet deployment, verified source, funded WIF challenge and payout are not claimed until public receipts and explorer verification are recorded. The checked-in manifest remains `verified: false`; no private key or real-value custody is included.

The concrete paid-challenge design is documented in [WIF_CHALLENGE_DESIGN.md](WIF_CHALLENGE_DESIGN.md); it keeps the mock training exercise separate from any future WIF bounty.

## Finalization gate

After a disposable testnet wallet signs the test-only deployment, run the eleven-argument command in [TESTNET_PROOF.md](TESTNET_PROOF.md). Only after the verifier passes should the public addresses and transaction hashes be committed to `web/deployment.json`, followed by a fresh browser run and PR update.
