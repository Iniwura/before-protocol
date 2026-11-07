# BEFORE — final pre-demo engineering and product audit

**Date:** 7 November 2026  
**Repository:** https://github.com/Iniwura/before-protocol  
**Production baseline:** `main` at `18b37397c91361135ecec8586d38158e3dfe262f` (prior to audit UX patch)  
**Audit candidate:** PR #15 `audit/final-pre-demo-ux-2026-11-07`, exact final head and CI to be verified before promotion  
**Auditor:** AI-assisted, independent *source review* relative to the earlier implementation, **not** a commissioned third-party smart-contract audit or certification.

## 1. Executive decision

**Code/architecture:** structurally sound for a hackathon prototype and strong adversarial test coverage. No independently confirmed critical exploit was identified in the manually inspected source. That is **not** proof no exploit exists. BEFORE is not approved for valuable third-party token custody.

**User experience:** the shipped landing failed the five-second test: it prominently launched Bounty Studio while the hackathon-relevant BEFORE Pay product was buried. Payers also lacked a clear place to paste a payment link, and a mobile payer could only see the full destination address via a desktop-oriented tooltip. These have targeted fixes and new tests in PR #15, without redesigning the visual language.

**Competition:** the product now technically supports real WIF payment requests and human-signed ERC-20 transfers, but **no mainnet WIF transfer through BEFORE has been executed or verified**. Mainnet WIF utility is therefore *implemented, not live-transaction-proven*. BTEST challenge #7 is verifiably complete on public Robinhood **testnet**, using three distinct owner-controlled accounts, not independent reviewers. Demo video and confirmed organizer submission remain missing. **Final competition submission: NO-GO until those are resolved.**

**Readiness recommendation:** merge PR #15 only when exact-head CI and the new UI smoke tests pass, then verify live production aliases/paths. Do not expand into a new smart contract, spending scheme, staking, or wagering flow before the deadline.

## 2. Audit coverage and limitations

### Actual reviewed source

- `src/WifSecurityChallenge.sol`: reward/solver bond escrow, commit/reveal, expiry, cancellation, exact token balance deltas and reentrancy boundary.
- `src/ReviewedFindingVerifier.sol`: immutable reviewer quorum, binding to evidence/context, access control.
- `src/BeforeVault.sol`, `src/BeforeFactory.sol`, `src/TrainingVault.sol`, `src/TrainingArena.sol`: policy vault, factory network restriction and deliberate practice vulnerability.
- `web/pay-core.mjs`, `web/pay.js`, `web/app/pay/index.html`, `web/pay.css`: recipient signing, exact ERC-20 calldata, receipt/event verification, wallet lifecycle, accessibility/UX.
- `web/bounty.js`, `web/bounty-core.mjs`, `web/app/bounty/index.html`: BTEST publishing, researcher, reviewer, reveal and recovery UI.
- `web/wif.js`, `web/wif-core.mjs`, `web/app/wif/index.html`: read-only WIF permission inspection.
- Main landing, Protect/Challenge/Proof frontend, README, deployment/security notes, GitHub Actions workflow, Vercel response headers config and Playwright/Foundry/Node tests.

### Confirmed from tools / prior evidence

- GitHub Actions for combined release [42384762055](https://github.com/Iniwura/before-protocol/actions/runs/42384762055): `test` and `browser-quality` passed.
- Vercel production reported READY and the live production alias mapped to the reviewed `main` release; the documentation-only subsequent merge also reported READY.
- Public read-only acceptance evidence in [ISSUE_8_PUBLIC_TESTNET_EVIDENCE.md](ISSUE_8_PUBLIC_TESTNET_EVIDENCE.md) reports actual Challenge #7 transaction creation/commit/approval/settlement, verified receipts/events and BTEST accounting.
- The Playwright/axe/Foundry/Node results are **CI evidence**. This audit did **not** run a separate full interactive browser session against live production: the environment cannot directly open the Vercel site or clone over the network. Do not call this a fresh independent penetration test or complete manual WCAG audit.
- The public organizer landing page confirms a utility-for-$WIF challenge and a 10,000 USDG winner prize. An organizer social post reports **12 November 2026 17:30 UTC** as closing time. The dynamically rendered full rules and authenticated form were not retrievable here, so all detailed rules/field constraints need direct signed-in portal verification. Reference https://worldisflat.fun/build and https://worldisflat.fun/build/rules.

## 3. Threat-model review

| Surface | What the source does well | Boundary / remaining concern |
| --- | --- | --- |
| Owner-controlled policy vault | Immutable token, owner, allowed recipient and per-transfer / fixed UTC-day limits; reentrancy guard and exact recipient/vault balance deltas. | Only funds **inside** that vault are protected. The factory disallows mainnet and exact mock token is required. No live WIF safety vault or real-funds audit exists. |
| Challenge escrow | Each challenge binds target, scoped hash, verifier and code hashes. Solver commitment hashes bind chain, escrow, challenge, solver, salt and evidence. Release verifies window/status and exact ERC-20 accounting. | Verifier decides whether evidence is valid. Reviewer-controlled approvals are not automatic vulnerability detection; unaudited escrow should not hold valuable rewards. |
| Reviewer gate | Only appointed reviewers approve exactly bound finding contexts; duplicate approval fails. | One owner operated all three accounts in the public BTEST acceptance run. Do not imply independent human validation. |
| Pay intent | Typed EIP-712 recipient signature binds official token, chain ID 4663, amount, expiration and nonce; fail-closed validation; EOA-only. | EIP-712 is **not** standalone replay protection. No onchain nonce consumption or invoice settlement exists; the same request can be paid again by another device or wallet. |
| Pay transfer | Requires explicit user wallet confirmation; exact WIF `transfer(recipient,amount)`, zero native value, noncustodial. Checks account/chain, balance, gas and metadata before sending; locks pending/uncertain payments. | Live wallet signing + one real mainnet WIF receipt are **unverified**. Wallet accounts/chain and injected provider may still be adversarial and gas prices change. |
| Pay proof | Verifies sender, token, exact calldata, receipt status, transaction/block linkage, three confirmations and matching official WIF Transfer log; reload verification is read-only. | A matching ERC-20 transfer does not prove one-time fulfillment of a particular invoice. Public RPC outages/reorgs affect claims. |
| Permission checker | Pinned WIF contract and Robinhood chain, matched owner/spender and immutable result snapshot; user signs nothing. | Cannot enumerate all spenders or revoke allowances in production. PR #7 revoke remains unmerged, by design. |
| Site transport | Vercel configuration declares nosniff, frame denial, referrer and Permissions-Policy headers. | No Content-Security-Policy found in `web/vercel.json`; consider a tested policy as future hardening after the demo, especially with injected wallet support. |

Cross-check approach: [OWASP Smart Contract Top 10](https://owasp.org/projects/smart-contract-top-10), [EIP-712](https://eips.ethereum.org/EIPS/eip-712), [EIP-1193](https://eips.ethereum.org/EIPS/eip-1193).

## 4. Findings by severity

Severity refers to release impact, not guaranteed exploitability.

### HIGH — competition / critical experience gates

**H-01 — No real WIF payment proof (OPEN).** The official token is read-only verified and the BEFORE Pay code can request standard WIF transfers, but there is no authentic mainnet transfer originated through the current product. This weakens judging and prevents a credible full real-WIF demo. Do not use BTEST testnet receipts as substitutes. A human-controlled real-WIF end-to-end acceptance would require a separate wallet with small legitimate funds/gas, explicit review of the request and actual explorer proof.

**H-02 — Home obscured the real WIF feature (FIX IN PR #15).** Production header and final CTA originally sent judges straight to BTEST bounties; the hero was styled as a testnet-only experiment despite the live WIF Pay flow. PR #15 changes only copy/navigation: WIF Pay is the primary action; the separate testnet security lab remains visible.

**H-03 — First-time payer had no input path (FIX IN PR #15).** Request creation could be initiated but paying required a link opened externally. PR #15 adds a compact same-origin “Have a payment link?” form, validates link structure and forbids arbitrary destinations. Negative cases and no-broadcast behavior are covered in Playwright.

**H-04 — Full payment recipient hidden by mobile tooltip (FIX IN PR #15).** Previously, the irreversibly paid-to address was abbreviated onscreen and the full value lived in a hover-only title. PR #15 shows the entire address with wrapping and adds a 390px no-overflow regression. Never ask users to trust a truncated destination.

**H-05 — Required video / final organizer submission not completed (OPEN).** The submission text and 110–130 second storyboard exist. A real screen recording must make mocked WIF clearly distinct from public BTEST transactions. The signed-in portal must verify exact timing, category, fields and video constraints. No confirmed final submission receipt exists.

### MEDIUM — security assurance / reliability / UX

**M-01 — Real recipient signature path lacks independent live-wallet acceptance (OPEN).** Unit and browser tests validate EIP-712 hashing, decoding and recovery using a mocked EIP-1193 provider and precompile RPC results. They are valuable but do not prove an actual Robinhood wallet produces a recoverable signed request against its live RPC. Run a no-spend recipient-signing acceptance with a real EOA when available, and add a differential digest test against a widely reviewed library. Never print or commit keys.

**M-02 — Exact estimated gas was passed as transaction gas cap (FIX IN PR #15).** `eth_estimateGas` represents state-dependent estimation, not a robust hard gas cap. The candidate still estimates and displays expected gas, but omits the fixed `gas` field so the wallet calculates its own final limit. Browser test asserts this. Wallet UI remains authoritative.

**M-03 — BTEST browser-send ambiguity (OPEN, testnet-only).** `web/bounty.js::sendTransaction` correctly verifies mined receipt identity, but if the provider accepted a transaction and its hash is lost, or receipt polling exceeds the limit, the app can return the role to an action-ready state without durable recovery. Improve pending-hash persistence and read-only retry before opening any real-asset bounty, though the current app is strictly BTEST-only. Public completed Challenge #7 is unaffected.

**M-04 — Wallet onboarding and multi-wallet support are uneven (OPEN).** Bounty Studio offers user-approved testnet network switching; BEFORE Pay currently fails closed with a message requiring manual Robinhood mainnet configuration. It does not support EIP-6963 wallet discovery or ERC-1271 contract-wallet recipients. These limits are security-conservative but create friction for unfamiliar users.

**M-05 — Source-based UI audit cannot replace real moderated usability tests (OPEN).** Automated axe and viewport checks at 320/375/390/768/1280 are positive, but some labels use 9–12px all-caps and the role workflow still demands crypto knowledge. A 5-minute test with a user unfamiliar with WIF, plus a real mobile wallet, is needed to support a 9/10+ usability claim. Refer to [Nielsen Norman usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) and [WCAG 2.2](https://www.w3.org/TR/WCAG22/).

### LOW — technical debt / clarity

**L-01 — Documentation drift (PARTLY FIXED).** Bounty Studio documentation still said it was an unmerged PR and README claimed homepage launched Bounty. PR #15 fixes the current user-facing instructions; older historical phase documents may remain archival, not the current submission source.

**L-02 — No CSP specified (OPEN).** `web/vercel.json` includes basic security headers but no Content-Security-Policy. Add and test a compatible policy in a separate hardening change, not blindly before recording a demo; wallet extension injection and public RPC connections should be tested.

**L-03 — Self-implemented Keccak-256 (REVIEWED, IMPROVABLE).** `web/pay-core.mjs` contains custom Keccak for typed request hashing; test vectors pass. A differential long-input/property test against a well-reviewed EVM library would increase assurance. Do not silently replace the crypto implementation immediately before judging.

**L-04 — Product story spans three different audiences (PARTLY FIXED).** WIF Pay, the allowance reader, and BTEST research bounty are independent journeys, not a single self-enforcing WIF protection protocol. The clear pitch is **verify intent → explicitly send → verify receipt**, with the testnet lab providing evidence of onchain policy education. Do not imply the BTEST vault automatically protects a mainnet WIF wallet.

## 5. Engineering checks — evidence status

| Check | Result | Boundary |
| --- | --- | --- |
| Solidity vault/escrow/factory guards | PASS in prior CI; manual source review | Not independent formal verification, fuzzing alone not a proof. |
| EIP-712 mutation / amount / calldata / signatures | PASS in prior CI | Some signature calls are mocked; needs one real-wallet no-spend acceptance. |
| Pay fail-closed wallet states and duplicate broadcast | PASS in prior browser CI | Local URL lock, not global onchain invoice nonce enforcement. |
| Public BTEST Challenge #7 full settlement | PASS, public testnet receipts and independent read-only audit | Three authorized addresses, one operator; BTEST only. |
| Responsive/axe browser regressions | PASS in prior CI at multiple widths | Does not substitute for keyboard, VoiceOver/TalkBack and real mobile wallet tests. |
| Approved editorial visual language | Preserved by PR #15 | Copy/navigation/one compact Pay form only; no visual redesign. |
| Exact-head PR #15 CI and Vercel preview | **Verify on final branch head before merge** | Do not claim an earlier green run covers later changes. |
| Live production smoke / mainnet WIF transaction | **Not independently executed in this audit** | Vercel production metadata confirms deployment state but isn't a browser-to-wallet acceptance. |
| Organizer authenticated rules and final submission | **NOT verified/submitted** | Public organizer claims utility for WIF; logged-in form remains needed. |

## 6. Product fit versus original BEFORE proposal

The original design promised three experiences: Protect (enforced rules in a dedicated vault), Challenge (intentional practice vulnerability) and Proof (independently verifiable results). This still exists as a **BTEST testnet educational demo** and is backed by tested Solidity contracts and public receipts.

The new hackathon-facing product is BEFORE Pay, a **noncustodial mainnet WIF transfer safety interface**. This is practical and repeatable, but it is *not* the same as smart-contract-enforced per-day spending controls on real WIF. We should never pitch it as if it enforces these vault rules on ordinary wallet transfers. The cohesive framing is: **BEFORE is a verification-first toolkit; Pay is the utility, the lab is supporting proof.**

The real challenge is not whether the project can encode a transfer, but whether judges see a defensible difference from a normal wallet transfer: signed recipient intent, fail-closed preflight, locked uncertain payments and a portable independently checked receipt. A working live payment demonstration is essential for competitive credibility.

## 7. Competitive and organizer research

- Organizer public home says **build a utility for WIF** with a **10,000 USDG** prize: https://worldisflat.fun/ and https://worldisflat.fun/build.
- Organizer social update mirrored at https://teapawt.org/WIFonRH reports a November 12, 2026, 17:30 UTC submission close. Use that **earlier cutoff** unless the authenticated portal confirms otherwise.
- Other projects already publish real mainnet activity, including [WIF Agent Arena](https://worldisflat.fun/build/projects/wif-agent-arena) and [Sherwood](https://worldisflat.fun/build/projects/sherwood). Another payment-link entry [FLAT//RELAY](https://worldisflat.fun/build/projects/flat-relay) competes more directly on consumer/payments convenience. These are public competitor self-reports, not independently audited rankings.
- Full dynamic organizer rules did not render in our external research surface. Do **not** claim a specific scoring rubric, minimum real-WIF transaction count, wallet requirement or hard video length until validated in the signed-in submission UI.

## 8. Scores (engineering review, not official judge scores)

| Dimension | Rating / 10 | Why |
| --- | ---: | --- |
| Solidity / policy and BTEST correctness | **8.5** | Well-scoped contracts, reentrancy and accounting guards, robust test coverage; testnet not audited for real funds. |
| WIF Pay transaction and proof logic | **8.3** | Pinned token/chain, EIP-712, exact transfer/log checks, pending/reload locks; no independent live WIF payment. |
| Automated tests / reproducibility | **8.7** | Good breadth in Foundry, Node, Anvil, Playwright/axe, public testnet evidence; some wallet paths mocked. |
| Architecture / maintainability | **8.1** | Small dependency-free static product and pure modules; multiple independent products and custom crypto. |
| Visual design | **8.5** | Strong approved typography and consistent system; this audit preserves it. |
| First-time usability (candidate after PR #15) | **7.5** | Pay-first landing, direct link paste and visible full recipient fix major gaps; wallet onboarding and tiny secondary type remain. |
| Product focus / distinctiveness | **6.8** | Useful verification UX but original Protect/Challenge/Proof vision and mainnet Pay are not one product. |
| Hackathon demonstration / evidence readiness | **5.5** | Authentic BTEST, real WIF token reads; no live WIF transfer, video, or organizer submission. |
| **Overall build, if PR #15 tests pass** | **7.7 / 10** | Strong hackathon engineering with a compelling safety angle, but not yet a proven winner-level end-to-end product. |

**As deployed before PR #15:** approximately **7.2/10** because the landing buried the main WIF capability and first-time payer entry was weak. The candidate improves UX; do not count its score as shipped until merge, CI and production alias checks pass.

## 9. Minimum ordered release plan — no feature creep

1. **Finish PR #15:** exact-head CI and browser UX tests, merge, check Vercel production alias and routes. No redesign.
2. **Real-wallet no-spend proof:** validate recipient EIP-712 signed request using a compatible real mainnet wallet (signature only, no gas/spend) and verify through a second fresh browser. No seed phrases in logs.
3. **Live WIF acceptance if safely available:** only a small owner-intended WIF payment signed directly by the owner with gas and recipient verified; capture actual Blockscout receipt, matching WIF Transfer log and public link. If no authorized funded wallet, state the gap rather than fabricate.
4. **Record one concise demo:** main WIF product first, BTEST public proof second, with unmissable simulated/real labels.
5. **Confirm portal rules, upload, and submit:** preserve organizer confirmation. Do not assume account registration equals project submission.

### Final gate

**GO** for further preview and controlled release work once CI passes. **NO-GO** for claims of a completed real-WIF payment, independent security audit, guaranteed prize eligibility, or final submitted entry until each has actual evidence.


---

## 10. Rule-by-rule correction after reading the full official organizer rules

**Source:** Organizer rules pasted by the project owner on November 7, 2026; official event https://worldisflat.fun/build. These are stronger and more explicit than the abbreviated public-search description relied upon in the earlier review. This section takes precedence over earlier speculative eligibility language.

**Hard deadline:** submissions close November 12, 2026 at **17:30 UTC**. Submitted project content locks then except logo. Round one November 12–14, final November 14–16, 17:30 UTC. Product must remain accessible through the final. Award: one winner, 10,000 USDG; community vote counts as one seat among judges, with the ten leading projects becoming finalists. This mechanism affects outreach but is not a reason for spam, inducements or claims of guaranteed voting advantage.

| Rule | Official requirement | BEFORE as of this checkpoint | Verdict |
| --- | --- | --- | --- |
| 1,2,10 | Teams up to four, age ≥18, no requirement to buy/hold WIF | Team and age to be entered accurately; no token ownership is required merely to enter | **Owner declaration needed** |
| 3 | The **project must use $WIF onchain on Robinhood Chain** | Mainnet contract and token checks pass read-only; Pay can construct a transfer, but no actual app-originated WIF mainnet payment has been verified | **FAIL / unproven** |
| 4 | App remains live/working until final closes November 16 | Vercel deployment READY and production alias confirmed; future uptime requires monitoring | **CURRENTLY LIVE; future obligation open** |
| 5 | Public repo + demo video + **real transactions** | Public repository; genuine BTEST testnet transactions only; no real WIF app-originated tx; video not completed | **PARTIAL / currently NO-GO** |
| 6 | Existing work allowed if WIF has a real use | BEFORE Pay is implemented and verified in automated tests, but not yet live-transaction-proven | **PARTIAL** |
| 7 | **Flywheel** returning people to WIF | Request → Check → Pay → Proof is a strong one-time payment verification workflow, **not automatically a retention loop** | **FAIL / missing demonstrated flywheel** |
| 8,11–16 | Team/judge eligibility, no unauthorized brands or malware, possible winner eligibility/payout verification | BEFORE brand is distinct; official Robinhood Chain naming is used descriptively. Team/payout checks depend on the actual entrant; never claim completed | **Owner attestation / remaining checks** |
| Categories | Choose every applicable category | Consumer & Payments; Tools & Infra; optionally Onboarding after demonstrated novice UX | **Category recommendation** |
| Judge criteria | A real reason to use WIF, flywheel, working product and build quality | Build quality strong. Live WIF usage and repeated behavioral reason not demonstrated | **Competition NO-GO** |

### Corrected scores and executive conclusion

The engineering build still rates **7.7/10** after approved Pay-first UX fixes and confirmed CI/deployment. **Contest readiness is only 4/10** until genuine WIF usage, a repeat-use loop, demo and submission are established. The lower contest score is **not** a claim of a new security regression: it reflects that two named rules are unmet or unproven.

**Priority:** New narrow work order [Issue #16](https://github.com/Iniwura/before-protocol/issues/16) investigates **BEFORE Support**: repeat voluntary WIF contributions on a recipient-authenticated support page, user-confirmed each time, with reverified contribution receipts and honest device-local history limits. This is a proposed implementation, **not shipped functionality**, and no onchain single-use guarantee or automatic subscriptions are claimed. Production work should not be described as meeting the flywheel rule before users can actually repeat WIF activity.

**No requirement to purchase WIF just to enter:** rule 2 expressly says entrants need not buy or hold WIF; that does not remove rule 3 requiring the product to use WIF onchain. If a human-owned funded wallet is unavailable for a controlled test, record the limit rather than fabricate a mainnet transaction.
