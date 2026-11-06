# BEFORE mock-bounty end-to-end demo

## Truthful scope

This is a **testnet BTEST settlement demonstration**, not an independently validated security-bounty program. The existing production WIF-capable escrow, publicly deployed on Robinhood Chain **testnet** (46630), can hold ERC-20 tokens. This runner uses only the **freely mintable, valueless BTEST** and the deliberately vulnerable training vault.

The demo deploys one `BountyLifecycleDemo` coordinator. It creates separate onchain sponsor, solver and two reviewer actor contracts, **all controlled by the same authorized operator**. This is genuine onchain execution of escrow role checks, quorum approvals and accounting, but **not independent human review** of a finding. The public UI says so.

No real WIF is deposited, spent or promised. No mainnet transactions or real-value custody are authorized.

## Lifecycle proven

The runner creates four isolated BTEST challenges in the existing escrow.

| Challenge | Outcome | Evidence |
|---|---|---|
| Valid synthetic finding | Two demo reviewer approvals, solver-bound commit/reveal, 100 BTEST + 10 BTEST bond paid to solver | `RewardPaid` event and final actor balances |
| Invalid evidence | No reviewer quorum, bond of 10 BTEST slashed to sponsor | `InvalidEvidence` |
| Unanswered commitment | 100 BTEST reward returned after reveal expiry and 10 BTEST solver bond refunded | `ChallengeExpired` + `BondRefunded` |
| Uncommitted challenge | Sponsor cancels; 100 BTEST reward returned | `ChallengeCanceled` |

After the invalid challenge also expires, `cleanup()` refunds its 100 BTEST reward. The coordinator enforces **exact** synthetic-role balances and verifies that its BTEST escrow contribution is fully unwound.

## CI and locally reproducible proof

```sh
forge build
forge test --match-path test/BountyLifecycleDemo.t.sol -vvv
node script/run-bounty-lifecycle.mjs --local
```

The local script starts disposable Anvil chain ID 31337, deploys fresh mock token, escrow, training target and demo coordinator; uses unlocked **only on its private localhost Anvil**; advances only the local clock; and independently checks receipts, operator identities, state transitions and BTEST balances. It writes `out/bounty-local-report.json`, which is **not** public testnet evidence.

The CI workflow runs the local script and fails if the whole lifecycle or accounting check fails.

## Real Robinhood testnet broadcast using the previously authorized signer

**Only run from the operator's local Codex environment**, where the encrypted `before-testnet` Foundry keystore is already authorized. The script rejects other chain IDs, any RPC other than `https://rpc.testnet.chain.robinhood.com`, a signer other than `0xd1061825504b30f404c0d94b745205925f251f2c`, and anything other than the exact compiled `MockERC20` and escrow bytecode. Testnet ETH for gas is required.

Set `BEFORE_KEYSTORE_PASSWORD_FILE` to an existing **local, access-controlled** password-file path. Never paste passwords, seed phrases, private keys or the file contents into chats, logs, GitHub Actions or the repository.

```sh
BEFORE_SIGNER_ACCOUNT=before-testnet \
BEFORE_KEYSTORE_PASSWORD_FILE=/path/to/local/secret-password-file \
node script/run-bounty-lifecycle.mjs --testnet
```

The script automatically:

1. Checks chain and signer, plus all three live contract addresses from the committed `web/deployment.json`.
2. Deploys only the synthetic actor coordinator, with an irreversible BTEST runtime code-hash guard.
3. Calls `start()` on the public testnet (four mock challenges, three commitments, two synthetic reviewer approvals, one cancellation).
4. Waits for **real public block timestamps**; never attempts time travel on testnet.
5. Calls `settle()` (approved payment, invalid-proof slashing, expired reward and bond refunds).
6. Waits for the second public deadline and calls `cleanup()` (final invalid-case refund).
7. Requires a successful transaction receipt from the authorized operator for each step, the correct bound contracts, exact stage 3 and the expected mock-token accounting.
8. Writes `out/bounty-testnet-report.json` and a small `web/bounty-proof.json` **only after all public checks pass**.

The runner keeps non-secret resume state in `out/bounty-testnet-progress.json` after each broadcast. Re-running resumes the existing coordinator instead of opening duplicate challenges. Do not delete the progress file while running. It contains public addresses and transaction hashes only.

**Review and commit `web/bounty-proof.json` only after independent receipt checks.** Until then its committed value is `verified:false`; the app deliberately hides the bounty evidence panel.

## What the product verifies

After approved publication of the proof file, `/app/#challenge` checks the chain ID, signer, escrow/token/target contract bindings, deployed code, coordinator stage 3, and all three public lifecycle transaction/receipt pairs before showing the read-only receipt trail. A static JSON flag alone never unlocks a payout claim.

Keep the language explicit: “A BTEST-only synthetic-reviewer lifecycle succeeded on Robinhood testnet. No real $WIF was funded and no independent vulnerability review was performed.”

## Remaining production gates

Independent security review, concrete scope and evidence validation, real reviewer identities, payout and dispute policies, and separate explicit WIF funding approval remain required before any valuable token can safely enter custody.
