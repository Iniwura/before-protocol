# Issue #8 public-testnet evidence

Recorded 2026-11-07 from read-only Robinhood Chain Testnet RPCs. The network is chain ID `46630`. This report separates the previously existing Bounty #5, the historical synthetic coordinator and the new three-wallet acceptance lifecycle.

## Bounty #5: verified, preserved, not completed here

The public Bounty #5 creation receipt is successful and was sent by its original sponsor, `0xa35dc047f9937bf668743efbdf8ea93b31a55888`:

- [creation transaction](https://explorer.testnet.chain.robinhood.com/tx/0x9009a56b0c5009482e80ba3b39c91a25c39125a76210b81054dc5aea2863e3c8)
- challenge escrow: [`0xF9d644dd2024E2dFc425aA7c1059F9b4E720684a`](https://explorer.testnet.chain.robinhood.com/address/0xF9d644dd2024E2dFc425aA7c1059F9b4E720684a)
- BTEST: [`0xf080A1a012F2Dd41c4F416Befd6D70074af75A4C`](https://explorer.testnet.chain.robinhood.com/address/0xf080A1a012F2Dd41c4F416Befd6D70074af75A4C)
- practice target: [`0x7e29bC6Df38e60E77513bc1084dB488FeE12947c`](https://explorer.testnet.chain.robinhood.com/address/0x7e29bC6Df38e60E77513bc1084dB488FeE12947c)
- reviewer gate: [`0x1391916cc9012ece416f682227d99373f1631eaa`](https://explorer.testnet.chain.robinhood.com/address/0x1391916cc9012ece416f682227d99373f1631eaa)
- reviewer-gate creation: [transaction](https://explorer.testnet.chain.robinhood.com/tx/0xb9730e204566fd7ebf3d25636569715d4e6bad4528a8a84dd0e7e1671fa475e8)

The creation event and state readback match reward `1 BTEST`, bond `0.1 BTEST`, the escrow/token/target above, and the appointed reviewer `0x32eb3a89f6605955c138dcdb417379b69a789a89`. At the audit head, its reveal deadline had expired; commitment count was `0`, reward released was `false`, canceled was `false`, and the escrow still held exactly `1 BTEST`. No commitment, approval, settlement, refund, expiry or cancellation events were found for challenge #5. It was left untouched because the approved `before-testnet` signer is not its sponsor.

The creation receipt was independently cross-checked through the BlockVectra public RPC. That endpoint confirms chain `46630`, receipt status `0x1`, the same transaction hash, block and escrow destination; its documented method set does not include `eth_getLogs`, so event conclusions come from the canonical RPC audit.

## Historical BTEST-only synthetic demonstration

This is genuine public-chain execution, but all roles were synthetic contracts controlled by one operator and it is not independent human review:

- coordinator: [`0x166E3367cdC9751A02570fedf8d700C4f70fCd1C`](https://explorer.testnet.chain.robinhood.com/address/0x166E3367cdC9751A02570fedf8d700C4f70fCd1C)
- [deploy](https://explorer.testnet.chain.robinhood.com/tx/0x1e0e7783d9f46047c351d4b942344052892312c9f2ff0fa7f06e2b764b59e7dc)
- [start: four challenges, three commitments, two approvals and one cancellation](https://explorer.testnet.chain.robinhood.com/tx/0x2ad4387c44ab0e1d5bf4f561318a9e8e8c493e7f8a6414cb980bf36603517789)
- [settle: payment, invalid-evidence slash, expiry and bond refund](https://explorer.testnet.chain.robinhood.com/tx/0x74df2df93542458b66ae7751ceed7e28bd66b739bd43a5f6bedc1ba903aefd08)
- [cleanup: final expiry refund and completion](https://explorer.testnet.chain.robinhood.com/tx/0x5e35f62052dc5d8bbaed2da78cbf3df3a2fed0d6254f49e940d74f0a772e5898)

All four receipts are successful and signer-bound to `0xd1061825504b30f404c0d94b745205925f251f2c`. Independent read-only checks confirm coordinator stage `3`, exact event matrices, final synthetic sponsor balance `410 BTEST`, solver balance `150 BTEST`, and coordinator balance `0 BTEST`. No real `$WIF` was funded.

## Fresh public acceptance lifecycle: three authorized disposable wallets

The owner authorized two additional isolated disposable signers on Issue #8. The three distinct role addresses are now:

- `before-testnet` → `0xd1061825504b30f404c0d94b745205925f251f2c`
- `before-researcher` → `0x86923864B7a7C7CfA1A56398DA6cA2a622756989`
- `before-reviewer` → `0xC7E69617ED81A0a7dD0cD74f82B176E22555097F`

All three addresses are distinct. The new isolated keystore directory is owner-only (`0700`); each keystore and password file is owner-only (`0600`). No key, password or recovery material is part of this report or repository.

Following the owner's explicit Issue #8 authorization, the approved sponsor funded exactly `0.0001 ETH` to each new wallet. Preflight returned chain `46630`, gas price/base fee `10,000,000 wei` (`0.01 gwei`) and `21,000` estimated gas per transfer. The planned transfer budget was `0.0002 ETH` plus `0.00000042 ETH` gas. Both funding receipts succeeded:

- [researcher funding](https://explorer.testnet.chain.robinhood.com/tx/0x03bc9186fea303c929eb3d3d3afb642ed24c7740d0c4ab395e85852172036e7b)
- [reviewer funding](https://explorer.testnet.chain.robinhood.com/tx/0x5f3be57e953de09f6e07132cb7aab6c62faa36ec7a95735ca10dca6e637db8bf)

The lifecycle was script-driven through the three encrypted local keystores, not a simulated browser wallet journey. It used only freely mintable BTEST and the existing training target:

| Step | Public transaction | Result |
| --- | --- | --- |
| Reviewer gate deployment | [0xcbbc…8912](https://explorer.testnet.chain.robinhood.com/tx/0xcbbc2181ee5a4523a5f70b884268fa1cb2d4286c4cb934e1aa981c4c61da8912) | Runtime matches pinned artifact; threshold 1; reviewer authorized |
| Sponsor BTEST mint | [0xb962…a06ed](https://explorer.testnet.chain.robinhood.com/tx/0xb96217814cd1336b56d7d1afbcad01bc2c58db0996f60a2ca068699eab9a06ed) | 1 BTEST minted |
| Sponsor approval | [0x0bb4…dec4](https://explorer.testnet.chain.robinhood.com/tx/0x0bb40a67b4a78da432bf241155752e268f516701bcc7b94d70a42a9e2eacdec4) | Exact reward approval |
| Initial short-window attempt | [0xc3cf…925f](https://explorer.testnet.chain.robinhood.com/tx/0xc3cf4c65c5fb0e48a7c03e6e85fa13b1b8a9f9ddb22f02e425df2288f9b3925f) | Challenge 6 opened but no commitment was submitted |
| Unused reward refund | [0x5463…312a](https://explorer.testnet.chain.robinhood.com/tx/0x546323d0cbf985603b11f3a6df4e4a3775f17ba7268ade4b2759a181e0a312a5) | Challenge 6 expired/refunded; commitment count 0 |
| Fresh sponsor approval | [0x314d…dece](https://explorer.testnet.chain.robinhood.com/tx/0x314d7cfc967ed6a312054a59477d2f8d13cd42bdbf0e7364df91717784c0dece) | Exact reward approval |
| Fresh challenge creation | [0x5b54…a9a1](https://explorer.testnet.chain.robinhood.com/tx/0x5b54ab0f8db383cde66ff40a59ab7b926090d17f1854183a88ca2486b288a9a1) | Challenge 7; reward 1 BTEST; bond 0.01 BTEST |
| Researcher BTEST mint | [0x981f…cd19](https://explorer.testnet.chain.robinhood.com/tx/0x981fbe416c915e100b2bc3fc81ed966cf5ee7aa27c85dcbfe89ae18ca624cd19) | Bond funded with BTEST |
| Researcher approval | [0x33ad…2b89](https://explorer.testnet.chain.robinhood.com/tx/0x33ad8be9608f16394e0aa13ac74f71c77cce88fb44c97f1745c288cddf1e2b89) | Exact bond approval |
| Researcher commitment | [0x4a00…0ddd3](https://explorer.testnet.chain.robinhood.com/tx/0x4a00d1d9133670b738571823ee9e93d0dc861f938fcf832c1cbe121a4ab0ddd3) | CommitmentSubmitted emitted |
| Appointed reviewer approval | [0x7682…b6bec](https://explorer.testnet.chain.robinhood.com/tx/0x7682cbf90feac893c20cae875d4c1b8b216eae8a4faca813c2f31b505fab6bec) | FindingApproved emitted by the reviewer wallet |
| Reveal and settlement | [0x17ec…50f5c](https://explorer.testnet.chain.robinhood.com/tx/0x17ecb3839f4c249fa1ca7c0283a191675d6f38256a498afda83059ec21750f5c) | RewardPaid emitted; no InvalidEvidence |

The final fresh challenge is challenge `7` at the existing escrow [`0xF9d644dd2024E2dFc425aA7c1059F9b4E720684a`](https://explorer.testnet.chain.robinhood.com/address/0xF9d644dd2024E2dFc425aA7c1059F9b4E720684a). Independent read-only verification in [`qa/issue-8-fresh-bounty-audit.mjs`](../qa/issue-8-fresh-bounty-audit.mjs) confirms every listed receipt is successful and signer/target-bound, all four contract runtimes are present, the reviewer gate is pinned and quorum-authorized, challenge 7 is settled with zero commitments, approvals are consumed, researcher accounting is credited by exactly 1 BTEST, escrow remains at exactly 1 BTEST for untouched Bounty #5, and Bounty #5 has no lifecycle events.

The full observed gas across the authorized funding, setup, abandoned-window refund and final lifecycle receipts was `1,736,292` gas, or `0.000017362920000000 ETH` at the observed `0.01 gwei` price. The run used no real WIF, mainnet transaction or production action. Because the three wallets were operated by one owner-controlled environment, this is a three-wallet acceptance demonstration, not independent human security review.

## Reproduction

The read-only audits are:

```sh
node qa/issue-8-public-testnet-audit.mjs
node qa/issue-8-fresh-bounty-audit.mjs
```

They refuse to sign or broadcast. The fresh audit checks chain identity, every funding/setup/lifecycle receipt, signer and destination binding, deployed bytecode, reviewer-gate constructor/runtime, challenge 6 refund, challenge 7 quorum/reveal/settlement events and state, Bounty #5 accounting and absence of Bounty #5 lifecycle events.
