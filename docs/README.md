# BEFORE documentation

The [root README](../README.md) is the first stop for judges, users and contributors. This index separates **current product evidence** from **older engineering snapshots** so an historical claim is not confused with the latest shipped behavior.

**Live:** [BEFORE](https://before-web-theta.vercel.app/) · **Demo:** [final YouTube walkthrough](https://youtu.be/YC7t2mql-cI) · **Code:** [GitHub](https://github.com/Iniwura/before-protocol)

## Essential submission evidence

| Read | Why it matters |
| --- | --- |
| [Real WIF mainnet Support evidence](ISSUE_18_MAINNET_SUPPORT_EVIDENCE.md) | Two controlled 200-WIF payments through deployed Support, with exact receipts and acceptance limitations |
| [Support security and release](BEFORE_SUPPORT_SECURITY_AND_RELEASE.md) | EIP-712 offer, transfer consent, optional return loop, no automatic payments |
| [Pay security and release](WIF_PAY_SECURITY_AND_RELEASE.md) | One-off signed payment request, verification, threat model, known limitations |
| [WIF permission checker](WIF_PERMISSION_CHECK.md) | Read-only approval inspection with pinned WIF token/network |
| [Testnet Bounty #7 evidence](ISSUE_8_PUBLIC_TESTNET_EVIDENCE.md) | Three distinct but operator-controlled wallets and verified BTEST settlement |
| [Public testnet contract evidence](TESTNET_PROOF.md) | Factory-created vault and training receipts; historical RPC limitations apply |
| [BTEST bounty browser and workflow](BOUNTY_STUDIO.md) | Sponsor/researcher/reviewer flow and test-token boundaries |

## Reproduce and inspect

- [Local Foundry and public-testnet deployment](DEPLOYMENT.md)
- [Verification tooling and proof boundaries](VERIFICATION.md)
- [Browser/accessibility QA](BROWSER_QA.md)
- [Contract security assumptions](SECURITY_NOTES.md)
- [BTEST-only bounty lifecycle demonstration](BOUNTY_TESTNET_DEMO.md)
- [Synthetic bounty evidence](BOUNTY_TESTNET_EVIDENCE.md)
- [WIF challenge/escrow design](WIF_CHALLENGE_DESIGN.md)

## Historical development records

These documents preserve design decisions, test baselines and draft narration. **They are not current submission instructions**; some contain intentionally outdated "no real WIF" or "demo not finished" statements that were accurate when written.

- [Release freeze, November 8](ENGINEERING_RELEASE_FREEZE_2026-11-08.md)
- [Earlier combined release readiness](FINAL_SUBMISSION_READINESS.md)
- [Pre-demo deep audit](FINAL_DEEP_AUDIT_2026-11-07.md)
- [Phase 1](PHASE_1.md), [Phase 2](PHASE_2.md), [Phase 3](PHASE_3.md)
- [Earlier submission brief](HACKATHON_SUBMISSION.md)
- [Earlier submission runbook](SUBMISSION.md)
- [Earlier World Is Flat draft](WORLD_IS_FLAT_SUBMISSION.md)
- [November 8 submission planning packet](WORLD_IS_FLAT_SUBMISSION_PACKET.md)
- [Draft demo video script](DEMO_VIDEO_SCRIPT.md)
- [Demo reboot/storyboarding](DEMO_REBOOT_LIVE_STORY.md)

## Release notes for reviewers

- The **mainnet** proof is real WIF moved through **Support** using controlled wallet acceptance. It is *not* organic traffic, a subscription, or independent customer validation.
- The **testnet** vault, Challenge, Proof and Bounty Studio use **freely mintable BTEST**. Do not infer mainnet vault custody or third-party security certification.
- The app's public WIF history can show transfers that were not initiated through BEFORE, because vanilla ERC-20 transfers contain no BEFORE campaign identifier.
- Some historical chain-state proofs need an archival node. Current receipts and the public-chain factory and contract state are separately inspectable.
- Source, evidence, tests, and browser QA are all useful but **not a substitute for an independent external audit**.

If documentation seems inconsistent, prioritize the current [README](../README.md), [live production app](https://before-web-theta.vercel.app/), latest merged source and the relevant **public transaction receipts**. Historical planning documents are retained for traceability, not as competing product descriptions.
