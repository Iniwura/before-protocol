import {CHAIN_ID, isAddress, isTxHash} from './core.mjs';

export const SELECTORS = Object.freeze({
  createDemoVault: '0x4e6a5acd',
  createPractice: '0x1ce59d6c',
  latestVaultOf: '0xee643f9e',
  latestPracticeOf: '0x7f81587e',
  isVault: '0x652b9b41',
  isPractice: '0x5676bdbb',
  withdraw: '0xf3fef3a3',
  proveSplitBypass: '0x3b1bf525',
  nextChallengeId: '0xfc67aa50',
});

export function encodeAddress(address) {
  if (!isAddress(address) || /^0x0{40}$/i.test(address)) throw new Error('Invalid contract or wallet address.');
  return address.slice(2).toLowerCase().padStart(64, '0');
}
export function encodeUint(value) {
  const n = typeof value === 'bigint' ? value : BigInt(value);
  if (n < 0n || n >= 2n ** 256n) throw new Error('Uint256 out of range.');
  return n.toString(16).padStart(64, '0');
}
export function encodeAddressCall(selector, address) {
  if (!/^0x[0-9a-f]{8}$/.test(selector)) throw new Error('Invalid method selector.');
  return selector + encodeAddress(address);
}
export function encodeDemoCreate(token) {
  return encodeAddressCall(SELECTORS.createDemoVault, token);
}
export function encodePracticeCreate(token) {
  return encodeAddressCall(SELECTORS.createPractice, token);
}
export function encodeDemoWithdraw(destination, amount = 20n * 10n ** 18n) {
  return SELECTORS.withdraw + encodeAddress(destination) + encodeUint(amount);
}
export function encodePracticeProof(amounts = [60n * 10n ** 18n, 50n * 10n ** 18n]) {
  if (!Array.isArray(amounts) || amounts.length < 2 || amounts.length > 8) throw new Error('Expected 2–8 transfers.');
  return SELECTORS.proveSplitBypass + encodeUint(32n) + encodeUint(BigInt(amounts.length)) + amounts.map(encodeUint).join('');
}
export function readAddressResult(hex) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(hex)) throw new Error('Malformed ABI address.');
  const address = '0x' + hex.slice(-40);
  return /^0x0{40}$/i.test(address) ? null : address;
}
export function readBoolResult(hex) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(hex)) throw new Error('Malformed ABI boolean.');
  const value = BigInt(hex);
  if (value !== 0n && value !== 1n) throw new Error('Malformed ABI boolean.');
  return value === 1n;
}
export function readUintResult(hex) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(hex)) throw new Error('Malformed ABI uint256.');
  return BigInt(hex);
}
export function deploymentReady(config) {
  if (!config || config.chainId !== CHAIN_ID || config.verified !== true) return false;
  const address = value => isAddress(value) && !/^0x0{40}$/i.test(value);
  const tx = value => isTxHash(value);
  if (!address(config.factory) || !address(config.mockToken) || !address(config.challengeEscrow)
    || !tx(config.factoryTx) || !tx(config.mockTokenTx) || !tx(config.challengeEscrowTx)) return false;

  const deploymentAddresses = ['deployer', 'demoVault', 'practiceArena', 'practiceVault'];
  const deploymentTxs = ['demoTx', 'practiceTx'];
  const hasDeploymentEvidence = [...deploymentAddresses, ...deploymentTxs].some(key => config[key] != null);
  if (hasDeploymentEvidence && (!deploymentAddresses.every(key => address(config[key]))
    || !deploymentTxs.every(key => tx(config[key])))) return false;

  const flowTxs = ['allowedTx', 'deniedTx', 'practiceProofTx'];
  const hasFlowEvidence = flowTxs.some(key => config[key] != null) || config.practiceSolver != null;
  if (hasFlowEvidence && (!flowTxs.every(key => tx(config[key])) || !address(config.practiceSolver))) return false;
  return true;
}
