# Phase 2: Testnet-first interface

## What's in the repository

- `web/` is a dependency-free, responsive, static web application with three tabs: Protect, Challenge, Proof.
- Protect performs a **local browser policy calculation** equivalent to the narrow demo cap and approved destination; it does not sign or submit transactions.
- Challenge demonstrates a **known, intentionally easy** split-transfer flaw using mock amounts; it is a local preview, not a valuable bounty.
- Proof checks chain ID **46630** before it reads from Robinhood Chain testnet's public JSON-RPC endpoint. It can inspect submitted vault-like addresses and transaction receipts without a wallet.
- A pasted contract is **not source verified** by the frontend; the read-only interface decodes selectors and assumes 18-decimal demo token units. A successful transaction receipt does not constitute an audit.
- `web/test/core.test.mjs` covers arithmetic, input validation and formatting. CI runs these tests with Solidity and independent reference tests.

## Not yet done

- Robinhood Chain testnet deployment, verified-bytecode link or confirmed chain transactions.
- Wallet transactions, token custody onchain, security review or monetary reward contracts.
- Real WIF reward settlement and meaningful adversarial challenge economics.
- Comprehensive browser accessibility and wallet QA against a publicly deployed site.

## Deployment

The site has no build step or npm dependencies. Set the Vercel project root directory to `web` and deploy the repository's `main` branch. Read-only network results may show unavailable if the public RPC is rate-limited or blocks browser-origin requests; do not substitute fabricated live data.

## Milestone gate

Next: deploy the test-only contracts using a newly funded throwaway testnet wallet, verify contract source and transactions on the official testnet Blockscout explorer, and wire the verified addresses into the interface. Do not use valuable tokens in the practice vault.
