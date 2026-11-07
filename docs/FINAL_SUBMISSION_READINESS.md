# Final submission readiness

## Current scope

Issue #10 adds BEFORE Pay as a noncustodial, mainnet-aware WIF request → check → pay → proof experience. The request is recipient-authenticated with EIP-712, the payment calldata is restricted to the official WIF `transfer(recipient,amount)` call, and proof is independently revalidated from public RPC.

The feature does not custody keys, request an allowance, deploy a mainnet contract, or automatically broadcast a transaction. Automated tests use only deterministic mock wallets/RPC. Existing BTEST bounty evidence remains a separate Robinhood Chain **testnet** demonstration and is not WIF evidence.

## Gates

| Gate | Status | Evidence / limit |
| --- | --- | --- |
| Issue #10 implementation | **READY FOR DRAFT REVIEW** | PR [#11](https://github.com/Iniwura/before-protocol/pull/11), commit `c780c0b1fc90a512cb12f5b66931c96974ec4dd9` |
| Pure request/signature/calldata/proof tests | **PASS** | 11 Pay tests; included in 67 local Node tests |
| Mock wallet/browser/security QA | **PASS** | `node qa/pay-e2e.mjs`; 320/375/390/768/1280, axe clean, no real WIF broadcast |
| Existing Foundry/Node/Anvil suites | **PASS** | Foundry 66, Node 67, Anvil release gate; WIF revoke tests remain on separate unmerged PR #7 |
| GitHub CI | **PASS** | [run 42379107869](https://github.com/Iniwura/before-protocol/actions/runs/42379107869): `test` and `browser-quality`; Vercel preview check also passed |
| Vercel preview | **READY** | [preview](https://before-a1jcqrbe9-iniwura-akurus-projects.vercel.app/app/pay/) · deployment [dashboard](https://vercel.com/iniwura-akurus-projects/before-web/DXSq4P9ALgijRnrmRa1huDjGdMY1) |
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
