# BEFORE Support — security and release gate

Assessment date: 2026-11-07. This document describes the Issue #16 implementation on branch `feat/issue-16-before-support`. It does not claim a real WIF transaction, a global history index, or an automatic recurrence system.

## Product boundary

BEFORE Support is a stable recipient-authenticated page for voluntary repeat WIF contributions:

1. A recipient creates a `SupportOffer` EIP-712 signature binding the official WIF contract, Robinhood Chain mainnet `4663`, exact recipient, exact amount, reminder cadence, bounded expiry and an unpredictable campaign ID.
2. A supporter opens the public link and sees the full destination, amount, cadence, network and expiry before connecting a wallet.
3. A supporter starts a new cycle explicitly. The cycle ID is device-generated and is not presented as onchain nonce enforcement.
4. BEFORE reuses Pay's fail-closed preflight and exact ERC-20 `transfer(recipient, amount)` transaction boundary. Every cycle requires a fresh wallet confirmation; no approvals, timers, custody or allowance are used.
5. BEFORE claims success only after public RPC revalidates transaction/receipt identity, sender, WIF destination, zero native value, exact calldata, success status, three confirmations and exactly one matching WIF `Transfer` event.
6. A verified receipt is saved as public proof in device-local history. Records are revalidated before display and are not a global campaign ledger.

`SupportOffer` uses its own domain (`BEFORE Support`) and primary type. A Pay request cannot be silently downgraded to a Support offer. Cadence is a device-local suggested return date only. It never sends a notification or authorizes an automatic payment. An offer can remain valid for at most 120 days so weekly/monthly returns are possible. Its signed terms cannot be revoked before expiry; creators should not use a longer expiry than needed. Each WIF transfer always requires fresh human approval.

## Duplicate-send policy

The state machine distinguishes `not-submitted`, `wallet-pending`, `submitted`, `mined-awaiting-confirmations`, `verified`, `known-reverted` and `uncertain`.

- The signed offer and cycle state are persisted in the URL before the wallet request.
- After `eth_sendTransaction` is called, the cycle is locked. A missing/ambiguous hash, delayed response, reload, RPC outage, wallet account change or network change cannot re-enable Support.
- Receipt polling and “Retry verification” are read-only.
- “Support again” is visible only after a verified receipt and clears the old cycle only after an explicit click. It generates a new cycle ID and requires a new wallet check and confirmation.
- A rejected or ambiguous transaction response is not treated as a safe retry. The cycle is locked so the owner can inspect wallet history first.

This is a client-side duplicate-send safeguard, not an onchain invoice or cross-device uniqueness guarantee. The same public offer can be used from another device; the UI does not claim to prevent that.

## Threat model and QA coverage

The pure Support tests cover typed-data binding, wrong chain/token/amount/cadence/expiry/campaign mutations, malformed and zero cycle IDs, signature recovery, public payload round-trips, exact transfer calldata and cadence-as-reminder behavior.

The browser regression covers 320/375/390/768/1280 px layouts, axe checks, full recipient visibility, keyboard-compatible native controls, missing wallet, wrong chain, rejected recipient signature, untrusted links, delayed wallet response followed by reload, edited pending status, ambiguous wallet response, RPC failure before send, repeated clicks, account/network pending events through the shared Pay policy, and a deliberate second cycle with two independently checked local mock receipts. No browser test broadcasts real WIF.

## Mainnet acceptance workflow

The code is ready for one human-controlled acceptance flow, but this repository currently has no owner authorization for a specific funded wallet, amount and recipient. The minimum external action is therefore intentionally pending:

1. The wallet owner chooses the recipient address and a small WIF amount and confirms that choice independently.
2. The owner opens the deployed `/app/support/` page, creates or opens the exact signed offer, checks the displayed official WIF contract and chain `4663`, and confirms the first standard transfer in the owner wallet.
3. The owner waits for mining, then supplies the public transaction hash. BEFORE and an independent read-only verifier must check the receipt and exact `Transfer` event at [Blockscout](https://robinhoodchain.blockscout.com/).
4. The owner deliberately clicks “Support again”, reviews the new cycle, confirms a second transfer, and supplies its public hash. The two hashes must be distinct and independently match the same recipient and offer amount.

No hash is recorded here until those owner-confirmed transactions exist. BTEST receipts and mocked browser hashes are not acceptable substitutes for rule 3.

## Flywheel assessment

The implementation answers the two reviewer questions with a concrete loop:

- Reason to return: the same stable creator/community page remains useful for ongoing voluntary support, and the supporter can inspect their own verified receipts plus a device-local suggested next-support date (no notifications).
- What moves more WIF: only an explicit new support cycle can call the standard WIF transfer; it cannot be triggered by a timer, page reload, retry or stored history.

This is a credible product mechanism, not proof of retention. Rule 7 remains **NO-GO until owner-confirmed public mainnet evidence demonstrates the first contribution and a second deliberate new cycle**. There is no official fixed transaction count; two receipts demonstrate repeat capability but do not prove long-term retention.

## Release decision

- Implementation/security: **GO for code review** after exact-head CI and protected-preview checks pass.
- Real WIF acceptance: **NO-GO / owner action required**; no transaction was broadcast by Codex or CI.
- Demo and final submission: **NO-GO** until the separate ship check, real receipts and owner-approved video/submission actions are complete.
