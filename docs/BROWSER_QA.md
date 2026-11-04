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
- 4/4 success-path wallet transactions passed with simulated provider responses; two additional failure paths cover user rejection and reverted receipts. None is an onchain broadcast.
- Keyboard tab navigation (ArrowRight, Home, End) preserves the roving tab focus model.
- A manifest marked verified still keeps wallet actions hidden when any deployed runtime code is missing.
- All four widths showed no horizontal scrolling.
- The current branch preserves the approved minimal Protect / Challenge / Proof layout while adding the fail-closed deployment gate and explicit testnet disclosures.
- GitHub Actions run [51](https://github.com/Iniwura/before-protocol/actions/runs/41909010933) independently passed both browser-quality and contract checks.

**Limitations:** Automated accessibility checks cannot replace manual screen-reader testing, keyboard focus inspection, real-wallet checks, or human usability assessment. Browser network and wallet mocks do not prove Robinhood Chain deployment. The live production site remains on its prior commit until the PR is merged and deployed.
