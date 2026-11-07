# BEFORE Bounty Studio — testnet user guide

**Preview route:** `/app/bounty/` (available on PR #5's Vercel preview). The existing approved product remains at `/app/`; this feature has not been merged into production.

Bounty Studio uses the **existing verified Robinhood Chain Testnet (chain ID 46630)** challenge escrow and freely mintable **BTEST** token. The app intentionally provides **no WIF token selector and no mainnet option**. Its bounty scope is fixed to the BEFORE training vault; it is not a general-audience security reward marketplace yet.

## The product in one line

**A project posts a BTEST reward → a researcher submits a finding → appointed reviewers assess the evidence → the researcher reveals the approved evidence → the existing escrow settles a valueless test-token reward.**

The landing page now launches the **main Bounty Studio at `/app/bounty/`**. The separate **Protect → Challenge → Proof** flow at `/app/` is an educational demonstration.

When you first open Bounty Studio, you **do not need a wallet**. It asks what you want to accomplish: **Post a reward**, **Submit a finding**, **Review a finding**, or **Recover an unfinished bounty**. Choose one to see only the relevant task. Select **Change what I want to do** to start another task. The proof demo is read-only and wallet-free.

## First time: create a test bounty

1. Use a browser EVM wallet with **Robinhood Chain Testnet ETH** for transaction gas. Open **Bounty Studio**, choose **Create**, and connect the wallet. The app switches to chain 46630 if necessary.
2. Enter 1–3 reviewer wallet addresses **different from the sponsor wallet**. Choose how many of those reviewers must approve (quorum), a BTEST reward and solver bond, and the commit/reveal windows. BTEST is freely minted and has no monetary value.
3. Click **Publish BTEST bounty**. Confirm each required wallet transaction: deploy the approved immutable reviewer gate, mint BTEST if needed, approve **only the exact BTEST reward**, and publish the challenge to the verified escrow. Each receipt is checked for the expected sender, contract and calldata.
4. After creation, BEFORE stays in the sponsor task and displays **Bounty #N is live**, plus separate **Copy researcher link** and **Copy reviewer link** actions. Send each person the appropriate link. No need for the sponsor to switch to the researcher screen.

The app stores the last reviewer-gate address **locally** for reuse only when the reviewer set and quorum still match the chain. No secret keys are stored.

## Solve a bounty

1. Open the shared bounty URL or enter its ID. The app reads the actual reward, bond, deadlines, verifier and status from Robinhood Chain.
2. Switch to **Solve**, connect a **separate solver wallet**, enter a finding description, and click **Generate** for a secure 32-byte random commitment salt.
3. **Copy the recovery key** (the technical term is *commitment salt*) and keep it. Bounty Studio saves it only in your current browser's local storage, keyed by challenge and wallet, to help with a later reveal. It does **not** back it up to a server. Switching browsers or clearing storage can cause loss of your ability to reveal the committed finding unless you saved the salt yourself.
4. Click **Commit finding**. The app derives the solver-bound commitment using the escrow's onchain `commitmentFor`, mints valueless BTEST for the bond if needed, approves the exact bond and submits the commitment.
5. Click **Copy message for reviewer** and send that message privately to the appointed reviewer. BEFORE does not deliver messages for you. After the commit deadline passes **and the configured reviewer quorum has approved this evidence**, reopen the challenge using the original wallet. Reenter the exact evidence, restore your saved salt and click **Reveal & settle**. The app checks the pending commitment, exact digest, reviewer count and block deadline before offering the wallet transaction.

**Important:** The Solidity escrow itself slashes the solver bond if the evidence fails its reviewer gate. BEFORE's UI deliberately blocks a reveal when the required approvals are missing, but a user can still call the contract directly. This is a test-token-only workflow, not a guarantee of paid security review.

## Review a finding

1. Open the same bounty link, switch to **Review** and connect an **appointed reviewer wallet**.
2. Examine the actual source and reproduction evidence offchain. Enter the exact solver address and exact evidence string, then select **Record reviewer approval**.
3. The irreversible approval is bound to the **specific escrow instance, challenge, solver, training target, scope and Keccak-256 evidence hash**. The UI confirms that your wallet is among the appointed reviewers and shows the current reviewer count.

An appointed reviewer can be controlled by the same person as a sponsor or solver if they use different wallets. **A quorum alone is not proof of independent review, a real exploit or an audit.** The separate public pre-recorded demonstration specifically used synthetic reviewers controlled by one operator.

## Cancel or recover

In **Recover**, the UI provides three contract-authorized actions, each requiring the entitled wallet:

- Sponsor: cancel a bounty only before the commit deadline and only when there are **zero commitments**.
- Sponsor: refund an unpaid bounty reward **after the reveal deadline**.
- Solver: refund their **pending bond** only after the contract's expiry or release conditions permit it.

The UI validates chain state first. Every wallet-signed result is linked to its public transaction receipt; failed/reverted receipts never display success.

## Public recorded example and wallet-free exploration

- Go to `/app/` to **Protect → Challenge → Proof**, including the existing verified, public mock-token transaction examples.
- In Bounty Studio select **Inspect completed proof** to view the BTEST-only synthetic lifecycle that finished on 2026-11-06. It uses the same escrow with a different demo scope, so those four historic challenge IDs are not advertised as user-created bounties.
- Read-only challenge inspection does **not** connect a wallet or require gas. Creating, committing, approving, settling and refunding each require wallet confirmation and testnet ETH.

## Security and scope

- Wallet interactions use EIP-1193, explicit Robinhood Chain Testnet chain checks and cross-checked **mined receipt identity, destination, calldata and execution status**.
- The app checks the verified deployment manifest, presence of contract bytecode, and **exact compiled `ReviewedFindingVerifier` runtime with immutable reviewer slots** before enabling a bounty.
- Reviewer contract creation bytecode is pinned in `web/bounty-verifier.json` and tested against the compiler artifact and source hash. Bounty Studio accepts only the deployed, approved runtime and the fixed BTEST training target.
- Findings are committed as **hashes**, then revealed as public bytes after reviewer approval. Don't submit passwords, private data, confidential exploit details or security-sensitive real-world code.
- Local storage is not encrypted or a backup. The salt is a test-token commitment secret only.
- No independently validated vulnerability, real WIF, real bounty payout, security audit, or mainnet custody is claimed.
- Existing public escrow contracts and their deployed bytecode are unchanged.

## Reproducible browser QA

After `forge build` and `npm ci --prefix qa` plus `npx playwright install chromium` from `qa`:

```sh
node --test web/test/bounty-core.test.mjs
node qa/bounty-e2e.mjs
```

The second command starts disposable Anvil **with chain ID 46630** and uses local unlocked Anvil test accounts only. Playwright intercepts RPC requests to route browser wallet actions to that local chain; it does **not** broadcast to public testnet. It executes real contract transactions for:

1. Sponsor deploys reviewer gate, mints/approves BTEST, and creates a challenge.
2. Solver commits with a locally generated salt; early and unapproved reveals are refused.
3. An unappointed reviewer is rejected; the appointed reviewer records approval.
4. The solver reveals and settles after a locally advanced deadline.
5. A second bounty is canceled, and a third completes expiry reward and bond refunds.
6. Final mock escrow balance is checked against zero; all four responsive widths and four role screens receive WCAG accessibility checks.

The public Robinhood testnet already contains a **different, script-generated synthetic bounty lifecycle** with independent public receipt evidence in [BOUNTY_TESTNET_EVIDENCE.md](BOUNTY_TESTNET_EVIDENCE.md). This new self-service wallet UI has passed the local browser-to-Anvil end-to-end path. Do not claim its manual browser wallet path has been independently exercised with new public testnet transactions until such transactions are actually mined and verified.
