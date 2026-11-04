# Hackathon submission runbook

BEFORE is a three-screen Robinhood Chain experience:

1. **Protect** shows the policy a deployed `BeforeVault` enforces: fixed recipient, 60-token transfer cap and 100-token UTC-day cap.
2. **Challenge** teaches the missing cumulative rule with an isolated BTEST-only practice arena. It is intentionally easy and never pays a reward.
3. **Proof** reads the live chain, vault state and transaction receipts without a wallet. When a verified deployment manifest is present, the page also shows the separately deployed challenge escrow and unlocks only the testnet BTEST demo actions.

## What is independently verifiable now

From the repository root:

~~~sh
forge build
forge test --fuzz-runs 1024 -vvv
node --test checks/reference.test.mjs checks/deployment-proof.test.mjs checks/deployment-cli.test.mjs web/test/core.test.mjs web/test/onchain.test.mjs
npm ci --prefix qa
PLAYWRIGHT_BROWSERS_PATH=/tmp/before-browsers node qa/verify.mjs
node script/check-chain.mjs
~~~

The current local checkpoint is 61 Solidity tests, 46 JavaScript checks, 12 accessibility viewport/screen audits, four mocked wallet flows and zero horizontal-overflow failures. Mocked wallet results are not blockchain broadcasts.

The deployment verifier is read-only. Given direct creation receipts, it checks chain ID 46630, receipt success, address/hash correspondence, confirmation depth and exact runtime bytecode for `BeforeFactory`, `MockERC20` and `WifSecurityChallenge`:

~~~sh
node script/verify-testnet.mjs \
  0xFACTORY 0xFACTORY_CREATION_TX \
  0xMOCK_TOKEN 0xMOCK_TOKEN_CREATION_TX \
  0xCHALLENGE_ESCROW 0xCHALLENGE_ESCROW_CREATION_TX
~~~

Only after a human checks the explorer source and receipts should `--write` be used. The checked-in manifest is intentionally `verified: false` until that evidence exists.

## Safe judge demo

1. Open the deployed static site and start on **Protect**. Use the local policy preview to show a 75-token request being blocked, then show an approved 20-token request within the 60/100 policy.
2. Open **Challenge** and submit 60 + 50. The browser explains that both individual transfers pass while the combined amount exceeds the intended daily cap.
3. Open **Proof** and refresh the network. A connected testnet result is read-only; paste only a known public vault address or transaction hash.
4. After verified testnet evidence is available, connect a disposable wallet with test ETH, create the BTEST demo vault, withdraw 20 BTEST, create a fresh practice arena and submit the 60 + 50 proof. Every wallet transaction sends zero native ETH value and the UI links to the receipt.

Do not describe the local preview or mocked wallet run as a real transaction. Do not present the practice arena as a paid bounty.

## WIF challenge gate

`WifSecurityChallenge` is a separate reward escrow that can hold WIF when configured with the intended token address. Each challenge anchors a target contract, target code hash and immutable hash of the written scope. It uses exact source-and-recipient ERC-20 accounting, a solver-bound commit/reveal, a solver bond, a bounded 30-day window, verifier and target code-hash pinning, first-valid settlement, invalid-proof slashing, cancellation and expiry recovery. `ReviewedFindingVerifier` supplies a fixed reviewer quorum for the exact escrow instance, context and evidence hash.

It is not a security oracle. The verifier must bind the supplied challenge ID, solver, target and scope, inspect the intended target, and be independently reviewed. The current submission contains no WIF address, private key, funded challenge or payout claim. A disposable testnet broadcast still needs test ETH and a user-controlled signature; valuable challenge funding needs a separate explicit approval.

## Claim language

Use: “BEFORE has a tested, fail-closed deployment proof path and a WIF-capable escrow design; testnet and reward evidence are shown only after public receipts and verified source are recorded.”

Avoid: “audited,” “mainnet-ready,” “paid bounty,” “deployed,” or “real WIF reward” until the corresponding evidence is public and independently checked.
