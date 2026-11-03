# Working contract for contributors and agents

Goal: Make BEFORE an exceptionally clear, verifiable Robinhood Chain hackathon submission. Keep the structure simple: Protect, Challenge, Proof.

1. Never claim a deployment, reward payout, external security audit, or passed test without evidence.
2. Never use real WIF or valuable assets in TrainingVault or TrainingArena. Practice tokens must be obvious mocks.
3. Keep the protected vault separate from the intentionally vulnerable training environment.
4. Any contract change requires deterministic tests, adversarial regression tests and a reproducible Foundry build.
5. Preserve ERC-20, chain ID, sender, recipient and policy assumptions explicitly. Favor fail-closed checks.
6. Prioritize UX, DX and agent readability together. Do not add taglines, explanatory clutter, secondary dashboards or unnecessary dependencies.
7. Do not commit credentials, seeds, private keys, local .env files, caches or deployment artifacts.
8. Before submission, record testnet receipts, verified source and real user-flow evidence. Mainnet economic mechanisms require separate review.
