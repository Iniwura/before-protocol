# Final submission readiness

## Current scope

Issue #10 adds BEFORE Pay as a noncustodial, mainnet-aware WIF request → check → pay → proof experience. The request is recipient-authenticated with EIP-712, the payment calldata is restricted to the official WIF `transfer(recipient,amount)` call, and proof is independently revalidated from public RPC.

The feature does not custody keys, request an allowance, deploy a mainnet contract, or automatically broadcast a transaction. Automated tests use only deterministic mock wallets/RPC. Existing BTEST bounty evidence remains a separate Robinhood Chain **testnet** demonstration and is not WIF evidence.

## Gates

| Gate | Status | Evidence / limit |
| --- | --- | --- |
| Issue #10 implementation | Pending final CI and preview checks | Draft PR will contain the exact SHA |
| Pure request/signature/calldata/proof tests | Passing locally | `node --test web/test/pay-core.test.mjs` |
| Mock wallet/browser/security QA | Passing locally | `node qa/pay-e2e.mjs`; no real WIF broadcast |
| Existing Foundry/Node/Anvil/WIF suites | Required | Must be rerun on the final SHA |
| Vercel preview | Required | Preview only; no production promotion |
| Real WIF/mainnet transaction | **NO-GO** | Explicitly not authorized |
| Production promotion | **NO-GO** | Explicitly not authorized |
| Merge | **NO-GO** | Draft PR only |
| Demo video | **PAUSED** | Explicitly not requested |
| Final organizer submission | **NO-GO** | Owner-controlled decision |

## Truthful product limits

- The signed request proves recipient intent, not unique invoice settlement.
- The same signed request can match more than one generic ERC-20 transfer; the UI warns about duplicate payments.
- EIP-1271 smart-contract recipients are unsupported and fail closed.
- Public RPC availability and a stable confirmation depth are required for proof.
- A real payment costs real mainnet gas and is irreversible.
- No independent security audit is claimed.
