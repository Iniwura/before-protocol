# Phase 3 — Onchain demo foundation

BEFORE's next milestone is a **self-service, one-transaction demo vault** and a fresh practice arena per participant, both on Robinhood Chain testnet.

## Built in source

- `BeforeFactory` deploys **only** on chain IDs 31337 (local Anvil) and 46630 (Robinhood Chain testnet).
- Factory accepts **only exact `MockERC20` runtime bytecode**, so no valuable WIF/ERC-20 can accidentally enter the demo flow.
- `createDemoVault(mockToken)` makes a fresh vault **owned by its caller**, pays 150 freely mintable BTEST into it, and fixes the destination to that same caller. 60 BTEST per transfer, 100 BTEST per fixed UTC day.
- `createPractice(mockToken)` makes a fresh, 150-BTEST **intentionally vulnerable** practice arena for public demonstration. It pays no rewards.
- `isVault`, `isPractice`, `latestVaultOf`, `latestPracticeOf` and creation events allow independent provenance checks.
- `WifSecurityChallenge` is a separate, empty ERC-20 escrow deployment target. The deployment script does not fund it or configure a WIF challenge.
- `ReviewedFindingVerifier` provides an immutable reviewer set and threshold for approving the exact challenge context and evidence hash before an escrow can settle.

The mock token and testnet native ETH have **no monetary value**. This is not a usable mainnet custody product or an independent security audit.

## Local validation

~~~sh
forge build
forge test --fuzz-runs 1024 -vvv
node --test checks/reference.test.mjs web/test/core.test.mjs
~~~

Use `anvil --chain-id 31337` to validate the actual deployment script with a local throwaway Anvil key. Never use a valuable wallet or send real tokens to the practice contracts.

## Testnet deployment sequence

1. Create a disposable **testnet-only** wallet with an EVM wallet. Do not paste private keys into chats or repositories.
2. Obtain test ETH from the [Robinhood Chain faucet](https://faucet.testnet.chain.robinhood.com/).
3. Verify chain ID 46630 and your public wallet's gas balance using `node script/testnet-preflight.mjs 0xYOUR_PUBLIC_ADDRESS`.
4. Import a disposable testnet key into a **local encrypted Foundry keystore** (never place the key in GitHub, chat, or Vercel environment variables).
5. Simulate with the public address as sender, with **no** broadcast:
   ~~~sh
   forge script script/DeployBefore.s.sol:DeployBefore --sender 0xYOUR_PUBLIC_ADDRESS --rpc-url https://rpc.testnet.chain.robinhood.com -vvvv
   ~~~
6. Once simulation passes, explicitly broadcast with the local keystore signer:
   ~~~sh
   forge script script/DeployBefore.s.sol:DeployBefore --account before-testnet --rpc-url https://rpc.testnet.chain.robinhood.com --broadcast -vvvv
   ~~~
7. Record **real** receipt hashes, factory, mock-token, empty challenge-escrow, vault and arena addresses, verified source, chain ID, and a public demo transaction in the deployment manifest.
8. Update `web/deployment.json` only after independent explorer checks. An empty manifest keeps real-contract buttons hidden.

## Release gates

- The testnet proof must include a denied transfer (revert receipt), an allowed transfer, and a practice split-bypass proof.
- Distinguish a genuine chain transaction from a local estimate and from third-party smart contract claims.
- Do not add a monetary WIF payout to this trivial practice exercise. `WifSecurityChallenge` needs a meaningful adversarial challenge, a reviewed verifier and explicit sponsor approval before any WIF is funded.
