# BEFORE

**Protect. Challenge. Proof.**

BEFORE is a prototype for the [World Is Flat](https://worldisflat.fun/build) hackathon on Robinhood Chain. It demonstrates enforceable ERC-20 transfer policies, an isolated intentionally vulnerable practice vault, and deterministic verification of a policy bypass.

> **Research only. The browser prototype is deployed; the contracts are not deployed or audited. Do not deposit real assets.** No real WIF token or reward is used.

## Protect

BeforeVault accepts a single ERC-20, has an immutable owner and withdrawal destination, and enforces both a maximum amount per transfer and an aggregate spending limit per fixed UTC day. The owner cannot bypass the contract by requesting a larger single transfer or splitting a transfer across the same UTC day. This protects only tokens **inside that vault**, not arbitrary wallet transactions.

## Challenge

TrainingVault intentionally omits the aggregate daily limit. TrainingArena lets anyone demonstrate the error using real mock-token transfers. The arena and training vault are restricted to local chain ID 31337 or Robinhood Chain testnet 46630 and the exact MockERC20 runtime code. The obvious practice solution has no monetary reward.

## Proof

The exercise verifies token balance changes and a one-time solution state using contract execution, not an AI opinion. Public-chain receipts and verified source will be added after testnet deployment.

## Reproduce locally

Requires [Foundry](https://getfoundry.sh/) and Node.js.

~~~sh
forge build
forge test --fuzz-runs 1024 -vvv
node --test checks/reference.test.mjs
node script/check-chain.mjs
~~~

The network check is read-only; it requires internet access.

## Verified Phase 1 checkpoint — 2026-11-03

- Foundry 1.9.0 and Solc 0.8.36 compiled the code successfully.
- 28 / 28 Solidity tests passed in a local Foundry EVM (including fuzz tests at 1,024 runs each).
- 9 / 9 independent JavaScript reference-model tests passed.
- BeforeVault line coverage was 98.25% in the local coverage run, with branch gaps remaining.
- Robinhood Chain testnet public RPC returned chain ID 46630 in a read-only check.
- **No chain deployment, audited security claim, real-token custody, or real WIF reward.**

These are previous local environment results; GitHub Actions runs separately and is the repository CI source of truth.

## Live research prototype

**Website:** https://before-web-theta.vercel.app/

The responsive, dependency-free frontend has three experiences:

- **Protect:** local, clearly labeled policy preview. No real transaction occurs.
- **Challenge:** local simulation of the intentional split-transfer flaw using mock amounts. No paid bounty.
- **Proof:** live read-only testnet RPC inspection for supplied vault-like addresses and transaction receipts. It does not establish contract authenticity or security.

The web code is in `web/`; `node --test web/test/core.test.mjs` runs its 13 pure-logic checks. GitHub Actions checks Solidity, policy-model and web tests. CI is at https://github.com/Iniwura/before-protocol/actions.

The static website being live does not mean the contracts have been deployed. Testnet-chain transactions and verified contract addresses remain outstanding.

## Architecture

- src/BeforeVault.sol — protected immutable policy vault.
- src/TrainingVault.sol — deliberately vulnerable mock-only practice vault.
- src/TrainingArena.sol — deterministic training proof verifier.
- src/mocks — purpose-built test tokens, including adversarial mocks.
- test — Solidity unit, fuzz, negative-path, and end-to-end tests.
- reference and checks — dependency-free policy model, not a replacement for Solidity execution.
- script — test-only deployment helper and read-only chain ID checker.
- docs — deployment, security boundaries, evidence, and milestone handoff.

## Phase 3 — Testnet demo factory (proposed, not deployed)

The `BeforeFactory` source adds self-service creation of **testnet-only, mock-token** vaults and independent practice arenas. A single wallet transaction can create an owner-controlled protected vault pre-funded with valueless BTEST; another creates a separate challenge funded only with BTEST. Factory registry reads let observers check whether an address was created by the configured factory.

The web has wallet transaction paths ready but **they remain hidden** until the versioned `web/deployment.json` is populated with independently verified Robinhood Chain testnet addresses and genuine deployment transaction hashes. Empty or unverified metadata cannot enable blockchain actions.

This is not a real-WIF bounty or a mainnet custody release.

See [Phase 3 implementation and deployment gates](docs/PHASE_3.md).

## Next gates

1. Confirm current competition rules and complete project registration.
2. Deploy **mock-only** contracts on Robinhood Chain testnet and capture explorer receipts and verified source.
3. Increase property/invariant coverage and obtain independent security review before any real custody.
4. Design a separate and economically defensible WIF reward flow. The existing trivially solvable training exercise must never be presented as a paid research bounty.
5. Continue browser QA and replace local preview-only flows with real, safely scoped testnet interactions once testnet contracts are verifiably deployed.

[Deployment](docs/DEPLOYMENT.md) · [Security boundaries](docs/SECURITY_NOTES.md) · [Verification](docs/VERIFICATION.md) · [Phase 1](docs/PHASE_1.md) · [Phase 2](docs/PHASE_2.md)
