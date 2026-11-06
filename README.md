# BEFORE

**Know what you approved. Prove what happened.**

BEFORE is a [World Is Flat](https://worldisflat.fun/build) Robinhood Chain prototype with two clearly separated, working experiences: **read-only $WIF spending-permission inspection on mainnet** and **BTEST-only security-bounty settlement on testnet**.

For WIF holders, BEFORE inspects an identified wallet/spender allowance against the official $WIF token contract without wallet connection, signing or custody. For builders and researchers, the Bounty Studio demonstrates sponsor → researcher → appointed reviewer → verifiable settlement using valueless BTEST. The optional Protect → Challenge → Proof training experience shows enforceable policy vaults, intentional vulnerabilities and actual testnet receipts.

> **Scope:** The WIF feature only reads public mainnet state; it does not enumerate all permissions or revoke them. Bounty contracts are unaudited, deployed only on testnet and must **never** receive real assets. The historical BTEST reviewer approvals used synthetic roles controlled by one operator; they are not independent vulnerability reviews. No real WIF has been funded, approved, moved or held by BEFORE.

## Product routes

- **Landing:** https://before-web-theta.vercel.app/
- **Bounty Studio (main guided app, testnet-only):** https://before-web-theta.vercel.app/app/bounty/
- **WIF Permission Check (mainnet, read-only):** https://before-web-theta.vercel.app/app/wif/
- **Protect → Challenge → Proof demonstration:** https://before-web-theta.vercel.app/app/

The website uses dependency-free static routes. Legacy `/#protect`, `/#challenge`, and `/#proof` links redirect to the corresponding section of `/app/`. Contracts, chain IDs and proof manifests are fixed to their documented networks. The source is public, and the mainnet WIF reader uses the official `0x5173b8eA6923c2d40267890D45C46a3480954773` token contract on chain **4663**. The bounty and training contracts use Robinhood Testnet **46630** only.

See [WIF Permission Check](docs/WIF_PERMISSION_CHECK.md), [Bounty Studio guide](docs/BOUNTY_STUDIO.md) and [public testnet evidence](docs/BOUNTY_TESTNET_EVIDENCE.md).

## Real WIF utility: read-only permission inspection

Paste a confirmed WIF `approve(spender, amount)` transaction hash or enter a wallet address and a specific spender. BEFORE checks the token contract's current `allowance(owner, spender)` and `balanceOf(owner)` at the same mainnet block. It makes large permissions readable, shows whether spender bytecode exists, links the approval and wallet addresses to the public explorer, and refuses mismatched network/token data. Nothing is signed, sent, revoked or deposited. An allowance of zero applies **only to the selected spender**.

The permission checker was exercised against the real Robinhood mainnet RPC in Chromium and is covered by independent ABI tests and 320/375/768/1280px accessibility regressions. Read [exact capabilities and limits](docs/WIF_PERMISSION_CHECK.md).

## Guided application and Bounty Studio

The landing page now launches the **main product at `/app/bounty/`**. New users first choose what they want to do: **Post a reward**, **Submit a finding**, **Review a finding**, or **Recover an unfinished deposit**. BEFORE shows one task at a time, asks for a wallet only when an action needs signing, and gives the sponsor distinct researcher/reviewer links after creation. Its core workflow is **post a BTEST reward → submit a finding → reviewer checks and approves → researcher reveals → escrow settles**. The separate **Protect → Challenge → Proof educational demonstration** remains at `/app/` and needs no wallet for simulations and public receipts.

Bounty Studio uses the existing testnet escrow, freely mintable BTEST and the fixed training-vault target. A sponsor can deploy a per-bounty, immutable `ReviewedFindingVerifier` with chosen reviewer wallets and a quorum, mint and approve the exact mock reward, and open a timed challenge. A different solver wallet can commit a private evidence hash and BTEST bond. Appointed reviewers can record their approval of the exact context and evidence; the solver can reveal and settle only during the reveal window with the required approvals. Sponsors/solvers can cancel or recover expired funds when onchain conditions allow.

The **full wallet workflow** passed real local Anvil transactions in Playwright across sponsor, solver and reviewer wallets, including reviewed payout, unappointed-reviewer rejection, premature and unapproved reveal protection, cancellation and expiry refunds, with no remaining test escrow BTEST. This is distinct from the already-verified **public synthetic-reviewer** testnet lifecycle. We have not claimed that the newly added self-service UI has broadcast its own public wallet transactions.

See [how to use Bounty Studio](docs/BOUNTY_STUDIO.md) and [public BTEST testnet evidence](docs/BOUNTY_TESTNET_EVIDENCE.md). **No WIF token can be selected in the studio; no real WIF bounty, independent audit or mainnet custody is claimed.**

## Complete BTEST bounty lifecycle

The [BTEST-only end-to-end demo](docs/BOUNTY_TESTNET_DEMO.md) now exercises the real `WifSecurityChallenge` settlement code end to end: sponsor deposits, solver commits, two explicit reviewer approvals, payout, invalid-evidence slashing, cancellation, expiry and bond refunds. Synthetic demo actors have separate onchain addresses, but **all are controlled by one operator**. This is not independent security review.

```sh
node script/run-bounty-lifecycle.mjs --local
```

The local runner deploys contracts and advances disposable Anvil time. The public runner targets **only Robinhood Chain Testnet (46630)**, requires the previously authorized `before-testnet` keystore and real block timestamps, and writes public proof metadata only after all signed receipts are verified. The public BTEST-only lifecycle has completed and its receipts are recorded in [BOUNTY_TESTNET_EVIDENCE.md](docs/BOUNTY_TESTNET_EVIDENCE.md); `web/bounty-proof.json` is `verified:true`. No WIF token is funded.

## Protect

BeforeVault accepts a single ERC-20, has an immutable owner and withdrawal destination, and enforces both a maximum amount per transfer and an aggregate spending limit per fixed UTC day. The owner cannot bypass the contract by requesting a larger single transfer or splitting a transfer across the same UTC day. This protects only tokens **inside that vault**, not arbitrary wallet transactions.

## Challenge

TrainingVault intentionally omits the aggregate daily limit. TrainingArena lets anyone demonstrate the error using real mock-token transfers. The arena and training vault are restricted to local chain ID 31337 or Robinhood Chain testnet 46630 and the exact MockERC20 runtime code. The obvious practice solution has no monetary reward.

## Proof

The exercise verifies token balance changes and a one-time solution state using contract execution, not an AI opinion. The verified deployment manifest also lets the app read the actual challenge escrow's record count without enabling WIF funding. Public-chain receipts and immutable-aware bytecode evidence are recorded in [TESTNET_PROOF.md](docs/TESTNET_PROOF.md).

## Reproduce locally

Requires [Foundry](https://getfoundry.sh/) and Node.js.

~~~sh
forge build
forge test --fuzz-runs 1024 -vvv
node --test checks/reference.test.mjs checks/deployment-proof.test.mjs checks/deployment-cli.test.mjs checks/broadcast-args.test.mjs web/test/core.test.mjs web/test/onchain.test.mjs web/test/bounty-core.test.mjs web/test/wif-core.test.mjs
node script/anvil-e2e.mjs
node script/run-bounty-lifecycle.mjs --local
node script/check-chain.mjs
# After installing browser QA dependencies and Chromium:
node qa/verify.mjs
node qa/bounty-e2e.mjs
node qa/wif-verify.mjs
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

**Current approved public site:** https://before-web-theta.vercel.app/

The responsive, dependency-free application at `/app/` has three experiences:

- **Protect:** local, clearly labeled policy preview. No real transaction occurs.
- **Challenge:** local simulation of the intentional split-transfer flaw using mock amounts. The onchain practice path uses BTEST only and pays no bounty.
- **Proof:** live read-only testnet RPC inspection for supplied vault-like addresses and transaction receipts. It does not establish contract authenticity or security.

The web code is in `web/`; the Node test commands cover policy, ABI, deployment-proof and browser-facing logic. GitHub Actions checks Solidity, policy-model, deployment and web tests. CI is at https://github.com/Iniwura/before-protocol/actions.

The security demonstration and Bounty Studio read the verified public testnet deployment through the checked-in manifest. The WIF checker independently reads the official mainnet WIF contract without changing any token permissions or transmitting wallet secrets.

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

The versioned `web/deployment.json` now contains independently verified Robinhood Chain testnet addresses and genuine deployment transaction hashes. The UI exposes only the mock-token Protect/Challenge paths; the WIF-capable escrow remains read-only in the app and receives no WIF funding from the demonstration.

This is not a real-WIF bounty or a mainnet custody release.

See [Phase 3 implementation and deployment gates](docs/PHASE_3.md).

## WIF-funded security challenges

The solver commitment domain includes the escrow address, Robinhood Chain ID, challenge ID, solver address, salt and evidence hash, preventing cross-chain or copied-wallet replay.

`WifSecurityChallenge` is intentionally separate from the public BTEST exercise. A sponsor escrows a chosen ERC-20 reward, records a concrete target contract, its code hash and an immutable hash of the written challenge scope, sets an independently reviewed verifier and a maximum 30-day commit/reveal window, and requires each solver to post a bond. The verifier receives the challenge ID, solver, target and scope hash explicitly, alongside the revealed evidence. A solver commits a hash bound to their wallet, salt and evidence, then reveals after the commit window. Only a verifier-approved reveal receives the reward and bond; invalid evidence slashes the bond to the sponsor; expiry returns the reward and releases unanswered bonds. Settlement fails closed if the target, verifier or reward token code changes. `ReviewedFindingVerifier` provides a fixed reviewer set and threshold that must approve the exact escrow instance, challenge context and evidence hash before settlement.

The contract can hold WIF when configured with the intended Robinhood Chain WIF token, but this repository does not contain a WIF address, private key, funded challenge, or payout claim. The verifier is part of the trust boundary and must bind the supplied challenge ID, solver, target and scope, inspect the target, and receive independent review before any valuable funding.

## Proving a testnet deployment

After a mock-only testnet deployment, `script/verify-testnet.mjs` can check the actual factory, test-token and challenge escrow creation receipts, their contract addresses, 12 confirmation blocks, and immutable-aware runtime provenance against Foundry artifacts. Its full interaction mode also checks the two factory-call receipts, exact calldata and factory event data, deployer-owned registry outputs, created vault/arena constructor state, exact BTEST transfer logs, block-specific 150/130/40 BTEST balances, and public Protect/Challenge receipts for an allowed withdrawal, a denied withdrawal and the 60+50 practice proof. It is read-only and cannot make a false testnet claim from only a pasted address.

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
