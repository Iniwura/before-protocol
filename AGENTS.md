# BEFORE development contract

BEFORE's **primary shipped product** is noncustodial, signed $WIF payments and voluntary creator support on Robinhood Chain **mainnet (4663)**, with read-only receipt/history/permission checks. The secondary **Protect / Challenge / Proof and Bounty Studio** experiences use freely mintable BTEST on Robinhood Chain **testnet (46630)** only.

**One purpose, simple architecture, simple UX:** user understands each action, developer can reproduce it, agent can audit it. Avoid slogans, noisy helper copy, unrelated dashboards and unnecessary dependencies.

## Non-negotiable safety and accuracy

1. Do not claim real WIF custody, customer adoption, third-party reviewers, independently audited security, automated recurring payments or a successful transaction without verifiable evidence.
2. Public WIF acceptance is **two controlled 200-WIF Support transfers**, not an organic user base or a separately verified one-off Pay transfer. See [mainnet evidence](docs/ISSUE_18_MAINNET_SUPPORT_EVIDENCE.md).
3. The testnet vault/Bounty Studio use **BTEST only**. Never fund deliberately vulnerable training contracts with valuable tokens; do not change network/token gates without adversarial review.
4. Preserve wallet consent, pinned chain and official WIF address, exact EIP-712 signature terms, zero-value ERC-20 transfer calldata, receipt/event verification and fail-closed handling.
5. Any product or smart-contract change needs deterministic regression tests, adversarial cases, build/CI evidence and reproducible source. Do not merge unverified assertions.
6. Keep implementation readable for humans and agents. No hidden backend wallet or key collection. Never commit credentials, private keys, seeds, `.env`, browser profiles or test-generated output.
7. Testnet historical state may need an archival RPC. Missing archived data is **not** evidence of a transaction revert, nor a reason to claim historical verification passed.
8. Preserve published proof, artifacts and historical documents; don't delete or relabel them as if they were current releases. Start with [docs index](docs/README.md).
9. For hackathon claims, prioritize **real mainnet WIF Support**, an explicit repeat-use mechanism, real receipts, accurate limitations, the [live app](https://before-web-theta.vercel.app/) and the [final demo](https://youtu.be/YC7t2mql-cI).
10. Before any deployment or merge, confirm exact source SHA, CI state, current product routes and that no mainnet transaction or external publication occurs without intentional authorization.

Review the [root README](README.md) for product scope and the [documentation index](docs/README.md) for evidence.
