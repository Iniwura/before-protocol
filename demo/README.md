# BEFORE — private hackathon demo review cut

This is a **review asset**, not the final organizer video or a claim of real users.

- **Production source:** https://before-web-theta.vercel.app/ at release `0c26c3f`.
- **Mainnet receipts:** https://robinhoodchain.blockscout.com/tx/0x4f6b1b2d48f73643408418896a7de886be4a522bf583a1c3d1d9c104c3b42476 and https://robinhoodchain.blockscout.com/tx/0x7e5ca115c13fed7e36109478c9f454adc81c58c2c114f569624d95792f64033a.
- **Honest demonstration:** screenshots of actual deployed UI and real explorer receipts. A separate ephemeral signed sample offer is clearly labeled **SAMPLE / NO PAYMENT**; its wallet is neither funded nor used to transfer tokens. The receipts were generated earlier using controlled automated wallet acceptance and two distinct signed offers. This video does not portray those as a same-offer human user return.
- **Voiceover:** five original narrated audio previews, generated through the AI Voice Generator; no copyrighted music used.
- **Safety:** rendering never calls `eth_sendTransaction`, never approves or spends WIF, never generates/reveals persistent wallet keys, never runs a wallet extension.
- **Format:** actual 1920 × 1080 MP4 with audio, roughly 95 seconds.
- **Artifact:** the demo branch's GitHub Actions workflow uploads a review MP4 under **Actions → BEFORE demo review → Artifacts**, retained for 7 days; it does not upload to YouTube or the hackathon portal.

To build on GitHub Actions: push the branch. Or run locally:

```sh
npm ci --prefix qa
npm install --prefix demo
npx --prefix qa playwright install --with-deps chromium
node demo/build-review.cjs
```

**Owner approval required before public posting or final submission.** The authenticated organizer dashboard still needs verification; BEFORE was not visible among the 31 public project entries at the last read-only check.
