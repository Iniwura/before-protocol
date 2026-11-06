# BEFORE — WIF Permission Check

**Mainnet read-only tool:** `/app/wif/`  
**Token:** World Is Flat (WIF)  
**Official contract:** `0x5173b8eA6923c2d40267890D45C46a3480954773`  
**Network:** Robinhood Chain mainnet (chain ID **4663**)  
**Read RPC:** `https://rpc.mainnet.chain.robinhood.com`

The address comes from the official World Is Flat project website. It is explicitly separate from Robinhood Chain **testnet** (46630), where BEFORE's freely mintable BTEST bounty and vault contracts execute.

## Purpose and scope

WIF Permission Check is a narrow, useful **read-only ERC-20 allowance inspector**. A WIF holder can verify the amount a particular spender is currently allowed to transfer. It does **not** connect a wallet, sign anything, broadcast a transaction, approve or revoke an allowance, move tokens, or control an escrow.

This is not an automatic scan of all existing approvals or a vulnerability/legitimacy verdict. Anyone can inspect a public wallet's state.

## How to use

Option A: Paste a past successful **WIF `approve(spender, amount)` transaction hash** from Robinhood mainnet. The app verifies it targeted the official WIF token, succeeded onchain and used the standard `approve` function. It extracts the transaction's owner and spender, displays the original approved amount, then checks the **current** allowance.

Option B: Open **Or enter wallet and spender manually**, then paste both public addresses. The app checks the current allowance for that exact owner/spender pair. If the spender is unknown, find it in a past approval transaction or your dApp's documented contract address.

For either path, the app reads one pinned mainnet block and verifies:
- Network `eth_chainId == 4663`
- Official WIF token has contract code and reports `symbol=WIF`, `decimals=18`
- `balanceOf(owner)` and `allowance(owner, spender)` from the real WIF contract
- Whether the spender had code at the checked block (contract vs no contract code)
- No `eth_sendTransaction`, `personal_sign`, approvals or other state-changing RPC methods

## Understanding the outcome

- **No permission for this spender:** the allowance is exactly zero for this **specific** spender. Other spenders might still hold approvals.
- **Active WIF permission:** a positive allowance exists.
- **Approval exceeds current balance:** the spender may be able to use the allowance against future WIF receipts.
- **Very large approval:** the amount is close to the ERC-20 maximum and deserves careful review.

These are **descriptions of onchain state, not security scores or accusations**. The scanner does not label a spender trustworthy or malicious. It never pretends to revoke an approval.

The mainnet owner/spender data may change after the inspected block. Small nonzero allowances are never displayed as zero due to rounding.

## Independently verified mainnet browser example

On 6 November 2026, a direct Chromium browser test without RPC mocks used:
- WIF holder: `0x156064f872Eb6DedC953E7AF21E7a7991910Ef09`
- Spender: `0xb08148e6c8605b0B4A945bac29Bb7E4A9E06AC31`
- Robinhood Chain mainnet RPC returned real WIF balance and `allowance=0` for that pair
- Both 375px mobile and 1280px desktop displayed a result with no browser errors

This does **not** establish the wallet's total approvals or guarantee that its funds are safe. It was only a public chain read at the time.

## Verification

```sh
node --test web/test/wif-core.test.mjs
node qa/wif-verify.mjs
```

Unit tests validate official token identity, ABI encoding, successful and rejected WIF approval transaction parsing, decimal precision, no-zero-rounding and permission descriptions. Browser tests cover four viewport sizes (320, 375, 768, 1280), WCAG accessibility, historical and current allowance display, fail-closed wrong-chain checks, rejected wrong-token approvals, zero wallet-signing calls and no horizontal overflow.

**Do not claim:** mainnet asset custody, token protection, formal audit, general wallet risk scoring, automatic discovery of every approval, revocation, or a funded WIF security bounty. The BTEST testnet lifecycle remains a distinct technical demonstration.
