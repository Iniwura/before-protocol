# Security boundaries

**Research code, unaudited. Not suitable for real deposits.**

BeforeVault enforces a fixed recipient, owner and spending policy on its own token balance only. No external wallet is automatically protected. Its owner can transfer up to the allowed policy budget; policy configuration is immutable. Missing owner keys or a misconfigured recipient may permanently lock funds. There is no rescue or emergency override.

The aggregate daily limit is a fixed epoch computed from block.timestamp / 86400, not a sliding 24-hour window. Spending close to midnight UTC can result in more transfers across adjacent epochs than a user might intuit. This design requires explicit UX disclosure.

Unusual ERC-20 behaviors are outside the supported production scope. The prototype checks balance deltas and tests fee-on-transfer failure and reentrancy, but rebasing, malicious token code, false balance reporting and other edge cases need independent evaluation.

TrainingVault is **intentionally vulnerable**. It omits the aggregate daily cap. TrainingArena and the training vault restrict network and mock-token runtime code as defense in depth; they must never custody valuable tokens. The attack is public and trivial, so it cannot support economically meaningful rewards.

No valuable WIF prize escrow exists. Any later WIF reward contract must be separate and reviewed for transaction ordering, copied solutions, commit/reveal or equivalent protections, sponsor refunds and expiration, unique claims, reentrancy and economic abuse. A reverted transaction is not by itself an eligible exploit.

Before mainnet: independent review, property/invariant tests, incident response planning, account recovery model, verified deployed bytecode, security limitations and cost/UX analysis.
