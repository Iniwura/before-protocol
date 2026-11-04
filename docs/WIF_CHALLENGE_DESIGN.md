# Meaningful WIF challenge design

`WifSecurityChallenge` is a settlement primitive, not a security oracle. A live WIF challenge is only meaningful when the target, scope, evidence rule and reviewer set are concrete before a sponsor funds it.

The solver commitment domain includes `address(escrow)`, `block.chainid`, `challengeId`, the solver address, salt and `keccak256(evidence)`. This prevents a copied commitment from being replayed on another chain or revealed by another wallet.

## First challenge template

**Finding:** demonstrate a reproducible way for an unauthorized caller, or an authorized caller using the wrong destination, to violate the target vault's stated transfer policy while the target and token remain unchanged.

**Target property:** for a specific immutable `BeforeVault` deployment, every successful withdrawal must:

- originate from the configured owner;
- go to the immutable approved recipient;
- be at most the configured per-transfer limit; and
- keep cumulative withdrawals within the fixed UTC-day limit.

The evidence must show the target address, target runtime code hash, token address, calldata, transaction receipts, and before/after token balances. A finding must be reproducible against the pinned deployment and must identify the exact violated property. The mock-only `TrainingVault` and `TrainingArena` are explicitly out of scope and never receive a WIF reward.

The first live target should be non-upgradeable. A proxy runtime hash alone is not sufficient: if a proxy is ever in scope, the written scope and verifier must also pin and inspect its implementation address, implementation code hash and upgrade authority.

## Settlement boundary

Before funding, the sponsor publishes a scope document and its `scopeHash`, selects a target and code hash, deploys or selects a fixed reviewer quorum, and chooses a reward and solver bond. Reviewers approve the exact escrow, challenge ID, solver, target, scope hash and evidence hash. The escrow then enforces:

1. exact ERC-20 reward and bond accounting;
2. solver-bound commit/reveal;
3. first valid settlement only;
4. invalid-proof bond slashing without touching the reward;
5. cancellation before commitments and expiry recovery after the bounded window; and
6. fail-closed behavior if the target, verifier or reward-token code changes.

The verifier must independently inspect the target and evidence. A verifier revert is unavailable evidence, not a failed finding; a returned `false` is an invalid finding. Reviewer approvals are irreversible and bound to the escrow and Robinhood Chain ID to prevent replay across deployments.

## Approval gate

No WIF address, private key, funded challenge or payout transaction belongs in this repository until all of the following are separately approved:

- the target source and deployed runtime code;
- the written scope and exclusions;
- reviewer identities, quorum and review process;
- reward, bond, expiry and recovery economics;
- reporting, disclosure and dispute handling; and
- an independent security review of the verifier and target.

The current repository proves the settlement and failure paths with test tokens only. It does not claim a WIF reward, an audit or real-value custody.
