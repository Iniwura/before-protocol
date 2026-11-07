# Public BTEST bounty evidence

Recorded 2026-11-06 from independent read-only RPC inspection of Robinhood Chain Testnet (chain ID `46630`). This is a mock-only, valueless BTEST demonstration. The sponsor, solver and two reviewers are synthetic contracts controlled by the single authorized operator; this is not independent vulnerability review and no real `$WIF` was funded.

## Deployed contracts

- Coordinator: [`0x166E3367cdC9751A02570fedf8d700C4f70fCd1C`](https://explorer.testnet.chain.robinhood.com/address/0x166E3367cdC9751A02570fedf8d700C4f70fCd1C)
- Existing challenge escrow: [`0xF9d644dd2024E2dFc425aA7c1059F9b4E720684a`](https://explorer.testnet.chain.robinhood.com/address/0xF9d644dd2024E2dFc425aA7c1059F9b4E720684a)
- Freely mintable BTEST: [`0xf080A1a012F2Dd41c4F416Befd6D70074af75A4C`](https://explorer.testnet.chain.robinhood.com/address/0xf080A1a012F2Dd41c4F416Befd6D70074af75A4C)
- Training target: [`0x7e29bc6df38e60e77513bc1084db488fee12947c`](https://explorer.testnet.chain.robinhood.com/address/0x7e29bc6df38e60e77513bc1084db488fee12947c)
- Synthetic reviewer verifier: [`0xe96C8Bc8fD7BA61D7147DF57b5e4DD13a8247bfD`](https://explorer.testnet.chain.robinhood.com/address/0xe96C8Bc8fD7BA61D7147DF57b5e4DD13a8247bfD)

The authorized operator was `0xd1061825504b30f404c0d94b745205925f251f2c`. No private key, password or keystore material is part of this evidence.

## Mined transaction receipts

All four transactions below have status `0x1`, were sent by the authorized operator, and were independently matched to their mined blocks and target addresses.

| Step | Transaction | Block | Gas used | Public result |
| --- | --- | ---: | ---: | --- |
| Deploy coordinator | [`0x1e0e7783d9f46047c351d4b942344052892312c9f2ff0fa7f06e2b764b59e7dc`](https://explorer.testnet.chain.robinhood.com/tx/0x1e0e7783d9f46047c351d4b942344052892312c9f2ff0fa7f06e2b764b59e7dc) | 149412768 | 3,155,718 | Contract address matched coordinator |
| `start()` | [`0x2ad4387c44ab0e1d5bf4f561318a9e8e8c493e7f8a6414cb980bf36603517789`](https://explorer.testnet.chain.robinhood.com/tx/0x2ad4387c44ab0e1d5bf4f561318a9e8e8c493e7f8a6414cb980bf36603517789) | 149412855 | 1,837,136 | Four challenges, three commitments, quorum approvals and cancellation |
| `settle()` | [`0x74df2df93542458b66ae7751ceed7e28bd66b739bd43a5f6bedc1ba903aefd08`](https://explorer.testnet.chain.robinhood.com/tx/0x74df2df93542458b66ae7751ceed7e28bd66b739bd43a5f6bedc1ba903aefd08) | 149413292 | 290,032 | Payout, bond slashing, reward refund and bond refund |
| `cleanup()` | [`0x5e35f62052dc5d8bbaed2da78cbf3df3a2fed0d6254f49e940d74f0a772e5898`](https://explorer.testnet.chain.robinhood.com/tx/0x5e35f62052dc5d8bbaed2da78cbf3df3a2fed0d6254f49e940d74f0a772e5898) | 149414021 | 102,465 | Invalid-case reward returned; final stage 3 |

## Independent event and accounting checks

- `start()` emitted exactly 4 `ChallengeCreated`, 3 `CommitmentSubmitted`, 2 `FindingApproved` and 1 `ChallengeCanceled` events. The two approvals matched the configured synthetic reviewer addresses, exact challenge context and evidence hash; the verifier threshold and approval count were both 2.
- `settle()` emitted `RewardPaid` for challenge 1 (100 BTEST reward + 10 BTEST bond), `InvalidEvidence` for challenge 2 (10 BTEST slashed), `ChallengeExpired` for challenge 3 (100 BTEST reward returned), and `BondRefunded` for challenge 3 (10 BTEST returned).
- `cleanup()` emitted `ChallengeExpired` for challenge 2 (100 BTEST returned) and `DemoCompleted`.
- Final coordinator stage was `3`; the paid, invalid and expired commitments were respectively `Settled`, `Slashed` and `Refunded`.
- Initial and final escrow BTEST balances were both `0`. Final synthetic balances were sponsor `410 BTEST`, solver `150 BTEST`, escrow `0 BTEST`.
- Runtime bytecode was present at the coordinator, escrow, BTEST token, training target and reviewer verifier addresses. The committed `web/bounty-proof.json` is the app-facing public gate and contains no secret material.

This evidence proves the BTEST lifecycle and receipt/accounting behavior only. It does not prove a real security finding, independent review, WIF funding, mainnet deployment or production readiness.
