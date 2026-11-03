# Verification checkpoint — 2026-11-03

| Check | Result | Evidence scope |
| --- | --- | --- |
| Foundry build / Solc 0.8.36 | Passed | Local networked sandbox |
| Solidity tests | 28 / 28 passed | Foundry local EVM |
| Fuzz | 1,024 runs per fuzz test | Local EVM |
| JavaScript policy model | 9 / 9 passed | Does not run Solidity |
| BeforeVault line coverage | 98.25% | Instrumented local coverage only |
| BeforeVault branch coverage | 72.22% | Open branches remain |
| Robinhood testnet chain ID | 46630 | Read-only RPC |
| Testnet transactions / verified bytecode | Not done | No public proof yet |
| Independent audit / mainnet reward | Not done | Must not be claimed |

The local end-to-end test exercises mock funding, protected withdrawals, refused unauthorized actions, cumulative limits and a training split-bypass proof. It does not settle WIF.

This report is not a security audit. GitHub Actions should be checked separately against the repository commit once the workflow runs.
