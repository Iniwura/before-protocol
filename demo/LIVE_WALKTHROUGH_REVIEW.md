# BEFORE — real-browser live walkthrough review cut

**Recorded:** November 9, 2026. **Format:** 1920 × 1080 H.264/AAC MP4, 110.8 seconds. **Status:** private owner-review artifact; **NOT** the official organizer submission.

This version replaces the earlier screenshot slideshow with a genuine Playwright-controlled recording of the live BEFORE production interface at source commit `dc5bc78300efcccc05e77ddc944563897c1c4af1`:

1. Open BEFORE and choose Support.
2. Set a 200-WIF, weekly, 30-day signed support offer. Sign genuine EIP-712 typed data **off-chain** using a fresh, disposable, unfunded demonstration wallet.
3. Open that cryptographically valid signed offer as a supporter. Read the exact recipient, chain, token and amount. Run the app's preflight against the chain using a **simulated payer wallet identity**. **No demo transfer is signed or broadcast**, and any attempt to call `eth_sendTransaction` is hard-blocked.
4. In the actual new in-app public-history viewer, load the recipient used for the preexisting real WIF acceptance tests. BEFORE revalidates two public 200-WIF mainnet transfers (400 WIF total), then show the real blockchain explorer receipts.
5. Briefly show one-off Pay and the read-only WIF Permission Check, return to the landing and evidence.

The narration contains **original text and voice**, no copyrighted music. Captions distinguish **DEMO SIGNER / NO PAYMENT SENT** from **REAL WIF MAINNET RECEIPTS**. The existing real transactions were earlier created with the controlled funded signer and **two distinct signed offers**, not real human customer adoption or a same-offer organic second payment. Standard ERC-20 transfers have **no embedded BEFORE campaign ID**; incoming public WIF history cannot claim attribution to BEFORE.

## Review download

The downloadable MP4 is retained as `BEFORE-LIVE-WALKTHROUGH-REVIEW` under the [GitHub Actions workflow run](https://github.com/Iniwura/before-protocol/actions/workflows/before-live-review.yml) on this branch. Open the run, select the artifact and unzip. It is not on YouTube or the hackathon portal.

**Final acceptance gates:** owner video review; actual signed-in [World Is Flat dashboard](https://worldisflat.fun/build/me) project status and eligibility; final public upload; final submission acknowledgment. No further WIF spending or new contract required.
