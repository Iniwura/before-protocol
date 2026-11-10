# BEFORE — replacement video recording pack

**Prepared:** November 10, 2026  
**Status:** Recording-ready storyboard and final narration. **No replacement MP4 has been recorded, uploaded, or submitted by this document.**  
**Source of truth:** [demo reboot](DEMO_REBOOT_LIVE_STORY.md) · [mainnet acceptance evidence](ISSUE_18_MAINNET_SUPPORT_EVIDENCE.md)

## Goal

Produce an approximately two-minute **human-readable, live-browser app walkthrough** for the World Is Flat hackathon. The story is **creator-signed WIF request → supporter checks → genuine mainnet receipts → optional voluntary return**. The old 110.8-second review video is *not* the final cut. Avoid a promo montage, a forced tour, and an all-features catalog.

**Opening question:** "How do I know this WIF request came from the creator, and what really arrived?"

**Value proposition:** A wallet sends WIF. BEFORE verifies a recipient-signed request before the transfer and verifies the chain's transaction proof afterward. The signature authenticates the request; it does not guarantee honesty of the recipient or make payments reversible.

## Capture sequence (target 120s, adaptable to actual voiceover)

| Target | Camera and *real* product interaction | Required visible distinction |
| --- | --- | --- |
| 00:00–00:13 | Start inside the production Support page at **Previous WIF transfers**, briefly show genuine mainnet history and a public receipt, then point to the problem. No splash sequence. | **REAL MAINNET TRANSFERS · CONTROLLED ACCEPTANCE, NOT CUSTOMER ADOPTION** |
| 00:13–00:24 | Scroll to **Create a support link**, with the first-screen Support choices visible. One sentence contrasting a raw wallet transfer with signed request + proof. | **BEFORE Support · Robinhood Chain mainnet (4663)** |
| 00:24–00:46 | Enter **200 WIF**; select a weekly *suggestion* and a bounded expiry; use a disposable, unfunded demonstration recipient to sign the actual EIP-712 SupportOffer; show the generated link. | **OFF-CHAIN DEMO SIGNATURE · NO WIF SENT** persistent during signing |
| 00:46–01:07 | Open the real signed offer link. Show amount, receiving address, network and fixed official WIF token; run preflight with **explicitly simulated EIP-1193 payer wallet**, if it can complete without sending. Keep the send function hard-blocked. | **SIMULATED PAYER WALLET · NO TRANSFER IN THIS CLIP** |
| 01:07–01:35 | Open **Previous WIF transfers** in the real page. Search **actual acceptance recipient** `0x02fb3352e593f4bcbff5a845e7a0f90ca4a87f0d`. Retrieve real entries and click *both* Blockscout transaction links. Show 200 WIF, real token, recipient, status. If RPC is unavailable, pause capture; never substitute fabricated results. | **TWO INDEPENDENTLY CHECKED 200-WIF MAINNET RECEIPTS · 400 WIF TOTAL** |
| 01:35–01:48 | Return to Support. Show the optional repeat cadence, explicit new confirmation and calendar reminder explanation. Do **not** fake a successful new payment or render an unearned proof panel. The three-step optional in-app tour is a 3–5s cameo at most, only if it aids clarity. | **VOLUNTARY RETURN · NO AUTO PAYMENTS / NOTIFICATIONS** |
| 01:48–02:00 | Finish on the live Support create action, then GitHub source and legible public receipts. The one action is **Create a signed WIF Support link**. | **LIVE PRODUCT · OPEN SOURCE · PUBLIC RECEIPTS** |

These are editing targets, not proof of video duration. Confirm any maximum duration in the authenticated organizer portal before exporting. The actual narration may run longer or shorter depending on delivery; prioritize a readable uninterrupted explanation over a forced 120-second target.

## Final voiceover transcript (revised for separate recipient attribution)

A creator shares a wallet address and asks for WIF. How does a supporter know the request really came from them? And once they pay, how can anyone verify what arrived?

This is BEFORE. A wallet can send tokens. BEFORE adds a signed request before payment, and independently checkable proof afterward.

Let's create a Support offer in the live app. I choose two hundred WIF, an optional weekly return suggestion, and an expiry. Then the creator signs these exact terms. This is an off-chain demonstration signature. No WIF is transferred.

Now I open the link as a supporter. BEFORE shows the signed recipient, amount, official WIF token, and Robinhood Chain network. It verifies the offer and checks the conditions for a transfer. Every real contribution still requires a new confirmation in the supporter's wallet. The payer wallet in this walkthrough is simulated. We're not sending any new WIF here.

The evidence is real, but it is separate from that demo offer. I switch to the recipient wallet from our earlier production acceptance test. BEFORE finds two genuine mainnet payments of two hundred WIF each and links to their original Blockscout receipts. Anyone can inspect the sender, token, amount, recipient and confirmed status.

Those transfers prove actual WIF movement, not independent customer adoption or attribution to a specific BEFORE campaign.

Supporters can return by choice. There's an optional calendar reminder, but no subscription, automatic charge, or custody.

BEFORE is live. The source code and transaction evidence are public. Create a signed WIF support link. Check before you pay. Prove what happened.

## Canonical real proof

- Product: https://before-web-theta.vercel.app/app/support/
- Optional in-app tour: https://before-web-theta.vercel.app/app/support/?tour=1
- Code: https://github.com/Iniwura/before-protocol
- Actual public-history recipient: `0x02fb3352e593f4bcbff5a845e7a0f90ca4a87f0d`
- Official token: `0x5173b8eA6923c2d40267890D45C46a3480954773` (Robinhood Chain mainnet 4663)
- Receipt A: https://robinhoodchain.blockscout.com/tx/0x4f6b1b2d48f73643408418896a7de886be4a522bf583a1c3d1d9c104c3b42476
- Receipt B: https://robinhoodchain.blockscout.com/tx/0x7e5ca115c13fed7e36109478c9f454adc81c58c2c114f569624d95792f64033a

These acceptance transfers were executed from controlled authorized wallets on November 8 using **two separately signed Support offers**, not a proven same-offer organic recurring payment. Ordinary ERC-20 Transfer logs cannot prove a specific BEFORE campaign.

## Recording, edit and release quality gates

- **REAL browser actions:** show input → click → actual result. No synthetic "successful" WIF receipt, fake wallet extension, hand-composited app state, or stock promo video.
- **SAFE payer test:** signature-only demo wallet may sign off-chain; payer wallet is simulated with `eth_sendTransaction` blocked. No keys, seed phrases, keystores, approvals or new broadcast transactions in this recording.
- **NO false causation:** real receipts are historical independent acceptance evidence. Do not imply the demo signature or simulated preflight generated those specific mined hashes.
- **LEGIBLE:** 1920×1080 H.264/AAC MP4; capture full browser, crop unneeded browser chrome; readable 200 WIF, official token, signed recipient, receipt status and explorer hashes; deliberate cursor; strong contrast and closed captions.
- **AUDIO:** calm, articulate, natural narration; no forced hype, loud backing music or overly frequent jump cuts. Align the actual generated full voiceover, not just the preview.
- **POST-RENDER QA:** watch from beginning at 1× speed and on a phone; confirm readable captions, no dead time, no false claims, no secrets, opening hook, clear differentiation, and proof before the halfway point if pacing permits.
- **ORGANIZER GATE:** verify the signed-in project entry and media limits, publish the approved video to an accepted publicly accessible destination, paste the actual video URL, ensure all required fields are complete, submit **before November 12, 2026 17:30 UTC**, and retain the submission acknowledgment. Registration alone is insufficient.

**Do not confuse production readiness with submission completion.** The live app and onchain acceptance exist; this file is a recording guide, not an exported video or proof of organizer submission.
