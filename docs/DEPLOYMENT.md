# Test-only deployment

**Do not deploy intentionally vulnerable contracts with real assets.** This script creates a freely mintable mock token. It does not interact with real WIF or any production asset.

## Local chain

Start Anvil with chain ID 31337, then set BEFORE_TEST_DEPLOYER_KEY to an ephemeral local-only development key in your terminal, never in a source file. Run:

~~~sh
forge script script/DeployBefore.s.sol:DeployBefore --rpc-url http://127.0.0.1:8545 --broadcast -vvvv
~~~

Inspect deployments, mock-token balances, authorized withdrawals and rejected transfer attempts. The script's contract creation and funding actions are designed for local/testnet networks only.

## Robinhood Chain testnet

Chain ID: 46630. RPC: https://rpc.testnet.chain.robinhood.com. Explorer: https://explorer.testnet.chain.robinhood.com.

1. Use a newly generated throwaway testnet-only wallet. Obtain test ETH through the official testnet faucet: https://faucet.testnet.chain.robinhood.com.
2. Verify the RPC using node script/check-chain.mjs.
3. Set BEFORE_TEST_DEPLOYER_KEY in your local shell or a secret manager. Never upload it to GitHub or paste it into ChatGPT.
4. Run:

~~~sh
forge script script/DeployBefore.s.sol:DeployBefore --rpc-url https://rpc.testnet.chain.robinhood.com --broadcast -vvvv
~~~

5. The script deploys `MockERC20`, `BeforeFactory` and an **empty** `WifSecurityChallenge`, then creates only the BTEST demo vault and unpaid practice arena. It never accepts a WIF address and never funds a reward.
6. Verify chain ID, direct creation transaction hashes, deployed bytecode and source code before claiming testnet proof. Use the optional challenge-escrow arguments to `script/verify-testnet.mjs`.

The script restricts itself to chain IDs 31337 and 46630. No public testnet transaction is claimed at this checkpoint. Do not attempt mainnet with this script.

## Valuable WIF funding

Do not put a WIF private key in Foundry scripts, Vercel variables, GitHub, or chat. Funding a challenge is a separate authorization step after the verifier and target have been independently reviewed. The current repository contains no WIF token address, funded challenge, or payout claim.
