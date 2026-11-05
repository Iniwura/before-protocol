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
node --test checks/reference.test.mjs checks/deployment-proof.test.mjs checks/deployment-cli.test.mjs checks/broadcast-args.test.mjs web/test/core.test.mjs web/test/onchain.test.mjs
node script/anvil-e2e.mjs
npm ci --prefix qa
PLAYWRIGHT_BROWSERS_PATH=/tmp/before-browsers node qa/verify.mjs
node script/check-chain.mjs
~~~

The current checkpoint is 66 Solidity tests, 57 JavaScript checks, a real Anvil deployment/verifier pass with tampered-evidence rejection, 12 accessibility viewport/screen audits, four mocked success-path wallet transactions, three wallet failure paths and zero horizontal-overflow failures. The public mock-only Robinhood deployment also passed the complete eleven-argument verifier; mocked wallet results remain distinct from the public broadcast.

The deployment verifier is read-only. Given direct creation receipts, the two factory-call receipts and three public demo receipts, it checks chain ID 46630, receipt success or intentional revert status, address/hash correspondence, confirmation depth, exact calldata and event data, deployer-owned registry outputs, exact BTEST transfer logs, 150/130/40 block-specific balances, the allowed/denied Protect outcomes, the 60+50 Challenge proof and immutable-aware runtime provenance for `BeforeFactory`, `MockERC20`, `WifSecurityChallenge`, `BeforeVault`, `TrainingArena` and `TrainingVault`:

~~~sh
node script/verify-testnet.mjs \
  0xFACTORY 0xFACTORY_CREATION_TX \
  0xMOCK_TOKEN 0xMOCK_TOKEN_CREATION_TX \
  0xCHALLENGE_ESCROW 0xCHALLENGE_ESCROW_CREATION_TX \
  0xDEMO_FACTORY_TX 0xPRACTICE_FACTORY_TX \
  0xALLOWED_WITHDRAWAL_TX 0xDENIED_WITHDRAWAL_TX 0xPRACTICE_PROOF_TX
~~~

Only after a human checks the explorer source and receipts should `--write` be used. That gate has passed and the checked-in manifest is now verifier-generated with `verified: true`.

## Verified public testnet evidence

The authorized disposable signer was the newly generated `before-testnet` encrypted keystore, address `0xd1061825504b30f404c0d94b745205925f251f2c`. The earlier `0xa35dc047f9937bf668743efbdf8ea93b31a55888` preflight address was not used. All eight deployment and public-flow receipts are sent by the approved `0xd106...f2c` signer.

- [BeforeFactory](https://explorer.testnet.chain.robinhood.com/address/0x3d83AE6f49A913FB51C35E2969592b0f46135e40) · [creation receipt](https://explorer.testnet.chain.robinhood.com/tx/0xae81bd89fb23763a7d73678c6396535fcf3b034fe0d24dd2427fb264ac906d45)
- [MockERC20](https://explorer.testnet.chain.robinhood.com/address/0xf080A1a012F2Dd41c4F416Befd6D70074af75A4C) · [creation receipt](https://explorer.testnet.chain.robinhood.com/tx/0xcaf9787c79e11b11125aae69dd4b2e1dc6f80d11ecc157b48bc3701ab7e88ab3)
- [Empty WifSecurityChallenge](https://explorer.testnet.chain.robinhood.com/address/0xF9d644dd2024E2dFc425aA7c1059F9b4E720684a) · [creation receipt](https://explorer.testnet.chain.robinhood.com/tx/0x1116287d9ad3a4992e0cdaf623de75044732487c2ed5a3db2a2f548ef591b15a)
- [Protect DemoVault](https://explorer.testnet.chain.robinhood.com/address/0xFCd5Ee59136c3e2E0775908Fa703c1e7A44Fa1e9) · [factory receipt](https://explorer.testnet.chain.robinhood.com/tx/0x8354ffe516920b98a4885d3c4b543e3ab9ca5572d1393aec686af6aba48cf45b)
- [Challenge Arena](https://explorer.testnet.chain.robinhood.com/address/0x0957593d029893340a783Aa76dA07a28b2b2a2f6) · [factory receipt](https://explorer.testnet.chain.robinhood.com/tx/0x380af0d6be900efc784dd80d650a3fdfc6727da1c52cbac4b861dc24c6baad9f)
- [PracticeVault](https://explorer.testnet.chain.robinhood.com/address/0x7e29bC6Df38e60E77513bc1084dB488FeE12947C)
- Public flows: [allowed 20 BTEST](https://explorer.testnet.chain.robinhood.com/tx/0x49ab86e469b83c7f02a01b0765973e213ba894cbbd6f37f6af17d0e84ae23b3c), [denied 75 BTEST, status `0x0`](https://explorer.testnet.chain.robinhood.com/tx/0xf40bd10c748f6bf60cdb4c12382b414478210c4875bcb3899792e16f425aaf04), [60+50 practice proof](https://explorer.testnet.chain.robinhood.com/tx/0x4b002674e855aea3f2ba526b1028043603a2facca6e6c7d465742f7100fbe901)

## Safe judge demo

1. Open the deployed static site and start on **Protect**. Use the local policy preview to show a 75-token request being blocked, then show an approved 20-token request within the 60/100 policy.
2. Open **Challenge** and submit 60 + 50. The browser explains that both individual transfers pass while the combined amount exceeds the intended daily cap.
3. If the deployment manifest is verified, **Challenge** also shows the actual security escrow's read-only record count. It does not create a challenge, fund WIF or imply a payout.
4. Open **Proof** and refresh the network. The verified manifest now points to the public demo vault, practice arena and receipts; the chain inspection remains read-only.
5. The public demonstration is already recorded above. Any further wallet interaction must use a disposable testnet wallet and remains outside this release evidence.

Do not describe the local preview or mocked wallet run as a real transaction. Do not present the practice arena as a paid bounty.

## WIF challenge gate

`WifSecurityChallenge` is a separate reward escrow that can hold WIF when configured with the intended token address. Each challenge anchors a target contract, target code hash and immutable hash of the written scope. It uses exact source-and-recipient ERC-20 accounting, a solver-bound commit/reveal, a solver bond, a bounded 30-day window, verifier and target code-hash pinning, first-valid settlement, invalid-proof slashing, cancellation and expiry recovery. `ReviewedFindingVerifier` supplies a fixed reviewer quorum for the exact escrow instance, context and evidence hash.

It is not a security oracle. The verifier must bind the supplied challenge ID, solver, target and scope, inspect the intended target, and be independently reviewed. The current submission contains no WIF address, private key, funded challenge or payout claim. A disposable testnet broadcast still needs test ETH and a user-controlled signature; valuable challenge funding needs a separate explicit approval.

## Claim language

Use: “BEFORE has a tested, fail-closed mock-only Robinhood testnet demonstration and a WIF-capable escrow design; the empty escrow is not funded and no reward or audit claim is made.”

Avoid: “audited,” “mainnet-ready,” “paid bounty,” “deployed,” or “real WIF reward” until the corresponding evidence is public and independently checked.
