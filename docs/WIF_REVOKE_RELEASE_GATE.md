# BEFORE — WIF approve(spender, 0) release gate

This is an optional wallet-controlled action added to the existing mainnet read-only WIF checker. **Not released until PR #7 is reviewed and promoted.**

## Behavior

- A fresh verified mainnet scan must show a nonzero allowance for one exact owner/spender pair.
- The user explicitly checks the acknowledgement and confirms a wallet transaction.
- The app validates Robinhood mainnet chain ID 4663, owner address, official WIF token address and metadata, and a nonzero current allowance before requesting a transaction.
- It sends only `approve(spender, 0)` to the official WIF token with zero native currency value. This does not send any WIF, but the wallet may charge mainnet gas.
- It validates the public mined receipt's status, sender, destination and calldata; it re-reads the allowance and only claims a successful revocation when it is zero.
- This does not enumerate other allowances, revoke offchain signatures, prevent an approved spender from acting before confirmation, or guarantee wallet safety. Never request or store private keys.

## Automated release checks

`node --test web/test/wif-core.test.mjs`

`node qa/wif-verify.mjs`

`node qa/wif-revoke-verify.mjs`

The new browser regression uses a stub EIP-1193 wallet and mocked RPC; it tests success, user cancellation, missing wallet, mismatched chain, mismatched/changed owner, failed receipt and allowance still nonzero. It does **not** broadcast a mainnet transaction.

## Required human acceptance before production promotion

Review the PR diff and GitHub Actions, including security browser QA. Verify a wallet's displayed transaction intent, address and chain against the verified WIF token. If an authorized mainnet holder chooses to exercise revocation, only that person may confirm a transaction, with an allowance they already intend to revoke. Mainnet gas is real; no real transfer is required to demonstrate code quality.

**Do not** use this feature to claim a WIF bounty, staking flywheel, or revenue mechanism. It is a real user-initiated WIF state change, but organizers must judge whether it qualifies as meaningful WIF utility.

## Separate pending testnet acceptance

The independent BTEST bounty browser walkthrough (sponsor → researcher → appointed reviewer → settlement) is documented in [PUBLIC_TESTNET_STUDIO_WALKTHROUGH.md](https://github.com/Iniwura/before-protocol/blob/audit/public-testnet-bounty-2026-11-06/docs/PUBLIC_TESTNET_STUDIO_WALKTHROUGH.md). It still requires actual testnet wallet signatures and four new public explorer receipts. Historical synthetic and local-fork receipts are not substitutes.

Demo video remains paused by user instruction. Hackathon registration was confirmed by the owner, but project submission confirmation is not available.
