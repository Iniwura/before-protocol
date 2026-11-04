# Test-only deployment

**Do not deploy intentionally vulnerable contracts with real assets.** This script creates a freely mintable mock token. It does not interact with real WIF or any production asset.

## Local chain

Start Anvil with chain ID 31337 and use an ephemeral local-only development key or Anvil's unlocked test account. Never use a valuable wallet. Run:

~~~sh
forge script script/DeployBefore.s.sol:DeployBefore --rpc-url http://127.0.0.1:8545 --broadcast -vvvv
~~~

Inspect deployments, mock-token balances, authorized withdrawals and rejected transfer attempts. The script's contract creation and funding actions are designed for local/testnet networks only.

## Robinhood Chain testnet

Chain ID: 46630. RPC: https://rpc.testnet.chain.robinhood.com. Explorer: https://explorer.testnet.chain.robinhood.com.

1. Use a newly generated throwaway testnet-only wallet. Obtain test ETH through the official testnet faucet: https://faucet.testnet.chain.robinhood.com.
2. Verify the RPC using node script/check-chain.mjs.
3. Import the disposable key into a local encrypted Foundry keystore (for example, account name `before-testnet`). Never upload the key to GitHub, paste it into ChatGPT, or put it in Vercel variables.
4. Run a read-only simulation first. This does not sign or broadcast anything:

~~~sh
forge script script/DeployBefore.s.sol:DeployBefore \
  --rpc-url https://rpc.testnet.chain.robinhood.com \
  --sender 0xYOUR_PUBLIC_DEPLOYER_ADDRESS -vvvv
~~~

Confirm the simulation reaches `SIMULATION COMPLETE` and note the estimated test ETH requirement. The sender is public; do not substitute a private key for `--sender`.

5. Once the simulation passes, broadcast with the local keystore signer. Foundry prompts for the keystore password locally:

~~~sh
forge script script/DeployBefore.s.sol:DeployBefore \
  --account before-testnet \
  --rpc-url https://rpc.testnet.chain.robinhood.com \
  --broadcast -vvvv
~~~

6. The script deploys `MockERC20`, `BeforeFactory` and an **empty** `WifSecurityChallenge`, then creates only the BTEST demo vault and unpaid practice arena. It never accepts a WIF address and never funds a reward.
7. If Foundry wrote a broadcast file, run `node script/broadcast-args.mjs` with its public `run-latest.json` path to extract the three creation hashes/addresses and two factory-call hashes. This helper reads no key and never broadcasts.
8. Verify chain ID, direct creation transaction hashes, deployed bytecode and source code before claiming testnet proof. Pass the two factory-call hashes and, for the full release gate, the public allowed-withdrawal, denied-withdrawal and practice-proof hashes as the optional final arguments so the verifier also checks exact calldata and event data, deployer-owned registry outputs, created vault/arena runtime code, 150-BTEST balances and the real Protect/Challenge flow.

The script restricts itself to chain IDs 31337 and 46630. No public testnet transaction is claimed at this checkpoint. Do not attempt mainnet with this script.

## Valuable WIF funding

Do not put a WIF private key in Foundry scripts, Vercel variables, GitHub, or chat. Funding a challenge is a separate authorization step after the verifier and target have been independently reviewed. The current repository contains no WIF token address, funded challenge, or payout claim.
