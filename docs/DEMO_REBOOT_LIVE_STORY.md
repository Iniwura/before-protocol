> **Historical video planning record, not the final demonstration.** The latest uploaded walkthrough is [here](https://youtu.be/YC7t2mql-cI). For current scope and onchain evidence use the [root README](../README.md).

# BEFORE — winning-focused demo reboot

**Date:** November 10, 2026.  
**State:** Script and release plan. **Not a completed replacement video or final organizer submission.**  
**Reference:** [Seldra Official Demo](https://youtu.be/tP01iL8W8NI) for a human-led real-app walkthrough, not copied visuals.

## Editorial finding

The previous 110.8-second [live walkthrough review](https://github.com/Iniwura/before-protocol/actions/runs/42705638876) had genuine app navigation, an EIP-712 demo signature, read-only public preflight, two actual mainnet receipts and original narration. It lacked a differentiated problem, an early "why not just use a wallet" answer, a concrete creator use case and a compelling closing action. It also held views longer than necessary while moving among secondary tools. **Do not submit that cut unchanged.**

Professional reference principles:

- [Devpost video-making best practices](https://help.devpost.com/article/84-video-making-best-practices): establish the product and hackathon fit immediately, record genuine software, edit confusing downtime, and deliver a watchable public video.
- [Devpost winning hackathon video tips](https://info.devpost.com/blog/6-tips-for-making-a-hackathon-demo-video): problem, solution, actual use, technology, fit, concise narration and visible results.
- [Nielsen Norman Group: onboarding vs contextual help](https://www.nngroup.com/articles/onboarding-tutorials/): don't force a tutorial to conceal confusing architecture. Keep help optional, contextual and replayable.
- [Intercom Product Tours](https://www.intercom.com/help/en/articles/3095688-best-practices-for-using-product-tours): one short process, step-specific value, skip and task context.

## One-sentence winning story

> A wallet can transfer WIF. BEFORE makes the creator's request signed and independently checkable **before payment**, then lets anyone verify the **actual transfer after payment**.

Focus: creator → supporter → public proof → voluntary return. **Not** an all-feature app tour and **not** a cybersecurity contract demonstration.

## Proposed 120-second video shotlist

| Time | Real visible action | What judge must understand |
| --- | --- | --- |
| 0–12s | Fast close-up of live BEFORE Support and real WIF history, not a long logo intro | "Did the right creator request this WIF, and did it really arrive?" |
| 12–24s | First-screen creator and supporter choices; show official WIF chain and no-custody promise | Why BEFORE adds signed payment intent above raw wallet transfers |
| 24–47s | In the live app, enter an exact WIF amount, cadence and expiry, then produce a legitimate **off-chain demo-wallet** EIP-712 signature | **DEMO SIGNER · OFF-CHAIN ONLY · NO NEW WIF SENT**. The recipient authenticates the request; no approval is created |
| 47–68s | Open the generated link as a supporter; show signed recipient, amount, chain and checks; real RPC preflight, simulated EIP-1193 payer identity | Each payment requires a fresh wallet confirmation, with a fail-closed state on uncertainty. **DO NOT click a simulated send and pretend it generated a genuine receipt** |
| 68–94s | Navigate to public WIF transfer history, enter **the actual acceptance recipient**, load both independently rechecked 200-WIF receipts, click each Blockscout page | Two genuine real mainnet transfers, total 400 WIF. They came from controlled acceptance using two different signed offers; onchain transfers **do not encode a BEFORE campaign ID** |
| 94–108s | Show saved history distinction and optional opt-in return reminder. If using the new three-step guided tour, give it at most a brief 5-second cameo | A reason to return voluntarily; **no subscriptions, custody, automatic payments or proven organic retention** |
| 108–120s | Return to the creator Support button and include repo/evidence in end frame | Specific call to action: **Create a signed WIF support link**; proof, source and live site are public |

**Working target:** about **120 seconds**, but verify the signed-in World Is Flat submission form's actual duration/file rules before final export; an industry-standard duration is not the organizer's rule.

## Suggested new narration (draft)

A creator asks for WIF. A supporter gets an address. But how can they prove the creator made the request, or that the right amount actually arrived?

A wallet can transfer WIF. BEFORE does something different: it links a signed request to an independently verifiable payment.

I'm on the live app. First, I'll create a support offer: two hundred WIF, a suggested return date and an expiry. The creator signs the exact terms. This is a legitimate off-chain demo signature, not a WIF payment or spending permission.

Now I'm opening the shared link as a supporter. Here are the recipient, the official WIF contract on Robinhood Chain and the exact amount. BEFORE checks the signed request, wallet state, token balance and gas. Every contribution still needs a separate wallet confirmation.

And here's the real proof. Inside BEFORE, I can look up an actual recipient and recover previous transfers across devices. These two transactions each sent two hundred WIF on mainnet. I can open the original public receipts and check what really happened. Both came from controlled acceptance tests with separately signed offers, not imaginary customers.

People can return to support voluntarily, and a calendar reminder is optional. There are no automatic charges or approvals. One-off Pay and a read-only WIF permission checker are available separately.

The source is public, the product is live, and the payments are independently checkable. BEFORE: create a signed WIF support link, verify what you're sending and prove what happened.

## Production rules

1. Record **actual browser clicks and state changes**, not screenshots padded to fit narration. Show input → action → result within seconds.
2. Keep product UI large and legible; crop browser chrome, enlarge receipts and magnify exact transaction fields rather than shrinking a desktop to a tiny area inside a decorative frame.
3. Record in 1920 × 1080 H.264/AAC MP4; coherent voice, closed captions, no distracting backing music. Never hide details with visual effects.
4. Cut dead scroll time, blank RPC waits, redundant visits, and secondary screens that don't change the judge's decision.
5. Visually separate **OFF-CHAIN DEMO SIGNATURE** / **SIMULATED WALLET, NO TRANSFER** / **REAL MAINNET RECEIPT**. Never imply the first caused the latter.
6. Demonstrate the flywheel as a repeat *choice*, not a subscription or proven retention. Show the exact end-user return action.
7. Keep the optional [3-step in-app tour](https://before-web-theta.vercel.app/app/support/?tour=1) available after merge; it must **not** block existing signed offer links or force onboarding.
8. Owner must review the final video; then publish to an organizer-accepted public/unlisted destination, confirm the authenticated project entry, and preserve the actual submission acknowledgment.

## True hard gates

- World Is Flat requires public source, a working live product through judging, an actual video, real onchain WIF usage and a return-use loop. Existing audited mainnet transfers meet the real-use evidence requirement but **not** user adoption.
- Confirm the actual event-specific media cap/fields in the authenticated portal; the public event page has not conclusively exposed a maximum runtime. Do not extrapolate requirements from Devpost's general advice.
- The product's new public WIF history is not proof that transfers belong to a specific BEFORE signed offer: standard ERC-20 transfer logs have no campaign identifier.
- No further real-WIF spend or contract deploy is needed for a valid, honest demo; never fake blockchain receipts.
