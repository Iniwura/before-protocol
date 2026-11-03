// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BeforeVault} from "../src/BeforeVault.sol";
import {TrainingArena} from "../src/TrainingArena.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";

interface VmDeploy {
    function envUint(string calldata name) external returns (uint256);
    function addr(uint256 key) external returns (address);
    function startBroadcast(uint256 key) external;
    function stopBroadcast() external;
}

contract DeployBefore {
    VmDeploy private constant vm = VmDeploy(address(uint160(uint256(keccak256("hevm cheat code")))));

    event BeforeTestDeployment(
        uint256 indexed chainId,
        address indexed owner,
        address mockToken,
        address protectedVault,
        address trainingArena,
        address trainingVault
    );

    function run() external {
        require(block.chainid == 31337 || block.chainid == 46630, "local/testnet only");
        uint256 key = vm.envUint("BEFORE_TEST_DEPLOYER_KEY");
        address owner = vm.addr(key);
        require(owner != address(0), "invalid deployer");

        vm.startBroadcast(key);
        MockERC20 demoToken = new MockERC20();
        BeforeVault protectedVault = new BeforeVault(
            owner, address(demoToken), owner, 60 ether, 100 ether
        );
        TrainingArena trainingArena = new TrainingArena(address(demoToken), 60 ether, 100 ether);

        demoToken.mint(owner, 1_000 ether);
        demoToken.approve(address(protectedVault), 300 ether);
        protectedVault.deposit(300 ether);
        demoToken.approve(address(trainingArena), 150 ether);
        trainingArena.fund(150 ether);
        vm.stopBroadcast();

        emit BeforeTestDeployment(
            block.chainid,
            owner,
            address(demoToken),
            address(protectedVault),
            address(trainingArena),
            address(trainingArena.vault())
        );
    }
}
