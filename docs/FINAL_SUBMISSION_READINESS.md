# Final submission readiness

## Current scope

Issue #10 adds BEFORE Pay as a noncustodial, mainnet-aware WIF request → check → pay → proof experience. The request is recipient-authenticated with EIP-712, the payment calldata is restricted to the official WIF `transfer(recipient,amount)` call, and proof is independently revalidated from public RPC.

The feature does not custody keys, request an allowance, deploy a mainnet contract, or automatically broadcast a transaction. Automated tests use only deterministic mock wallets/RPC. Existing BTEST bounty evidence remains a separate Robinhood Chain **testnet** demonstration and is not WIF evidence.

The payment lifecycle is now fail-closed after send intent: `eth_sendTransaction` is allowed once per signed request in the active URL flow; a returned hash is persisted before confirmation RPC; delayed, failed or low-confirmation verification can only be retried read-only. Reloads recover the public hash and keep Pay disabled. If reload happens before a hash exists, every non-idle serialized status is restored as `uncertain`, including edited status values, so Pay cannot unlock. This is a duplicate-send guard, not a protocol-level unique-invoice guarantee for arbitrary generic ERC-20 transfers.

## Gates

| Gate | Status | Evidence / limit |
| --- | --- | --- |
| Issue #10 implementation | **READY FOR DRAFT REVIEW** | PR [#11](https://github.com/Iniwura/before-protocol/pull/11), merge-resolved head `1df02916811a55d9c70df7402b5263764cfb25af` |
| Pure request/signature/calldata/proof tests | **PASS** | 11 Pay tests; 84 local Node tests; canonical receipt/block identity checks included |
| Mock wallet/browser/security QA | **PASS** | `node qa/pay-e2e.mjs`; 320/375/390/768/1280, axe clean, delayed receipts, low confirmations, interrupted wallet-confirmation reload, lost-response reload, edited-status fail-closed, wallet events, RPC failure, reverted receipt and repeated clicks all covered |
| Existing Foundry/Node/Anvil suites | **PASS IN CI** | Hosted `test` job passed Foundry build/fuzz, Anvil, bounty lifecycle and 84 Node tests; local container lacks `forge`/`anvil` binaries. WIF revoke tests remain on separate unmerged PR #7 |
| GitHub CI | **PASS** | [run 42382610363](https://github.com/Iniwura/before-protocol/actions/runs/42382610363): `test` and `browser-quality` both passed; PR metadata is `mergeable=true`, `clean` |
| Vercel preview | **READY** | [Pay preview](https://before-3nlhuhf7a-iniwura-akurus-projects.vercel.app/app/pay/) · [root](https://before-3nlhuhf7a-iniwura-akurus-projects.vercel.app/) · [app](https://before-3nlhuhf7a-iniwura-akurus-projects.vercel.app/app/) · deployment [dashboard](https://vercel.com/iniwura-akurus-projects/before-web/HYTg33Sccs2YqDu4UDWy3ZjiRaL6) |
| Real WIF/mainnet transaction | **NO-GO** | Explicitly not authorized |
| Production promotion | **NO-GO** | Explicitly not authorized |
| Merge | **NO-GO** | Draft PR only |
| Demo video | **PAUSED** | Explicitly not requested |
| Final organizer submission | **NO-GO** | Owner-controlled decision |

## Truthful product limits

- The signed request proves recipient intent, not unique invoice settlement.
- The same signed request can match more than one generic ERC-20 transfer initiated outside this client; no unique invoice settlement is claimed.
- Within the active URL recovery flow, a sent or uncertain request never re-enables Pay. The URL-persisted hash and public RPC proof are used for recovery; Retry verification never broadcasts.
- EIP-1271 smart-contract recipients are unsupported and fail closed.
- Public RPC availability and a stable confirmation depth are required for proof.
- A real payment costs real mainnet gas and is irreversible.
- No independent security audit is claimed.
