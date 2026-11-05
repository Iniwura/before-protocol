# Verification checkpoint — 2026-11-05

| Check | Result | Evidence scope |
| --- | --- | --- |
| Foundry build / Solc 0.8.36 | Passed | Local networked sandbox |
| Solidity tests | 66 / 66 passed | Foundry local EVM, including escrow code-pinning, reviewer-quorum, transfer-callback mutation and empty-evidence tests |
| Fuzz | 1,024 runs per fuzz test | Local EVM |
| JavaScript policy, web and deployment checks | 57 / 57 passed | Includes immutable-slot, historical-balance and token-transfer proof checks; does not replace Solidity or Anvil execution |
| BeforeVault line coverage | 98.25% | Previous instrumented local coverage only |
| BeforeVault branch coverage | 72.22% | Previous instrumented local coverage; open branches remain |
| Browser QA | 12 / 12 viewport-screen audits plus 3 complete-manifest state audits, 4 success-path transactions, 3 failure paths | Chromium, axe-core, keyboard tab navigation, no horizontal overflow; GitHub Actions run [112](https://github.com/Iniwura/before-protocol/actions/runs/41928214417) passed |
| Robinhood testnet chain ID | 46630 | Read-only RPC |
| Local Anvil deployment and eleven-argument verifier | Passed | Real `DeployBefore` broadcast, 150/130/40 historical balances, genuine receipts accepted, swapped receipts rejected; local mode cannot write the hosted manifest |
| Testnet transactions / verified bytecode | Not done | No public proof yet; manifest remains fail-closed |
| Independent audit / WIF reward | Not done | Escrow code is tested but not audited, funded or deployed |

The Solidity local end-to-end test exercises mock funding, protected withdrawals, refused unauthorized actions, cumulative limits and a training split-bypass proof. The separate Anvil release gate runs the real deployment script and full public-flow verifier against mined local receipts. The deployment proof compares immutable-aware runtime code strictly outside compiler-declared slots and validates constructor state, exact token transfer logs and block-specific balances. The escrow suite independently exercises exact source-and-recipient token accounting, solver-bound commit/reveal, copied commitment rejection, verifier failure, invalid-proof slashing, expiry, cancellation, fee-token rejection, a token that mints without debiting its source, and a fixed-quorum reviewer verifier. It does not settle WIF.

This report is not a security audit. GitHub Actions run 114 passed both the contract and browser-quality jobs for documentation head `1bf9a84`; it does not establish testnet deployment or WIF custody.
