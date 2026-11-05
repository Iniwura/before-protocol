# Testnet proof verification

**Deployment is not confirmed yet.** Keep `web/deployment.json` as `verified: false` until deployment evidence is available.

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
7. Only after all checks pass, use the **eleven-argument** command with `--write`. Abbreviated four-, six- and eight-argument forms are dry-run diagnostics and are rejected for manifest writes. Commit the generated `web/deployment.json` in a reviewed PR, never manually invent addresses or hashes.
8. Run the browser mock-wallet test and inspect the actual public chain state before enabling any wallet flow.

## Reproducible local release gate

The repository includes a disposable Anvil integration harness. It runs the real `DeployBefore` script, sends the allowed 20-BTEST withdrawal, the reverted 75-BTEST withdrawal and the 60+50 practice proof, mines confirmation depth, runs the complete eleven-argument verifier with `--local`, then reruns it with swapped receipts and requires rejection:

~~~sh
node script/anvil-e2e.mjs
~~~

This local mode is explicit and can never write `web/deployment.json`. It proves the verifier against actual Anvil-created runtime bytecode, receipts, logs, constructor state and historical balances; mocked RPC tests remain supplemental adversarial coverage.

The verifier never reads private keys or broadcasts transactions; it also never claims to verify real WIF rewards or a security audit. The four-argument form remains available for legacy two-contract evidence, the six-argument form proves the three direct contracts, the eight-argument form proves deployment plus mock-only factory outputs, and the eleven-argument form is the recommended full submission evidence.
