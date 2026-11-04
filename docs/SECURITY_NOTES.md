# Security boundaries

**Research code, unaudited. Not suitable for real deposits.**

BeforeVault enforces a fixed recipient, owner and spending policy on its own token balance only. No external wallet is automatically protected. Its owner can transfer up to the allowed policy budget; policy configuration is immutable. Missing owner keys or a misconfigured recipient may permanently lock funds. There is no rescue or emergency override.

The aggregate daily limit is a fixed epoch computed from block.timestamp / 86400, not a sliding 24-hour window. Spending close to midnight UTC can result in more transfers across adjacent epochs than a user might intuit. This design requires explicit UX disclosure.

Unusual ERC-20 behaviors are outside the supported production scope. The prototype checks balance deltas and tests fee-on-transfer failure and reentrancy, but rebasing, malicious token code, false balance reporting and other edge cases need independent evaluation.

TrainingVault is **intentionally vulnerable**. It omits the aggregate daily cap. TrainingArena and the training vault restrict network and mock-token runtime code as defense in depth; they must never custody valuable tokens. The attack is public and trivial, so it cannot support economically meaningful rewards.

`WifSecurityChallenge` is the separate reward mechanism for a future meaningful challenge. It is ERC-20-token agnostic so it can be configured with WIF, but this repository does not fund or claim a WIF challenge. Each challenge records a concrete target contract, target code hash and immutable hash of the written scope, so the verifier and solvers share an onchain scope anchor. It requires exact-balance reward and solver-bond transfers, a verifier contract, solver-bound commit/reveal evidence, a bounded 30-day window, one commitment per solver, replay-resistant settlement, invalid-proof bond slashing, sponsor cancellation before commitments, and expiry refunds. It records the verifier and reward-token code hashes and fails closed if the target, verifier or reward token changes.

The escrow does not decide whether a finding is real: the configured verifier is part of the trust boundary and must bind the challenge ID and solver, inspect the intended target, and receive independent review. A reverted verifier call is not a failed proof and does not slash a bond. A verifier returning `false` is an invalid reveal and does slash the bond. A reverted transaction is not by itself an eligible exploit.

No valuable WIF prize escrow exists in the current deployment manifest. Do not fund `WifSecurityChallenge` until the verifier, target scope, reward-token address, sponsor key, reporting policy and payout economics are separately approved.

Before mainnet: independent review, property/invariant tests, incident response planning, account recovery model, verified deployed bytecode, security limitations and cost/UX analysis.
