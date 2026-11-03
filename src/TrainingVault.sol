// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MockERC20} from "./mocks/MockERC20.sol";

/// @notice INTENTIONALLY VULNERABLE. DO NOT DEPLOY WITH REAL ASSETS.
/// @dev Demonstrates why per-transfer limits cannot replace cumulative limits.
contract TrainingVault {
    error TrainingNetworkOnly();
    error NotArena();
    error TooLarge();
    error TransferFailed();
    error NotMockToken();

    address public immutable arena;
    address public immutable token;
    uint256 public immutable maxPerTransfer;

    constructor(address token_, uint256 maxPerTransfer_) {
        if (block.chainid != 31337 && block.chainid != 46630) revert TrainingNetworkOnly();
        require(token_ != address(0) && maxPerTransfer_ > 0, "bad config");
        if (token_.codehash != keccak256(type(MockERC20).runtimeCode)) revert NotMockToken();
        arena = msg.sender;
        token = token_;
        maxPerTransfer = maxPerTransfer_;
    }

    function release(address to, uint256 amount) external {
        if (msg.sender != arena) revert NotArena();
        if (amount == 0 || amount > maxPerTransfer) revert TooLarge();
        (bool success, bytes memory result) = token.call(
            abi.encodeWithSignature("transfer(address,uint256)", to, amount)
        );
        if (!success || (result.length != 0 && (result.length != 32 || !abi.decode(result, (bool))))) {
            revert TransferFailed();
        }
    }
}
