# Issue #18 — real Robinhood Chain mainnet Support evidence

Verified November 8, 2026. This is public transaction evidence, not a demo claim or an external security audit.

## Scope and custody

- Network: Robinhood Chain mainnet, chain ID `4663`.
- Official WIF: `0x5173b8eA6923c2d40267890D45C46a3480954773`.
- Payer: `0x11cbedbf9fcd723ce48fbd5a2b55e6e3699c3368`.
- Creator: `0x02fb3352e593f4bcbff5a845e7a0f90ca4a87f0d`.
- Contribution amount: exactly `200 WIF` per cycle, `400 WIF` total.
- Both identities were fresh encrypted local keystores. No key, password or keystore material was published or sent to GitHub, Vercel or the browser page.
- The creator wallet remained unfunded; the payer was funded only for this bounded acceptance exercise.

The production `/app/support/` page was exercised in a controlled headless browser with a transparent local EIP-1193 signer harness. The harness kept the encrypted-keystore private material in the local Node process, signed the creator's EIP-712 `SupportOffer`, and enforced the exact chain, token, recipient, amount, zero native value, current nonce and gas-budget checks before each broadcast. This was automated wallet acceptance, not a claim that a human clicked a wallet extension.

## Public receipts

| Cycle | Transaction | Block | Nonce | Status | Confirmations at verification | Matching WIF Transfer log |
| --- | --- | ---: | ---: | --- | ---: | ---: |
| First | [0x4f6b1b2d48f73643408418896a7de886be4a522bf583a1c3d1d9c104c3b42476](https://robinhoodchain.blockscout.com/tx/0x4f6b1b2d48f73643408418896a7de886be4a522bf583a1c3d1d9c104c3b42476) | 108866674 | 0 | `0x1` | 3904 | 1 |
| Second | [0x7e5ca115c13fed7e36109478c9f454adc81c58c2c114f569624d95792f64033a](https://robinhoodchain.blockscout.com/tx/0x7e5ca115c13fed7e36109478c9f454adc81c58c2c114f569624d95792f64033a) | 108870117 | 1 | `0x1` | 461 | 1 |

For both receipts, an independent read-only RPC verifier checked:

- sender exactly equals the payer;
- destination exactly equals the official WIF contract;
- native value is zero;
- calldata is exactly `transfer(creator, 200 WIF)`;
- receipt status is successful;
- the log address, `Transfer` topic, indexed sender, indexed creator and amount all match;
- at least three confirmations were present; and
- the two transactions use distinct sequential payer nonces.

The first browser run timed out while waiting for its visible proof state after the wallet returned. It was not retried. Read-only recovery found the mined hash above, and the independent receipt check passed before the remaining authorized cycle was attempted. The second cycle used a fresh signed Support offer because the interrupted browser context was discarded rather than resumed. This proves two intentional production Support transfers and repeat capability; it does not prove organic retention or a same-page return by an independent user.

## Accounting

The payer started with `705.238282568971733181 WIF` and finished with `305.238282568971733181 WIF`. The creator finished with exactly `400 WIF`. The creator received no ETH. The payer's final native balance was `0.000222094365345534 ETH`; no third transaction was broadcast and the payer's latest and pending nonces are both `2`.

No approval, allowance, swap, bridge, contract deployment, third-party transfer, mainnet WIF purchase or production promotion was performed. BTEST testnet evidence remains separate from this mainnet WIF evidence.
