// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BeforeFactory} from "../src/BeforeFactory.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";

interface VmDeploy {
    function envUint(string calldata name) external returns (uint256);
    function addr(uint256 key) external returns (address);
    function startBroadcast(uint256 key) external;
    function stopBroadcast() external;
}

/// @notice Testnet-only deployment. No valuable tokens can reach demo custody.
contract DeployBefore {
    VmDeploy private constant vm =
        VmDeploy(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external {
        require(block.chainid == 31337 || block.chainid == 46630, "local/testnet only");
        uint256 key = vm.envUint("BEFORE_TEST_DEPLOYER_KEY");
        address owner = vm.addr(key);
        require(owner != address(0), "invalid deployer");

        vm.startBroadcast(key);
        MockERC20 mock = new MockERC20();
        BeforeFactory factory = new BeforeFactory();
        // A real protected vault with 150 valueless BTEST and a fresh 150-BTEST practice arena.
        factory.createDemoVault(address(mock));
        factory.createPractice(address(mock));
        vm.stopBroadcast();
        // Addresses appear in broadcast receipts and VaultCreated / PracticeCreated events.
        // Check explorer-verified source before publishing a deployment manifest.
    }
}
