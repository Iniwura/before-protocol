// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BeforeVault} from "./BeforeVault.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

/// @notice Creates provenance-tracked, mock-token BEFORE vaults on local chains and Robinhood testnet.
/// @dev Research prototype only. It intentionally cannot run on mainnet.
contract BeforeFactory {
    error TestNetworkOnly();
    error NotMockToken();
    error NoVault();

    uint256 public constant DEMO_PER_TRANSFER = 60 ether;
    uint256 public constant DEMO_DAILY_LIMIT = 100 ether;
    uint256 public constant DEMO_INITIAL_BALANCE = 150 ether;

    mapping(address => bool) public isVault;
    mapping(address => address[]) private _ownerVaults;

    event VaultCreated(
        address indexed owner,
        address indexed vault,
        address indexed token,
        address recipient,
        uint256 maxPerTransfer,
        uint256 dailyLimit,
        bool fundedDemo
    );

    constructor() {
        if (block.chainid != 31337 && block.chainid != 46630) revert TestNetworkOnly();
    }

    /// @notice Create a custom policy for an exact, freely mintable test-token contract.
    /// @dev No assets are moved. The vault is owned by msg.sender, not the factory.
    function createVault(
        address mockToken,
        address recipient,
        uint256 maxPerTransfer,
        uint256 dailyLimit
    ) external returns (address vault) {
        _requireMock(mockToken);
        vault = _create(msg.sender, mockToken, recipient, maxPerTransfer, dailyLimit, false);
    }

    /// @notice One transaction creates and funds a working vault with valueless mock tokens.
    /// @dev The creator can withdraw only to their own wallet, max 60 per call / 100 per UTC day.
    function createDemoVault(address mockToken) external returns (address vault) {
        _requireMock(mockToken);
        vault = _create(
            msg.sender,
            mockToken,
            msg.sender,
            DEMO_PER_TRANSFER,
            DEMO_DAILY_LIMIT,
            true
        );
        MockERC20 mock = MockERC20(mockToken);
        mock.mint(address(this), DEMO_INITIAL_BALANCE);
        require(mock.approve(vault, DEMO_INITIAL_BALANCE), "mock approve failed");
        BeforeVault(vault).deposit(DEMO_INITIAL_BALANCE);
        // Creation, deposit and registry writes are atomic.
    }

    function vaultsOf(address owner) external view returns (address[] memory) {
        return _ownerVaults[owner];
    }

    function latestVaultOf(address owner) external view returns (address) {
        uint256 count = _ownerVaults[owner].length;
        if (count == 0) revert NoVault();
        return _ownerVaults[owner][count - 1];
    }

    function vaultCount(address owner) external view returns (uint256) {
        return _ownerVaults[owner].length;
    }

    function _requireMock(address asset) private view {
        if (asset.codehash != keccak256(type(MockERC20).runtimeCode)) revert NotMockToken();
    }

    function _create(
        address creator,
        address asset,
        address recipient,
        uint256 perTransfer,
        uint256 daily,
        bool fundedDemo
    ) private returns (address vault) {
        BeforeVault deployed = new BeforeVault(creator, asset, recipient, perTransfer, daily);
        vault = address(deployed);
        isVault[vault] = true;
        _ownerVaults[creator].push(vault);
        emit VaultCreated(creator, vault, asset, recipient, perTransfer, daily, fundedDemo);
    }
}
