# Verification checkpoint — 2026-11-04

| Check | Result | Evidence scope |
| --- | --- | --- |
| Foundry build / Solc 0.8.36 | Passed | Local networked sandbox |
| Solidity tests | 65 / 65 passed | Foundry local EVM, including escrow code-pinning, reviewer-quorum, transfer-callback mutation and empty-evidence tests |
| Fuzz | 1,024 runs per fuzz test | Local EVM |
| JavaScript policy, web and deployment checks | 55 / 55 passed | Does not run Solidity |
| BeforeVault line coverage | 98.25% | Previous instrumented local coverage only |
| BeforeVault branch coverage | 72.22% | Previous instrumented local coverage; open branches remain |
| Browser QA | 12 / 12 viewport-screen audits plus 3 complete-manifest state audits, 4 success-path transactions, 3 failure paths | Chromium, axe-core, keyboard tab navigation, no horizontal overflow; GitHub Actions run [109](https://github.com/Iniwura/before-protocol/actions/runs/41926967105) passed |
| Robinhood testnet chain ID | 46630 | Read-only RPC |
| Testnet transactions / verified bytecode | Not done | No public proof yet; manifest remains fail-closed |
| Independent audit / WIF reward | Not done | Escrow code is tested but not audited, funded or deployed |

The local end-to-end test exercises mock funding, protected withdrawals, refused unauthorized actions, cumulative limits and a training split-bypass proof. The escrow suite independently exercises exact source-and-recipient token accounting, solver-bound commit/reveal, copied commitment rejection, verifier failure, invalid-proof slashing, expiry, cancellation, fee-token rejection, a token that mints without debiting its source, and a fixed-quorum reviewer verifier. It does not settle WIF.

This report is not a security audit. GitHub Actions run 109 passed both the contract and browser-quality jobs for commit `d3fcd68`; it does not establish testnet deployment or WIF custody.
