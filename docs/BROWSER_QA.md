# Phase 3 browser quality gate

The browser quality suite lives at `qa/verify.mjs`. It runs on each pull request and push.

## Scope

- 4 viewport widths: 320, 375, 768, 1280.
- 3 app screens at each width: Protect, Challenge, Proof.
- WCAG 2.0 A / AA and WCAG 2.1 AA checks using axe-core in headless Chromium.
- Horizontal overflow check at every width.
- Local preview validation (approved/denied transfer, mock split-bypass).
- Fail-closed deployment gate: no wallet actions unless a verified manifest is present.
- Mocked wallet and mocked JSON-RPC tests: demo vault creation, withdrawal, arena creation, proof submission; selectors and zero native-ETH value checks.

## Verified locally

- 12/12 accessibility screen-width combinations passed without reported violations.
- 3 additional complete-manifest Proof / Protect / Challenge states passed without reported violations.
- 4/4 success-path wallet transactions passed with simulated provider responses; three additional failure paths cover user rejection, reverted receipts and a mined transaction whose sender/target/calldata does not match the requested call. None is an onchain broadcast.
- Keyboard tab navigation (ArrowRight, Home, End) preserves the roving tab focus model.
- A manifest marked verified still keeps wallet actions hidden when any deployed runtime code is missing.
- A complete verified manifest surfaces the demo vault, practice arena and three public-flow receipt markers in Proof, seeds the vault inspector, and unlocks only the testnet Protect / Challenge cards.
- A complete verified manifest reads the deployed security escrow's `nextChallengeId()` state in Challenge; this is read-only and never enables WIF funding.
- All four widths showed no horizontal scrolling.
- The current branch preserves the approved minimal Protect / Challenge / Proof layout while adding the fail-closed deployment gate and explicit testnet disclosures.
- GitHub Actions run [121](https://github.com/Iniwura/before-protocol/actions/runs/41946920351) independently passed the browser-quality, contract and real local-Anvil release-gate checks for commit `e0bf908`.
- The verified-manifest preview is expected to show the public Protect DemoVault, Challenge Arena and Proof receipt markers from the live chain; the empty escrow remains read-only and no WIF funding path is enabled.

**Limitations:** Automated accessibility checks cannot replace manual screen-reader testing, keyboard focus inspection, real-wallet checks, or human usability assessment. Browser mocks do not replace the independent live-chain verifier. Production remains on its prior commit until separately approved; this release only prepares a preview.
