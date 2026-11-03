# Phase 1 handoff — 2026-11-03

## Product definition

Protect: fixed, onchain spending and destination rules.
Challenge: deliberately flawed, mock-only practice contract with reproducible exploit.
Proof: independently inspectable outcomes. Public transaction receipts are still pending.

## Engineering checkpoint

Foundry 1.9.0 / Solc 0.8.36: build succeeded; 28 Solidity tests passed locally (two fuzz tests: 1,024 runs each); 9 JavaScript reference tests passed. Read-only Robinhood Chain testnet RPC was available. These are not independent audits.

## Remaining release gates

1. Confirm competition submission requirements in the authenticated dashboard.
2. Deploy mock-only contracts on testnet 46630 with a new test-only wallet; publish verified contract source, receipts and failures.
3. Extend invariant, reentrancy, malformed ERC-20, timestamp boundary and economic attack testing.
4. Design, test, and separately review any real WIF settlement. Do not pay valuable tokens for the trivial practice exercise.
5. Deliver a restrained three-screen frontend and proof-first demo.

No unverified mainnet or payout claims are permitted.
