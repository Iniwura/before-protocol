# BEFORE Support — security and release gate

Assessment date: 2026-11-08. Support's real-WIF source originally shipped at `f7dd6bf1bf273846fd35705c851312f534625dbe`; the current merged source `951626c4059004ea7a39ac48230e9c06c0c82fc0` adds opt-in calendar export and clearer creator/visitor onboarding without altering the transaction/receipt logic. Two genuine WIF Support receipts were independently checked; no global history index, organic retention or automatic recurrence is claimed.

## Product boundary

BEFORE Support is a stable recipient-authenticated page for voluntary repeat WIF contributions:

1. A recipient creates a `SupportOffer` EIP-712 signature binding the official WIF contract, Robinhood Chain mainnet `4663`, exact recipient, exact amount, reminder cadence, bounded expiry and an unpredictable campaign ID.
2. A supporter opens the public link and sees the full destination, amount, cadence, network and expiry before connecting a wallet.
3. A supporter starts a new cycle explicitly. The cycle ID is device-generated and is not presented as onchain nonce enforcement. The signed public offer can last up to 120 days, but each internal transfer intent is capped to the existing BEFORE Pay 30-day validation window. This does not extend one-off Pay validity or authorize an automatic transaction.
4. BEFORE reuses Pay's fail-closed preflight and exact ERC-20 `transfer(recipient, amount)` transaction boundary. Every cycle requires a fresh wallet confirmation; no approvals, timers, custody or allowance are used.
5. BEFORE claims success only after public RPC revalidates transaction/receipt identity, sender, WIF destination, zero native value, exact calldata, success status, three confirmations and exactly one matching WIF `Transfer` event.
6. A verified receipt is saved as public proof in device-local history. Records are revalidated before display and are not a global campaign ledger.

`SupportOffer` uses its own domain (`BEFORE Support`) and primary type. A Pay request cannot be silently downgraded to a Support offer. Cadence begins as a device-local suggested date. A completed, verified weekly/monthly contribution optionally allows downloading a single `.ics` calendar reminder that carries only the public signed offer link. Import is entirely the supporter's choice. BEFORE sends no notification and never authorizes an automatic payment. An offer can remain valid for at most 120 days so weekly/monthly returns are possible. Its signed terms cannot be revoked before expiry; creators should not use a longer expiry than needed. Each WIF transfer always requires fresh human approval.

## Duplicate-send policy

The state machine distinguishes `not-submitted`, `wallet-pending`, `submitted`, `mined-awaiting-confirmations`, `verified`, `known-reverted` and `uncertain`.

- The signed offer and cycle state are persisted in the URL before the wallet request.
- After `eth_sendTransaction` is called, the cycle is locked. A missing/ambiguous hash, delayed response, reload, RPC outage, wallet account change or network change cannot re-enable Support.
- Receipt polling and “Retry verification” are read-only.
- “Support again” is visible only after a verified receipt and clears the old cycle only after an explicit click. It generates a new cycle ID and requires a new wallet check and confirmation.
- A rejected or ambiguous transaction response is not treated as a safe retry. The cycle is locked so the owner can inspect wallet history first.

This is a client-side duplicate-send safeguard, not an onchain invoice or cross-device uniqueness guarantee. The same public offer can be used from another device; the UI does not claim to prevent that.

## Threat model and QA coverage

The pure Support tests cover typed-data binding, wrong chain/token/amount/cadence/expiry/campaign mutations, malformed and zero cycle IDs, signature recovery, public payload round-trips, exact transfer calldata, cadence-as-reminder behavior and bounded one-time calendar export that never calls a wallet.

The browser regression covers 320/375/390/768/1280 px layouts, axe checks, full recipient visibility, keyboard-compatible native controls, missing wallet, wrong chain, rejected recipient signature, untrusted links, delayed wallet response followed by reload, edited pending status, ambiguous wallet response, RPC failure before send, repeated clicks, account/network pending events through the shared Pay policy, and a deliberate second cycle with two independently checked local mock receipts. No browser test broadcasts real WIF.

## Mainnet acceptance workflow

Issue #18 authorized two fresh isolated local wallets, a bounded payer budget and at most two intentional contributions. The completed acceptance used the deployed `/app/support/` page in a controlled browser with a transparent local EIP-1193 signer harness. The harness was automated wallet acceptance, not a human-extension click claim; private material stayed in encrypted local keystores and was never sent to the page or repository.

1. The creator wallet signed a `SupportOffer` for the fresh creator address, official WIF, chain `4663`, exact `200 WIF` amount and bounded expiry.
2. The payer preflight checked the official token bytecode/metadata, signed recipient, payer WIF/ETH balances, exact `transfer` calldata and gas before each wallet call.
3. The first cycle broadcast nonce `0`. Its browser proof wait timed out after the wallet returned, so it was not retried; read-only nonce/balance/log recovery found and independently verified the mined receipt.
4. After the first receipt passed independent checks, the remaining authorized cycle used a fresh signed Support offer and broadcast nonce `1`. It also passed the production Support proof path and independent verification.

Public evidence is recorded in [Issue #18 mainnet evidence](ISSUE_18_MAINNET_SUPPORT_EVIDENCE.md). The two hashes are distinct and each matches the same payer, creator, official WIF contract, exact amount, successful receipt and `Transfer` event. BTEST receipts and mocked browser hashes are not substitutes for rule 3.

## Flywheel assessment

The implementation answers the two reviewer questions with a concrete loop:

- Reason to return: the same stable creator/community page remains useful for voluntary support. The supporter can inspect revalidated receipts, see a suggested next date, and optionally download a one-time calendar event for manual import (not an app notification, backend reminder or recurring payment).
- What moves more WIF: only an explicit new support cycle can call the standard WIF transfer; it cannot be triggered by a timer, page reload, retry or stored history.

This is a credible product mechanism, and the two public receipts now demonstrate repeat-capable WIF movement. They are not proof of organic retention: the first browser context required read-only recovery and the second cycle used a fresh signed offer rather than resuming the discarded context. There is no official fixed transaction count; do not claim long-term retention or a global campaign ledger.

## Release decision

- Implementation/security: **ENGINEERING GO / SHIPPED**. Full exact-head hosted `test` and `browser-quality` passed in [CI 42493477032](https://github.com/Iniwura/before-protocol/actions/runs/42493477032). Merged release `951626c` and exact Vercel production alias READY were verified independently, including 6/6 HTTP routes. This is not a formal independent security audit.
- Real WIF acceptance: **PASS for the bounded Issue #18 exercise**; two exact public mainnet receipts independently verified. No third transaction was broadcast.
- Demo and final submission: **SEPARATE PENDING STEPS**. The production source and receipts are ready; a genuine demo and signed-in organizer entry/confirmation have not been completed. No additional WIF transfers are needed to certify the present release.
