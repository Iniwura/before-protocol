> **Historical submission draft.** This describes an earlier product, before BEFORE Support's documented WIF mainnet transfers and the final uploaded demo. For current facts see the [root README](../README.md) and [documentation index](README.md).

# BEFORE — World Is Flat Hackathon submission package

**Status:** Technical prototype ready for owner review and public release. **Not yet submitted through the organizer's sign-in flow.**

## Submission-ready title and tagline

**BEFORE**  
**Know what you approved. Prove what happened.**

BEFORE connects two parts of safer onchain participation on Robinhood Chain: a wallet-free **read-only $WIF allowance checker on mainnet**, and a **testnet security-bounty workflow** that pays valueless BTEST only after a researcher's committed evidence receives appointed reviewer approval.

It demonstrates a simple principle: **trust should come after independently inspectable evidence**.

## What a first-time user can do

1. **Check $WIF permissions without connecting a wallet.** In `/app/wif/`, paste a confirmed WIF approval transaction hash or enter one owner/spender pair. BEFORE reads the official token contract on Robinhood mainnet (4663), shows the current allowance and WIF balance at the same block, explains unusually large permissions, and links back to the explorer. It never signs, sends, approves, or revokes transactions. It is *not* an audit or protection vault.
2. **Run a BTEST-only bounty on Robinhood testnet.** In `/app/bounty/`, choose **Post a test reward**, **Submit a finding**, or **Review a finding**. A sponsor publishes a reward and appoints reviewers; the researcher commits evidence with a refundable BTEST bond; appointed reviewers approve the exact evidence; the researcher reveals and settles after the deadline. Sponsors and researchers can recover eligible expired funds. All contract settlement occurs onchain.
3. **Inspect existing proof without a wallet.** In `/app/#proof`, inspect real testnet successful/blocked transfers and a practice-vault bypass. The separate public bounty demo at `/app/#challenge` includes deployed BTEST escrow receipts for start, settlement, and cleanup.

## Links

- **Public product (after approved release):** https://before-web-theta.vercel.app/
- **$WIF permission checker (mainnet reads):** https://before-web-theta.vercel.app/app/wif/
- **Bounty Studio (BTEST-only testnet actions):** https://before-web-theta.vercel.app/app/bounty/
- **Security demonstration and receipts:** https://before-web-theta.vercel.app/app/
- **Public GitHub source:** https://github.com/Iniwura/before-protocol
- **Robinhood Testnet escrow:** https://explorer.testnet.chain.robinhood.com/address/0xF9d644dd2024E2dFc425aA7c1059F9b4E720684a
- **Completed BTEST demo coordinator:** https://explorer.testnet.chain.robinhood.com/address/0x166E3367cdC9751A02570fedf8d700C4f70fCd1C
- **Mainnet $WIF token:** https://robinhoodchain.blockscout.com/token/0x5173b8eA6923c2d40267890D45C46a3480954773

## Public evidence to show judges

**Real, read-only mainnet utility:** Robinhood mainnet RPC verified chain 4663, the official WIF token code, symbol and 18 decimals. A direct browser read of a public wallet/spender pair returned a real WIF balance and current allowance. No key, signature or token movement was needed.

**Real BTEST-only public testnet state transitions:** Four successful, signer-bound transactions in the completed synthetic-reviewer lifecycle:

- [Deploy](https://explorer.testnet.chain.robinhood.com/tx/0x1e0e7783d9f46047c351d4b942344052892312c9f2ff0fa7f06e2b764b59e7dc)
- [Create/commit](https://explorer.testnet.chain.robinhood.com/tx/0x2ad4387c44ab0e1d5bf4f561318a9e8e8c493e7f8a6414cb980bf36603517789)
- [Review/settle](https://explorer.testnet.chain.robinhood.com/tx/0x74df2df93542458b66ae7751ceed7e28bd66b739bd43a5f6bedc1ba903aefd08)
- [Cleanup/refunds](https://explorer.testnet.chain.robinhood.com/tx/0x5e35f62052dc5d8bbaed2da78cbf3df3a2fed0d6254f49e940d74f0a772e5898)

**Onchain status:** synthetic reviewer quorum 2/2, funded mock reward settled, invalid bond slashed, unused/expired funds refunded, coordinator stage 3, mock escrow balance back to zero.

**Important precision:** The historical reviewer actors were **synthetic and all controlled by one operator**. They do not establish independent security research or an external audit. The new user-driven Bounty Studio passed real transactions with separate sponsor, solver and reviewer accounts on a disposable **local Anvil** chain, but that specific browser workflow has **not** been broadcast again with real users on public testnet. Never present a local browser E2E as a new public transaction.

## Engineering and QA

- Existing contract suite: **70 Solidity tests**, including adversarial/fuzz cases.
- Local browser-to-Anvil bounty workflow: sponsor → commit → reviewer approval → settle, plus cancellation/expiry refunds; no leftover mock escrow BTEST.
- Web policy, deployed evidence, testnet chain validation and ABI tests.
- WIF permission scanner: official token and network checks, amount precision, approval decoding, wrong-token/wrong-chain fail-closed behavior, no wallet-signing methods.
- Responsive layouts, WCAG checks and mobile/desktop browser regressions in CI.
- Source and full reproduction steps in [README.md](../README.md), [WIF_PERMISSION_CHECK.md](WIF_PERMISSION_CHECK.md) and [BOUNTY_STUDIO.md](BOUNTY_STUDIO.md).

## Explicit limitations

- **No real $WIF deposit, payout, staking, burning, or approval changes**. The WIF checker reads genuine mainnet state but does not enforce token spending rules.
- **No mainnet BEFORE security vault or mainnet bounty escrow**. The contract demonstration is on testnet with freely mintable, valueless BTEST.
- **No security audit or independent validation of a real exploit**. Sponsor-appointed reviewers must verify claims outside the app.
- The checker does not enumerate every spender; it verifies one identified owner/spender pair or one approval transaction.
- Real funds must not be sent to the demonstration contracts.

## Before clicking Submit

Confirm that the final production links work without Vercel Preview Authentication, and inspect the latest Vercel deployment and GitHub Actions for the exact release commit. Add the final demo video URL when available. Verify the organizer's live rules, submission deadline, and form fields directly at https://worldisflat.fun/build; the site uses an authenticated sign-in flow and **no submission is claimed in this repository**.

## 90-second video outline

1. **0–15 s, the problem:** Approvals are difficult to understand; security claims are not proof.
2. **15–33 s, real $WIF:** Paste a public WIF owner and spender. Show the **actual mainnet** balance, exact allowance and Blockscout evidence. State read-only; no wallet needed.
3. **33–55 s, clear product workflow:** Launch Bounty Studio, select **Post a test reward**, show researcher's private commitment and appointed review.
4. **55–76 s, independent evidence:** Show the real Robinhood testnet coordinator with confirmed start → settle → cleanup receipts and zero mock escrow balance. Label reviewers synthetic and token BTEST.
5. **76–90 s, close:** Four URLs: mainnet checker, testnet application, public source, public receipts. No WIF funds moved.

For exact narration, screen actions and on-screen proof disclaimers see [DEMO_VIDEO_SCRIPT.md](DEMO_VIDEO_SCRIPT.md).
