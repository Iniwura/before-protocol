# Testnet proof verification

**Current status — 2026-11-05:** the mock-only Robinhood Chain testnet deployment and the complete eleven-argument verifier have passed against the public chain. `web/deployment.json` was generated with `--write` only after the live checks passed. This is provenance and flow evidence, not a security audit or a WIF-funding claim.

## Authorized signer reconciliation

The earlier preflight record named `0xa35dc047f9937bf668743efbdf8ea93b31a55888`. The explicitly approved disposable wallet for the actual broadcast was the newly generated encrypted Foundry keystore `before-testnet`, which resolves to `0xd1061825504b30f404c0d94b745205925f251f2c`. A read-only check of all eight public deployment/demo transactions confirms that they were sent by `0xd106...f2c`; `0xa35...5888` was not used. No additional signing or broadcast is required for this release.

## Verified public evidence

Explorer: <https://explorer.testnet.chain.robinhood.com> · RPC chain ID: `46630`

| Item | Address | Public receipt |
| --- | --- | --- |
| MockERC20 | [0xf080A1a012F2Dd41c4F416Befd6D70074af75A4C](https://explorer.testnet.chain.robinhood.com/address/0xf080A1a012F2Dd41c4F416Befd6D70074af75A4C) | [creation](https://explorer.testnet.chain.robinhood.com/tx/0xcaf9787c79e11b11125aae69dd4b2e1dc6f80d11ecc157b48bc3701ab7e88ab3) |
| BeforeFactory | [0x3d83AE6f49A913FB51C35E2969592b0f46135e40](https://explorer.testnet.chain.robinhood.com/address/0x3d83AE6f49A913FB51C35E2969592b0f46135e40) | [creation](https://explorer.testnet.chain.robinhood.com/tx/0xae81bd89fb23763a7d73678c6396535fcf3b034fe0d24dd2427fb264ac906d45) |
| Empty WifSecurityChallenge | [0xF9d644dd2024E2dFc425aA7c1059F9b4E720684a](https://explorer.testnet.chain.robinhood.com/address/0xF9d644dd2024E2dFc425aA7c1059F9b4E720684a) | [creation](https://explorer.testnet.chain.robinhood.com/tx/0x1116287d9ad3a4992e0cdaf623de75044732487c2ed5a3db2a2f548ef591b15a) |
| Protect DemoVault | [0xFCd5Ee59136c3e2E0775908Fa703c1e7A44Fa1e9](https://explorer.testnet.chain.robinhood.com/address/0xFCd5Ee59136c3e2E0775908Fa703c1e7A44Fa1e9) | [factory creation](https://explorer.testnet.chain.robinhood.com/tx/0x8354ffe516920b98a4885d3c4b543e3ab9ca5572d1393aec686af6aba48cf45b) |
| Challenge Arena | [0x0957593d029893340a783Aa76dA07a28b2b2a2f6](https://explorer.testnet.chain.robinhood.com/address/0x0957593d029893340a783Aa76dA07a28b2b2a2f6) | [factory creation](https://explorer.testnet.chain.robinhood.com/tx/0x380af0d6be900efc784dd80d650a3fdfc6727da1c52cbac4b861dc24c6baad9f) |
| PracticeVault | [0x7e29bC6Df38e60E77513bc1084dB488FeE12947C](https://explorer.testnet.chain.robinhood.com/address/0x7e29bC6Df38e60E77513bc1084dB488FeE12947C) | created by the Challenge Arena receipt |

Public flow receipts: [allowed 20 BTEST withdrawal](https://explorer.testnet.chain.robinhood.com/tx/0x49ab86e469b83c7f02a01b0765973e213ba894cbbd6f37f6af17d0e84ae23b3c), [denied 75 BTEST withdrawal](https://explorer.testnet.chain.robinhood.com/tx/0xf40bd10c748f6bf60cdb4c12382b414478210c4875bcb3899792e16f425aaf04) (status `0x0`), and [60+50 BTEST practice proof](https://explorer.testnet.chain.robinhood.com/tx/0x4b002674e855aea3f2ba526b1028043603a2facca6e6c7d465742f7100fbe901).

The live verifier checks exact receipt/transaction identity, direct runtime bytecode, immutable constructor state, factory events and registries, token transfer logs, and historical balances: 150 BTEST at creation, 130 after the allowed Protect withdrawal, unchanged after the reverted withdrawal, and 40 after the practice proof. It also confirms the practice arena received 110 BTEST and is solved.

After the mock-only contracts have been deployed using a dedicated testnet-only wallet:

1. Compile the exact repository commit using `forge build`.
2. Collect the Robinhood Chain testnet factory, MockERC20 and empty `WifSecurityChallenge` **creation receipts**, plus the `createDemoVault` and `createPractice` factory-call receipts. For the full release gate, also collect one successful 20-BTEST withdrawal, one reverted 75-BTEST withdrawal and one successful 60+50 practice proof. The first three hashes must be direct contract creations; the final five are public user-flow receipts.
3. Run the read-only verifier:

   ```sh
   node script/verify-testnet.mjs \
     0xFACTORY_ADDRESS 0xFACTORY_CREATION_TX \
     0xMOCK_TOKEN_ADDRESS 0xMOCK_TOKEN_CREATION_TX \
     0xCHALLENGE_ESCROW_ADDRESS 0xCHALLENGE_ESCROW_CREATION_TX \
     0xDEMO_FACTORY_TX 0xPRACTICE_FACTORY_TX \
     0xALLOWED_WITHDRAWAL_TX 0xDENIED_WITHDRAWAL_TX 0xPRACTICE_PROOF_TX
   ```

4. It checks chain ID 46630, successful creation and interaction receipts, the intentional denied-transfer revert, contract addresses, at least 12 blocks of depth, exact calldata and `VaultCreated` / `PracticeCreated` / `Withdrawn` / `SplitLimitBypassProved` event data, deployer-owned factory registry outputs, exact BTEST `Transfer` logs, and the solved practice state. For `BeforeVault`, `TrainingArena` and `TrainingVault`, Solidity's compiler-declared `immutableReferences` are applied explicitly: every byte outside immutable slots must match the local artifact, while every immutable slot must match independently read constructor state and the approved policy values. This rejects modified runtime code and incorrect constructor configuration without comparing zero placeholders to patched deployed bytecode.
5. It reads balances at the relevant receipt blocks rather than treating `latest` as the initial state: both factory-created vaults must be 150 BTEST at creation, the protected vault must be 130 BTEST after the successful 20-BTEST withdrawal and remain 130 after the reverted 75-BTEST attempt, and the practice vault must be 40 BTEST after the 60+50 bypass. The verifier also checks the 20-BTEST recipient delta and the two practice transfer deltas independently.
6. Review the Blockscout receipts and explorer verified source independently. A bytecode match is provenance evidence, **not** a security audit.
7. Only after all checks pass, use the **eleven-argument** command with `--write`. Abbreviated four-, six- and eight-argument forms are dry-run diagnostics and are rejected for manifest writes. This gate has now passed; the checked-in manifest contains the verifier-generated public addresses and hashes with `verified: true`.
8. Run the browser mock-wallet test and inspect the actual public chain state before enabling any wallet flow.

## Reproducible local release gate

The repository includes a disposable Anvil integration harness. It runs the real `DeployBefore` script, sends the allowed 20-BTEST withdrawal, the reverted 75-BTEST withdrawal and the 60+50 practice proof, mines confirmation depth, runs the complete eleven-argument verifier with `--local`, then reruns it with swapped receipts and requires rejection:

~~~sh
node script/anvil-e2e.mjs
~~~

This local mode is explicit and can never write `web/deployment.json`. It proves the verifier against actual Anvil-created runtime bytecode, receipts, logs, constructor state and historical balances; mocked RPC tests remain supplemental adversarial coverage.

The verifier never reads private keys or broadcasts transactions; it also never claims to verify real WIF rewards or a security audit. The four-argument form remains available for legacy two-contract evidence, the six-argument form proves the three direct contracts, the eight-argument form proves deployment plus mock-only factory outputs, and the eleven-argument form is the recommended full submission evidence.
