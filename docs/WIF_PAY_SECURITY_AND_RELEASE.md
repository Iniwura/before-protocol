# BEFORE Pay — security and release gate

BEFORE Pay is a noncustodial request → check → pay → proof flow for the official World Is Flat token on Robinhood Chain mainnet.

- Network: Robinhood Chain mainnet, chain ID `4663`.
- Token: `0x5173b8eA6923c2d40267890D45C46a3480954773`.
- Public RPC: `https://rpc.mainnet.chain.robinhood.com`.
- Explorer: [Robinhood Chain Blockscout](https://robinhoodchain.blockscout.com/).
- Decimals: `18`; the live read-only metadata check reports symbol `WIF` and runtime code.

This feature has no server, database, private-key access, custody, allowance request, contract deployment, fee, router, staking, burn, bet or automatic broadcast. CI and demo mode do not sign or broadcast a real WIF transaction.

## User flow

1. A recipient voluntarily connects an EIP-1193 wallet on chain `4663` and signs an EIP-712 `PaymentRequest`.
2. The typed request binds `recipient`, the official WIF contract, `chainId`, exact integer `amount`, `expiresAt` and a fresh 32-byte `nonce`. The domain binds `BEFORE Pay`, version `1`, chain `4663` and the WIF contract.
3. The share link carries only the request and 65-byte signature in URL-safe encoded JSON. It contains no key, seed or token permission.
4. A payer opens the link and explicitly connects a wallet. BEFORE independently reads public RPC state, validates the official WIF runtime code and metadata, verifies the recipient is an EOA, recovers the signer with the chain `ecrecover` precompile, checks WIF balance and estimates native gas.
5. Only the explicit **Pay exact WIF amount in my wallet** action calls `eth_sendTransaction`. The requested transaction is exactly `to=WIF_TOKEN`, `value=0x0`, and `data=0xa9059cbb` followed by the recipient and amount ABI words. BEFORE cannot access the payer's keys.
6. A receipt becomes proof only after public RPC revalidation of transaction/receipt identity, sender, destination, zero native value, exact calldata, successful status, three confirmations and exactly one matching official WIF `Transfer` event.

## Threat model and fail-closed policy

| Threat | Control | Residual limit |
| --- | --- | --- |
| Edited recipient, amount, chain, token, expiry or nonce | Canonical request normalization, EIP-712 digest binding and signature recovery | A recipient can intentionally sign a harmful request; the payer must still inspect it |
| Fake symbol, URL label, screenshot or token | Independent `eth_getCode`, `symbol()`, `decimals()` and chain-ID reads against the pinned official contract | RPC availability and honest public-chain state are required |
| Recipient smart contract with ambiguous signature semantics | Recipient code must be empty; EIP-1271 is explicitly unsupported | Smart-contract recipients cannot use this flow |
| Signature malleability or malformed signature | Exact 65-byte signature, `v` 27/28 normalization and low-`s` enforcement; recovery delegated to EVM precompile | Wallet/provider must implement `eth_signTypedData_v4` correctly |
| Stale wallet account or network | Account and chain are rechecked immediately before the wallet request; provider changes invalidate the check | User-controlled wallets can change state after the final check |
| Wrong transaction supplied by wallet/provider | Exact transaction fields are checked after mining | Wallet confirmation UI remains the user's responsibility |
| False local success or tampered proof URL | Proof reload reads transaction, receipt and logs from public RPC; no localStorage success state | A public RPC can be unavailable or reorg before confirmation depth |
| Duplicate or replayed signed request | Fresh nonce and expiry reduce accidental reuse; the UI warns that generic ERC-20 transfers have no unique invoice binding | The same valid request can be paid more than once; no unique settlement is claimed |
| Native-gas surprise | Estimated gas and current native balance are shown before Pay | Gas price can change after the estimate; the wallet confirmation remains authoritative |
| Secrets in the application | No private-key APIs, keystore files, server signer or approval flow exist in the product | Users must keep their own wallet and signing device secure |

If any verification is unavailable or ambiguous, the Pay button remains disabled. A rejected, cancelled, reverted, mismatched or unmined transaction is never presented as a successful payment.

## Exact data boundary

The only real-WIF product transaction supported by the UI is:

```text
eth_sendTransaction({
  from: connected payer,
  to: 0x5173b8eA6923c2d40267890D45C46a3480954773,
  value: 0x0,
  data: 0xa9059cbb + recipient word + amount word
})
```

No `approve`, `permit`, `transferFrom`, helper contract or native-value transfer is requested. A real mainnet payment costs real native gas and is irreversible. This repository's automated tests use a deterministic mock EIP-1193 wallet and mock RPC only; they do not fabricate a mainnet receipt or send WIF.

## Test evidence

The isolated tests cover:

- EVM Keccak vectors and official `Transfer` topic.
- Exact 18-decimal integer parsing, zero, fractional, overflow and malformed inputs.
- EIP-712 field mutation for recipient, token, chain, amount, expiry and nonce.
- Malformed, wrong-recovery and high-`s` signatures.
- EOA-only recipient policy and explicit EIP-1271 rejection.
- Short, extra, mutated-recipient and mutated-amount calldata.
- Transaction sender/destination/value/status identity and exact `Transfer` log accounting.
- Missing wallet, wrong network, signature rejection, repeated-click protection, no-broadcast request creation, exact mocked transfer fields and read-only proof reload.

Run locally:

```sh
node --test web/test/pay-core.test.mjs
node qa/pay-e2e.mjs
```

The broader Foundry, Node, Anvil, WIF and browser suites remain required in CI. Existing mock-only BTEST testnet evidence is separate and must not be described as WIF mainnet evidence.

## Owner-controlled real-WIF acceptance gate

This gate is intentionally separate from code readiness. It is **not authorized by this repository task** and must be approved by the owner after inspecting the exact preview and wallet confirmation:

- Do not broadcast a real WIF/mainnet transaction from Codex, CI or demo mode.
- Do not fund real WIF, deploy a mainnet contract, merge automatically, promote Vercel production or submit to organizers without separate approval.
- Before any human acceptance, recheck official rules, token metadata, explorer behavior, wallet chain/account, gas estimate and request contents.
- If the owner later authorizes one human-controlled payment, record the exact public hash, receipt, calldata, Transfer log, confirmation count and explorer link. Do not imply that one generic transfer settles a unique invoice.
- Final hackathon submission and demo-video production remain separate owner decisions.

Current release decision for this task: implementation/preview readiness can be GO after all automated and preview checks pass; real-WIF broadcast, production promotion, merge and final submission remain NO-GO without the owner gate.
