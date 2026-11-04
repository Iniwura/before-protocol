# BEFORE

**Protect. Challenge. Proof.**

BEFORE is a prototype for the [World Is Flat](https://worldisflat.fun/build) hackathon on Robinhood Chain. It demonstrates enforceable ERC-20 transfer policies, an isolated intentionally vulnerable practice vault, deterministic verification of a policy bypass, and a separate commit/reveal escrow for independently verifiable security findings.

> **Research only. The browser prototype is deployed; the contracts are not deployed or audited. Do not deposit real assets.** The WIF-capable escrow is implemented and tested, but no real WIF reward is funded or claimed.

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
node --test checks/reference.test.mjs checks/deployment-proof.test.mjs checks/deployment-cli.test.mjs web/test/core.test.mjs web/test/onchain.test.mjs
node script/check-chain.mjs
~~~

The network check is read-only; it requires internet access.

## Verified engineering checkpoint — 2026-11-04

- Foundry 1.9.0 and Solc 0.8.36 compiled the code successfully.
- Solidity policy, factory, adversarial and escrow tests pass in a local Foundry EVM; fuzz tests run at 1,024 cases each.
- Independent JavaScript policy, deployment-proof, web ABI and CLI tests pass.
- The WIF-capable escrow has dedicated commit/reveal, copied-commitment, invalid-proof, expiry, cancellation and fee-token tests.
- Robinhood Chain testnet public RPC returned chain ID 46630 in a read-only check.
- **No chain deployment, audited security claim, real-token custody, or real WIF reward.**

GitHub Actions run [55](https://github.com/Iniwura/before-protocol/actions/runs/41909875342) independently passed the contract and browser-quality jobs, including the reviewed-finding quorum, escrow-instance binding, source-side token-accounting hardening and expanded browser failure-path checks. Neither local nor CI results establish testnet deployment, an audit or WIF custody.

## Live research prototype

**Website:** https://before-web-theta.vercel.app/

The responsive, dependency-free frontend has three experiences:

- **Protect:** local, clearly labeled policy preview. No real transaction occurs.
- **Challenge:** local simulation of the intentional split-transfer flaw using mock amounts. The onchain practice path uses BTEST only and pays no bounty.
- **Proof:** live read-only testnet RPC inspection for supplied vault-like addresses and transaction receipts. It does not establish contract authenticity or security.

The web code is in `web/`; the Node test commands cover policy, ABI, deployment-proof and browser-facing logic. GitHub Actions checks Solidity, policy-model, deployment and web tests. CI is at https://github.com/Iniwura/before-protocol/actions.

The static website being live does not mean the contracts have been deployed. Testnet-chain transactions and verified contract addresses remain outstanding.

## Architecture

- src/BeforeVault.sol — protected immutable policy vault.
- src/TrainingVault.sol — deliberately vulnerable mock-only practice vault.
- src/TrainingArena.sol — deterministic training proof verifier.
- src/WifSecurityChallenge.sol — separate ERC-20 reward escrow with solver-bound commit/reveal and expiry paths.
- src/ReviewedFindingVerifier.sol — fixed-quorum reviewer gate for exact challenge evidence; it is not an oracle.
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

## WIF-funded security challenges

`WifSecurityChallenge` is intentionally separate from the public BTEST exercise. A sponsor escrows a chosen ERC-20 reward, records a concrete target contract, its code hash and an immutable hash of the written challenge scope, sets an independently reviewed verifier and a maximum 30-day commit/reveal window, and requires each solver to post a bond. The verifier receives the challenge ID, solver, target and scope hash explicitly, alongside the revealed evidence. A solver commits a hash bound to their wallet, salt and evidence, then reveals after the commit window. Only a verifier-approved reveal receives the reward and bond; invalid evidence slashes the bond to the sponsor; expiry returns the reward and releases unanswered bonds. Settlement fails closed if the target, verifier or reward token code changes. `ReviewedFindingVerifier` provides a fixed reviewer set and threshold that must approve the exact escrow instance, challenge context and evidence hash before settlement.

The contract can hold WIF when configured with the intended Robinhood Chain WIF token, but this repository does not contain a WIF address, private key, funded challenge, or payout claim. The verifier is part of the trust boundary and must bind the supplied challenge ID, solver, target and scope, inspect the target, and receive independent review before any valuable funding.

## Proving a testnet deployment

After a mock-only testnet deployment, `script/verify-testnet.mjs` can check the actual factory, test-token and empty escrow creation receipts, their contract addresses, 12 confirmation blocks, and byte-for-byte runtime code against Foundry artifacts. Its optional interaction mode also checks the two factory-call receipts, exact calldata and factory event data, deployer-owned registry outputs, created vault/arena runtime code and 150-BTEST balances. It is read-only and cannot make a false testnet claim from only a pasted address.

**No testnet deployment is claimed here.** Verified metadata remains `false` until evidence passes.

[Read the testnet proof process](docs/TESTNET_PROOF.md).

## Next gates

1. Confirm current competition rules and complete project registration.
2. Deploy the mock-only demo contracts and empty challenge escrow on Robinhood Chain testnet and capture explorer receipts and verified source.
3. Increase property/invariant coverage and obtain independent security review before any real custody.
4. Configure a separate WIF reward only for a meaningful, independently reviewed verifier; the existing trivially solvable training exercise must never be presented as a paid research bounty.
5. Continue browser QA and replace local preview-only flows with real, safely scoped testnet interactions once testnet contracts are verifiably deployed.

[Deployment](docs/DEPLOYMENT.md) · [Security boundaries](docs/SECURITY_NOTES.md) · [Verification](docs/VERIFICATION.md) · [Submission runbook](docs/SUBMISSION.md) · [Phase 1](docs/PHASE_1.md) · [Phase 2](docs/PHASE_2.md)
