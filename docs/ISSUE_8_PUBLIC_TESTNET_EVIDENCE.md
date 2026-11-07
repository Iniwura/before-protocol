# Issue #8 public-testnet evidence

Recorded 2026-11-07 from two read-only Robinhood Chain Testnet RPCs. The network is chain ID `46630`. This report separates the previously existing Bounty #5 from the historical synthetic coordinator and does not claim a new public lifecycle.

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

## Fresh public acceptance lifecycle: blocked before broadcast

The owner instruction on Issue #8 requires three distinct, authorized, isolated disposable testnet signing accounts for sponsor, researcher and reviewer. The only authorized local signer available is:

- `before-testnet` → `0xd1061825504b30f404c0d94b745205925f251f2c`
- chain ID: `46630`
- current testnet ETH balance: `0.009871307120000000`
- local permissions: keystore directory `0700`; keystore and password file `0600`

No second or third authorized keystore/password pair is present in the isolated signer directory. The other Foundry keystore names belong to pre-existing accounts and are explicitly out of scope. No new secret was generated, extracted, opened, printed, transmitted or used. Therefore no fresh sponsor transaction was broadcast, and there are no fresh creation/commit/approval/reveal receipts to report.

The exact owner action needed is to authorize and provide access to three distinct disposable testnet signers (or conduct their wallet signatures directly), with legitimate faucet ETH for gas. Once that authorization exists, the released browser flow can be exercised and every receipt, event and final BTEST balance can be added here. The existing Bounty #5 remains intact.

## Reproduction

The read-only audit is:

```sh
node qa/issue-8-public-testnet-audit.mjs
```

It refuses to sign or broadcast and checks chain identity, deployed bytecode, Bounty #5 calldata/receipt/event/state, reviewer-gate constructor and runtime, absence of Bounty #5 lifecycle events, and the historical synthetic receipt/event/accounting matrix.
