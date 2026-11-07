# BEFORE

**Protect. Challenge. Proof.**

BEFORE is a prototype for the [World Is Flat](https://worldisflat.fun/build) hackathon on Robinhood Chain. It demonstrates enforceable ERC-20 transfer policies, an isolated intentionally vulnerable practice vault, deterministic verification of a policy bypass, and a separate commit/reveal escrow for independently verifiable security findings.

> **Research only. The mock-only contracts are deployed and independently verified on Robinhood Chain testnet; they are not audited and must not receive real assets.** The WIF-capable escrow is empty, no real WIF reward is funded, and no mainnet custody is claimed.

## Protect

BeforeVault accepts a single ERC-20, has an immutable owner and withdrawal destination, and enforces both a maximum amount per transfer and an aggregate spending limit per fixed UTC day. The owner cannot bypass the contract by requesting a larger single transfer or splitting a transfer across the same UTC day. This protects only tokens **inside that vault**, not arbitrary wallet transactions.

## Challenge

TrainingVault intentionally omits the aggregate daily limit. TrainingArena lets anyone demonstrate the error using real mock-token transfers. The arena and training vault are restricted to local chain ID 31337 or Robinhood Chain testnet 46630 and the exact MockERC20 runtime code. The obvious practice solution has no monetary reward.

## Proof

The exercise verifies token balance changes and a one-time solution state using contract execution, not an AI opinion. The verified deployment manifest also lets the app read the actual empty challenge escrow's record count without enabling WIF funding. Public-chain receipts and immutable-aware bytecode evidence are recorded in [TESTNET_PROOF.md](docs/TESTNET_PROOF.md).

## Reproduce locally

Requires [Foundry](https://getfoundry.sh/) and Node.js.

~~~sh
forge build
forge test --fuzz-runs 1024 -vvv
node --test checks/reference.test.mjs checks/deployment-proof.test.mjs checks/deployment-cli.test.mjs checks/broadcast-args.test.mjs web/test/core.test.mjs web/test/onchain.test.mjs
node script/anvil-e2e.mjs
node script/check-chain.mjs
~~~

The network check is read-only; it requires internet access.

## Verified engineering checkpoint — 2026-11-05

- Foundry 1.9.0 and Solc 0.8.36 compiled the code successfully.
- Solidity policy, factory, adversarial and escrow tests pass in a local Foundry EVM; fuzz tests run at 1,024 cases each.
- Independent JavaScript policy, deployment-proof, web ABI and CLI tests pass, including manifest-preservation checks for both verified and unverified starting states.
- The WIF-capable escrow has dedicated commit/reveal, copied-commitment, invalid-proof, expiry, cancellation and fee-token tests.
- Robinhood Chain testnet public RPC returned chain ID 46630 in a read-only check.
- The public mock-only deployment passed the complete eleven-argument verifier: direct bytecode, immutable constructor state, events, receipts, historical balances and Protect/Challenge flow.
- The authorized disposable signer was `0xd1061825504b30f404c0d94b745205925f251f2c`; the earlier `0xa35dc047f9937bf668743efbdf8ea93b31a55888` preflight address was not used.
- **No audited security claim, real-token custody, funded WIF reward or mainnet deployment.**

GitHub Actions [run 123](https://github.com/Iniwura/before-protocol/actions/runs/42114536969) independently passed the contract, real local-Anvil release gate and browser-quality jobs for release commit `a5a0b49`, including the reviewed-finding quorum, escrow-instance binding, source-side token-accounting hardening, verifier/target/reward-token code-pinning tests, transfer-callback mutation protection, cross-chain commitment-domain separation, empty-evidence rejection, immutable-aware runtime proof, historical-balance proof, read-only escrow status, wallet transaction-identity checks, event-bound deployment proof, complete-manifest Proof rendering, deployed-state accessibility checks, public-flow evidence checks and expanded browser failure-path checks. This CI evidence does not establish an audit or WIF custody.

## Live research prototype

**Verified preview:** https://before-1xhzzheka-iniwura-akurus-projects.vercel.app/

The responsive, dependency-free frontend has three experiences:

- **Protect:** local, clearly labeled policy preview. No real transaction occurs.
- **Challenge:** local simulation of the intentional split-transfer flaw using mock amounts. The onchain practice path uses BTEST only and pays no bounty.
- **Proof:** live read-only testnet RPC inspection for supplied vault-like addresses and transaction receipts. It does not establish contract authenticity or security.

The web code is in `web/`; the Node test commands cover policy, ABI, deployment-proof and browser-facing logic. GitHub Actions checks Solidity, policy-model, deployment and web tests. CI is at https://github.com/Iniwura/before-protocol/actions.

The verified preview reads the public testnet deployment through the checked-in manifest. Production remains unchanged until separately approved.

## BEFORE Pay (draft, mainnet-aware and noncustodial)

The `/app/pay/` preview adds a focused request → check → pay → proof flow for the official WIF token on Robinhood Chain mainnet. A recipient signs an EIP-712 exact-amount request; a payer independently verifies the recipient, token, chain, balance and gas before an explicit standard ERC-20 transfer. Public proof rechecks the mined transaction and WIF `Transfer` event. The automated flow uses mock wallets and RPC only; it never broadcasts real WIF. See [WIF_PAY_SECURITY_AND_RELEASE.md](docs/WIF_PAY_SECURITY_AND_RELEASE.md) for the threat model, duplicate-payment limit and owner-controlled real-WIF gate.

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

## Phase 3 — Testnet demo factory (verified mock-only deployment)

The `BeforeFactory` source adds self-service creation of **testnet-only, mock-token** vaults and independent practice arenas. A single wallet transaction can create an owner-controlled protected vault pre-funded with valueless BTEST; another creates a separate challenge funded only with BTEST. Factory registry reads let observers check whether an address was created by the configured factory.

The versioned `web/deployment.json` now contains independently verified Robinhood Chain testnet addresses and genuine deployment transaction hashes. The UI exposes only the mock-token Protect/Challenge paths; the empty escrow remains read-only and cannot fund WIF.

This is not a real-WIF bounty or a mainnet custody release.

See [Phase 3 implementation and deployment gates](docs/PHASE_3.md).

## WIF-funded security challenges

The solver commitment domain includes the escrow address, Robinhood Chain ID, challenge ID, solver address, salt and evidence hash, preventing cross-chain or copied-wallet replay.

`WifSecurityChallenge` is intentionally separate from the public BTEST exercise. A sponsor escrows a chosen ERC-20 reward, records a concrete target contract, its code hash and an immutable hash of the written challenge scope, sets an independently reviewed verifier and a maximum 30-day commit/reveal window, and requires each solver to post a bond. The verifier receives the challenge ID, solver, target and scope hash explicitly, alongside the revealed evidence. A solver commits a hash bound to their wallet, salt and evidence, then reveals after the commit window. Only a verifier-approved reveal receives the reward and bond; invalid evidence slashes the bond to the sponsor; expiry returns the reward and releases unanswered bonds. Settlement fails closed if the target, verifier or reward token code changes. `ReviewedFindingVerifier` provides a fixed reviewer set and threshold that must approve the exact escrow instance, challenge context and evidence hash before settlement.

The contract can hold WIF when configured with the intended Robinhood Chain WIF token, but this repository does not contain a WIF address, private key, funded challenge, or payout claim. The verifier is part of the trust boundary and must bind the supplied challenge ID, solver, target and scope, inspect the target, and receive independent review before any valuable funding.

## Proving a testnet deployment

After a mock-only testnet deployment, `script/verify-testnet.mjs` can check the actual factory, test-token and empty escrow creation receipts, their contract addresses, 12 confirmation blocks, and immutable-aware runtime provenance against Foundry artifacts. Its full interaction mode also checks the two factory-call receipts, exact calldata and factory event data, deployer-owned registry outputs, created vault/arena constructor state, exact BTEST transfer logs, block-specific 150/130/40 BTEST balances, and public Protect/Challenge receipts for an allowed withdrawal, a denied withdrawal and the 60+50 practice proof. It is read-only and cannot make a false testnet claim from only a pasted address.

The same eleven-argument verifier is exercised against real local Anvil state by `node script/anvil-e2e.mjs`; genuine evidence must pass and swapped receipts must fail. Local evidence is never eligible to enable the hosted manifest.

**A mock-only testnet deployment is claimed here.** Verified metadata is `true` because the public eleven-argument evidence passed. This is not an audit, a WIF payout or a mainnet release.

[Read the testnet proof process](docs/TESTNET_PROOF.md).

## Next gates

1. Confirm current competition rules and complete project registration.
2. Review explorer source and receipts for the public mock-only deployment.
3. Increase property/invariant coverage and obtain independent security review before any real custody.
4. Configure a separate WIF reward only for a meaningful, independently reviewed verifier; the existing trivially solvable training exercise must never be presented as a paid research bounty.
5. Keep production unchanged until the verified preview and draft PR receive explicit approval.

[Deployment](docs/DEPLOYMENT.md) · [Security boundaries](docs/SECURITY_NOTES.md) · [WIF challenge design](docs/WIF_CHALLENGE_DESIGN.md) · [Verification](docs/VERIFICATION.md) · [Submission runbook](docs/SUBMISSION.md) · [Phase 1](docs/PHASE_1.md) · [Phase 2](docs/PHASE_2.md)
