# Testnet proof verification

**Deployment is not confirmed yet.** Keep `web/deployment.json` as `verified: false` until deployment evidence is available.

After the mock-only contracts have been deployed using a dedicated testnet-only wallet:

1. Compile the exact repository commit using `forge build`.
2. Collect the Robinhood Chain testnet factory, MockERC20 and empty `WifSecurityChallenge` **creation receipts**, plus the `createDemoVault` and `createPractice` factory-call receipts. The first three hashes must be direct contract creations; the final two are successful factory interactions from the same deployer.
3. Run the read-only verifier:

   ```sh
   node script/verify-testnet.mjs \
     0xFACTORY_ADDRESS 0xFACTORY_CREATION_TX \
     0xMOCK_TOKEN_ADDRESS 0xMOCK_TOKEN_CREATION_TX \
     0xCHALLENGE_ESCROW_ADDRESS 0xCHALLENGE_ESCROW_CREATION_TX \
     0xDEMO_FACTORY_TX 0xPRACTICE_FACTORY_TX
   ```

4. It checks chain ID 46630, successful creation and interaction receipts, contract addresses, at least 12 blocks of depth, exact calldata, deployer-owned factory registry outputs, 150-BTEST balances, and **exact runtime bytecode equality** with the locally compiled Foundry artifacts for the three direct contracts plus the created `BeforeVault`, `TrainingArena` and `TrainingVault`.
5. Review the Blockscout receipts and explorer verified source independently. A bytecode match is provenance evidence, **not** a security audit.
6. Only after all checks pass, use the same command with `--write`. Commit the generated `web/deployment.json` in a reviewed PR, never manually invent addresses or hashes.
7. Run the browser mock-wallet test and inspect the actual public chain state before enabling any wallet flow.

The verifier never reads private keys or broadcasts transactions; it also never claims to verify real WIF rewards or a security audit. The four-argument form remains available for legacy two-contract evidence, the six-argument form proves the three direct contracts, and the eight-argument form is the recommended submission evidence.
