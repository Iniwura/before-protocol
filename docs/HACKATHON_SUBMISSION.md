# World Is Flat submission packet

Copy-ready material for the [World Is Flat hackathon](https://worldisflat.fun/build). This packet describes the verified mock-only Robinhood Chain testnet demonstration; it makes no WIF-funding, audit or mainnet claim.

## Project fields

**Name:** BEFORE

**Tagline:** Evidence-bound ERC-20 protection and security bounties for Robinhood Chain.

**Categories:** Tools and infrastructure · Consumer and payments

**About:** BEFORE makes token safety inspectable. Protect demonstrates an immutable per-transfer and daily spending policy. Challenge isolates the missing cumulative rule in a mock-only training vault. Proof lets anyone inspect the chain, contract state and receipts without a wallet.

The production mechanism is a separate ERC-20 escrow for meaningful security findings. A sponsor pins the target contract, runtime code, written scope, verifier and reward token. Solvers use a wallet-bound commit/reveal and bond; a fixed reviewer quorum approves the exact evidence before settlement. Invalid evidence loses only the bond, expiry returns funds, and code changes fail closed.

**Product preview:** https://before-1xhzzheka-iniwura-akurus-projects.vercel.app/

**Source:** https://github.com/Iniwura/before-protocol

**Verification PR:** https://github.com/Iniwura/before-protocol/pull/3

## Judge flow

1. **Protect:** submit 75 with 40 already spent to see the 60-token transfer cap block the request; submit 20 to see an allowed local policy result.
2. **Challenge:** submit 60 + 50. Each transfer is individually valid, but the combined amount exceeds the 100-token daily limit. With a verified manifest, the screen also reads the actual security escrow's record count without creating or funding a WIF challenge.
3. **Proof:** inspect the read-only network state, then use the verified manifest path to inspect the demo vault, practice arena and public receipt evidence.

## Evidence checkpoint

- 66 Solidity tests, including adversarial accounting, cross-chain and copied-wallet replay, expiry, verifier quorum, code-pinning, transfer-callback mutation and empty-evidence cases.
- 57 JavaScript checks, including immutable-aware runtime proof, historical-balance proof, exact deployment receipt/event/runtime proof and public broadcast extraction checks.
- Browser QA: 12 responsive/accessibility audits plus 3 complete-manifest accessibility states, zero violations, no horizontal overflow, mocked wallet success and failure paths.
- [CI run 123](https://github.com/Iniwura/before-protocol/actions/runs/42114536969) passed the contract, real local-Anvil release gate and browser-quality jobs for release commit `a5a0b49`.
- Robinhood Chain read-only RPC confirms chain ID 46630.

### Public mock-only testnet evidence

- Authorized disposable signer: `0xd1061825504b30f404c0d94b745205925f251f2c` from the newly generated `before-testnet` keystore. The earlier `0xa35dc047f9937bf668743efbdf8ea93b31a55888` preflight address was not used.
- [BeforeFactory](https://explorer.testnet.chain.robinhood.com/address/0x3d83AE6f49A913FB51C35E2969592b0f46135e40), [MockERC20](https://explorer.testnet.chain.robinhood.com/address/0xf080A1a012F2Dd41c4F416Befd6D70074af75A4C), and empty [WifSecurityChallenge](https://explorer.testnet.chain.robinhood.com/address/0xF9d644dd2024E2dFc425aA7c1059F9b4E720684a) were deployed on chain `46630`.
- The verified demo outputs are [Protect DemoVault](https://explorer.testnet.chain.robinhood.com/address/0xFCd5Ee59136c3e2E0775908Fa703c1e7A44Fa1e9), [Challenge Arena](https://explorer.testnet.chain.robinhood.com/address/0x0957593d029893340a783Aa76dA07a28b2b2a2f6), and [PracticeVault](https://explorer.testnet.chain.robinhood.com/address/0x7e29bC6Df38e60E77513bc1084dB488FeE12947C).
- Public flow receipts: [allowed 20 BTEST](https://explorer.testnet.chain.robinhood.com/tx/0x49ab86e469b83c7f02a01b0765973e213ba894cbbd6f37f6af17d0e84ae23b3c), [denied 75 BTEST, status `0x0`](https://explorer.testnet.chain.robinhood.com/tx/0xf40bd10c748f6bf60cdb4c12382b414478210c4875bcb3899792e16f425aaf04), and [60+50 practice proof](https://explorer.testnet.chain.robinhood.com/tx/0x4b002674e855aea3f2ba526b1028043603a2facca6e6c7d465742f7100fbe901).
- The live eleven-argument verifier passed exact bytecode, immutable state, events, receipts and historical balances; no WIF token was funded.

## Claim boundary

The browser preview, public mock-only testnet deployment, and local/CI evidence are real. The empty escrow is not a funded WIF challenge, and no payout, audit or mainnet custody is claimed. The checked-in manifest is `verified: true` from the eleven-argument verifier; no private key or real-value custody is included.

The concrete paid-challenge design is documented in [WIF_CHALLENGE_DESIGN.md](WIF_CHALLENGE_DESIGN.md); it keeps the mock training exercise separate from any future WIF bounty.

## Finalization gate

The disposable testnet wallet has signed the test-only deployment. The eleven-argument command in [TESTNET_PROOF.md](TESTNET_PROOF.md) passed against the public chain, and the verifier-generated addresses and receipts are committed to `web/deployment.json`. The remaining release gate is green CI plus review of the preview; PR #3 remains draft and is not merged here.
