# BEFORE

**Know who you're paying. Verify what you're sending. Prove what happened.**

**Current release:** Engineering build frozen on November 8, 2026. [Release freeze and verified evidence](docs/ENGINEERING_RELEASE_FREEZE_2026-11-08.md) · [Current submission packet](docs/WORLD_IS_FLAT_SUBMISSION_PACKET.md). Demo and organizer submission are separate pending steps.

BEFORE is a [World Is Flat](https://worldisflat.fun/build) Robinhood Chain product combining **noncustodial $WIF payments and repeat voluntary support with verifiable receipts**, **read-only WIF spending-permission checks**, and a separate **BTEST-only security bounty** on testnet.

On November 8, BEFORE Support exercised the deployed product with **two real WIF mainnet payments**, each of exactly 200 WIF, documented with public receipts in [Issue #18 evidence](docs/ISSUE_18_MAINNET_SUPPORT_EVIDENCE.md). The controlled signer was automated local-wallet acceptance rather than a human wallet-extension click; the two transfers do not prove sustained user retention.

For WIF holders, BEFORE inspects an identified wallet/spender allowance against the official $WIF token contract without wallet connection, signing or custody. For builders and researchers, the Bounty Studio demonstrates sponsor → researcher → appointed reviewer → verifiable settlement using valueless BTEST. The optional Protect → Challenge → Proof training experience shows enforceable policy vaults, intentional vulnerabilities and actual testnet receipts.

> **Scope:** BEFORE Pay prepares standard WIF transfers for explicit confirmation by the payer's own wallet; it never holds keys or tokens or initiates transfers automatically. No real-WIF transaction has been broadcast or independently proven through BEFORE Pay at this release checkpoint. The permission checker only reads mainnet state; PR #7's optional revocation is not part of this release. Bounty contracts are unaudited and testnet-only. Public BTEST Challenge #7 was completed with three authorized testnet accounts controlled by one operator, not independent human security reviewers.

## Product routes

- **Landing:** https://before-web-theta.vercel.app/
- **BEFORE Pay (mainnet $WIF, human-confirmed):** https://before-web-theta.vercel.app/app/pay/
- **BEFORE Support (mainnet $WIF, human-confirmed per cycle):** https://before-web-theta.vercel.app/app/support/
- **Bounty Studio (main guided app, testnet-only):** https://before-web-theta.vercel.app/app/bounty/
- **WIF Permission Check (mainnet, read-only):** https://before-web-theta.vercel.app/app/wif/
- **Protect → Challenge → Proof demonstration:** https://before-web-theta.vercel.app/app/

The website uses dependency-free static routes. Legacy `/#protect`, `/#challenge`, and `/#proof` links redirect to the corresponding section of `/app/`. Contracts, chain IDs and proof manifests are fixed to their documented networks. The source is public, and the mainnet WIF reader uses the official `0x5173b8eA6923c2d40267890D45C46a3480954773` token contract on chain **4663**. The bounty and training contracts use Robinhood Testnet **46630** only.

See [WIF Permission Check](docs/WIF_PERMISSION_CHECK.md), [Bounty Studio guide](docs/BOUNTY_STUDIO.md) and [public testnet evidence](docs/BOUNTY_TESTNET_EVIDENCE.md).

## BEFORE Pay: request → check → pay → proof

The recipient connects their wallet and signs an EIP-712 payment request for an exact WIF amount and expiry. They share a link; the payer verifies its signature, recipient, official token and network, checks wallet balance and gas, and **explicitly confirms** an ERC-20 transfer in their own wallet. Once mined, BEFORE verifies the exact transaction, receipt, confirmation depth and WIF Transfer log. No custody, spending approval or automatic payments.

The browser prevents a second Pay action after a submitted or uncertain wallet attempt, even when receipt verification is delayed or the page reloads. This is a client-side safeguard, **not** globally enforced one-time invoice settlement: the same request can be paid more than once on a different device or with another wallet. A real payment incurs mainnet gas, is irreversible, and has not yet been exercised with real WIF through this application. Read the [Pay security and release limits](docs/WIF_PAY_SECURITY_AND_RELEASE.md).

## BEFORE Support: a repeat-use WIF page

The `/app/support/` route reuses Pay's exact mainnet preflight, transfer and receipt-proof boundary for a smaller repeat-use loop. A creator signs a distinct `SupportOffer` binding the official WIF contract, recipient, amount, voluntary return cadence, at most 120-day expiry and campaign ID. A supporter sees the full offer, starts a new cycle deliberately, confirms a fresh standard WIF transfer in their own wallet and can return to the same page to inspect device-local receipts. “Support again” is available only after verified proof and never schedules a payment.

Pending, uncertain, rejected or reloaded cycles remain locked; receipt retries are read-only. Device-local history is revalidated against public RPC before display, but it is not a global ledger or cross-device duplicate-prevention mechanism. Cadence is a date suggestion shown on the device, not a notification or subscription. Signed support offers stay valid until their expiry (at most 120 days); they cannot be revoked early, so creators should choose an appropriate expiration. On November 8, 2026, BEFORE Support completed two real 200-WIF contributions using a controlled local automated EIP-1193 signer through the live production route. Both public mainnet receipts and official WIF `Transfer` logs were independently checked by the acceptance runner; the second used a fresh signed offer after a timeout in the first browser proof wait. This demonstrates genuine WIF movement, **not** organic retention or a human extension-click journey. See [Issue #18 mainnet evidence](docs/ISSUE_18_MAINNET_SUPPORT_EVIDENCE.md). See [Support security and release gate](docs/BEFORE_SUPPORT_SECURITY_AND_RELEASE.md).

## Real WIF utility: read-only permission inspection

Paste a confirmed WIF `approve(spender, amount)` transaction hash or enter a wallet address and a specific spender. BEFORE checks the token contract's current `allowance(owner, spender)` and `balanceOf(owner)` at the same mainnet block. It makes large permissions readable, shows whether spender bytecode exists, links the approval and wallet addresses to the public explorer, and refuses mismatched network/token data. Nothing is signed, sent, revoked or deposited. An allowance of zero applies **only to the selected spender**.

The permission checker was exercised against the real Robinhood mainnet RPC in Chromium and is covered by independent ABI tests and 320/375/768/1280px accessibility regressions. Read [exact capabilities and limits](docs/WIF_PERMISSION_CHECK.md).

## Guided application and Bounty Studio

The landing page opens **BEFORE Pay** first for WIF utility. **Bounty Studio at `/app/bounty/`** is a separate, valueless BTEST research and proof experience. New users first choose what they want to do: **Post a reward**, **Submit a finding**, **Review a finding**, or **Recover an unfinished deposit**. BEFORE shows one task at a time, asks for a wallet only when an action needs signing, and gives the sponsor distinct researcher/reviewer links after creation. Its core workflow is **post a BTEST reward → submit a finding → reviewer checks and approves → researcher reveals → escrow settles**. The separate **Protect → Challenge → Proof educational demonstration** remains at `/app/` and needs no wallet for simulations and public receipts.

Bounty Studio uses the existing testnet escrow, freely mintable BTEST and the fixed training-vault target. A sponsor can deploy a per-bounty, immutable `ReviewedFindingVerifier` with chosen reviewer wallets and a quorum, mint and approve the exact mock reward, and open a timed challenge. A different solver wallet can commit a private evidence hash and BTEST bond. Appointed reviewers can record their approval of the exact context and evidence; the solver can reveal and settle only during the reveal window with the required approvals. Sponsors/solvers can cancel or recover expired funds when onchain conditions allow.

The **full wallet workflow** passed real local Anvil transactions in Playwright across sponsor, solver and reviewer wallets, including reviewed payout, unappointed-reviewer rejection, premature and unapproved reveal protection, cancellation and expiry refunds, with no remaining test escrow BTEST. The UI-driven lifecycle remains verified locally. Separately, a **public BTEST Challenge #7** was created, committed, approved and settled on Robinhood Testnet with three distinct authorized wallets through a script-driven test. See the [read-only public audit](docs/ISSUE_8_PUBLIC_TESTNET_EVIDENCE.md). This is not evidence of a real WIF transfer or an independent human review.

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
node --test checks/reference.test.mjs checks/deployment-proof.test.mjs checks/deployment-cli.test.mjs checks/broadcast-args.test.mjs web/test/core.test.mjs web/test/onchain.test.mjs web/test/pay-core.test.mjs web/test/support-core.test.mjs web/test/bounty-core.test.mjs web/test/wif-core.test.mjs
node script/anvil-e2e.mjs
node script/run-bounty-lifecycle.mjs --local
node script/check-chain.mjs
# After installing browser QA dependencies and Chromium:
node qa/verify.mjs
node qa/pay-e2e.mjs
node qa/support-e2e.mjs
node qa/bounty-e2e.mjs
node qa/wif-verify.mjs
# Read-only public Robinhood testnet audits:
node qa/issue-8-public-testnet-audit.mjs
node qa/issue-8-fresh-bounty-audit.mjs
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

## BEFORE Pay — deployed, mainnet-aware and noncustodial

The deployed `/app/pay/` route provides a focused request → check → pay → proof flow for the official WIF token on Robinhood Chain mainnet. A recipient signs an EIP-712 exact-amount request; a payer independently verifies the recipient, token, chain, balance and gas before an explicit standard ERC-20 transfer. Public proof rechecks the mined transaction and WIF `Transfer` event. After send intent, the request/hash is persisted in the URL, Pay stays locked through delayed receipts and reloads, and retry is read-only; generic ERC-20 transfers still cannot enforce unique invoice settlement outside this flow. The automated flow uses mock wallets and RPC only; it never broadcasts real WIF. See [WIF_PAY_SECURITY_AND_RELEASE.md](docs/WIF_PAY_SECURITY_AND_RELEASE.md) for the threat model and owner-controlled real-WIF gate.

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

The escrow contract is ERC-20-configurable, but the released public Bounty Studio uses only valueless BTEST on testnet. The repository does pin the official Robinhood mainnet WIF contract for the separate noncustodial Pay, Support and read-only permission-check flows; that is **not** a WIF-funded escrow or mainnet policy-vault deployment. No real-WIF security bounty, audited challenge, or WIF reward payout is claimed. The verifier remains a trust boundary and would require independent review before any valuable escrow funding.

## Proving a testnet deployment

After a mock-only testnet deployment, `script/verify-testnet.mjs` can check the actual factory, test-token and challenge escrow creation receipts, their contract addresses, 12 confirmation blocks, and immutable-aware runtime provenance against Foundry artifacts. Its full interaction mode also checks the two factory-call receipts, exact calldata and factory event data, deployer-owned registry outputs, created vault/arena constructor state, exact BTEST transfer logs, block-specific 150/130/40 BTEST balances, and public Protect/Challenge receipts for an allowed withdrawal, a denied withdrawal and the 60+50 practice proof. It is read-only and cannot make a false testnet claim from only a pasted address.

The same eleven-argument verifier is exercised against real local Anvil state by `node script/anvil-e2e.mjs`; genuine evidence must pass and swapped receipts must fail. Local evidence is never eligible to enable the hosted manifest.

**A mock-only testnet deployment is claimed here.** Verified metadata is `true` because the public eleven-argument evidence passed. This is not an audit, a WIF payout or a mainnet release.

[Read the testnet proof process](docs/TESTNET_PROOF.md).

## Engineering freeze and hackathon handoff — November 8, 2026

1. **Already proven:** deployed Pay and Support, two public mainnet WIF Support receipts, independent receipt checks, public source, and green CI. These payments were executed with an automated local signer; the separate one-off Pay page and same-offer “Support again” live experience do not have an independently recorded mainnet wallet-extension run.
2. **Next:** record an authentic Support-first 1080p demo, prioritizing verified payments and the user workflow, honestly separating automated acceptance and simulated-browser checks.
3. **Then:** verify the logged-in organizer form, category, actual cutoff and video-hosting requirements; submit and preserve the submission confirmation. The organizer has announced **November 12, 2026, 17:30 UTC** as the cutoff.
4. **Keep production online through finals:** November 16, 2026. Do not make unreviewed security or UI changes or spend additional WIF for show.

[Deployment](docs/DEPLOYMENT.md) · [Security boundaries](docs/SECURITY_NOTES.md) · [WIF challenge design](docs/WIF_CHALLENGE_DESIGN.md) · [Verification](docs/VERIFICATION.md) · [Submission runbook](docs/SUBMISSION.md) · [Phase 1](docs/PHASE_1.md) · [Phase 2](docs/PHASE_2.md)
