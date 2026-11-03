// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BeforeVault} from "../src/BeforeVault.sol";
import {TrainingArena} from "../src/TrainingArena.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";

interface VmIntegration {
    function prank(address actor) external;
    function expectRevert(bytes4 selector) external;
}

contract EndToEndTest {
    VmIntegration private constant vm = VmIntegration(address(uint160(uint256(keccak256("hevm cheat code")))));

    function testDemoLifecycle() public {
        address approvedRecipient = address(0xBEEF);
        address unauthorizedRecipient = address(0xBAD);
        MockERC20 token = new MockERC20();
        BeforeVault protected = new BeforeVault(address(this), address(token), approvedRecipient, 60 ether, 100 ether);
        TrainingArena practice = new TrainingArena(address(token), 60 ether, 100 ether);

        token.mint(address(this), 1000 ether);
        token.approve(address(protected), 300 ether);
        protected.deposit(300 ether);
        token.approve(address(practice), 150 ether);
        practice.fund(150 ether);

        vm.expectRevert(BeforeVault.DestinationNotAllowed.selector);
        protected.withdraw(unauthorizedRecipient, 20 ether);
        protected.withdraw(approvedRecipient, 60 ether);
        protected.withdraw(approvedRecipient, 40 ether);
        vm.expectRevert(BeforeVault.DailyLimitExceeded.selector);
        protected.withdraw(approvedRecipient, 1 ether);

        uint256[] memory split = new uint256[](2);
        split[0] = 60 ether;
        split[1] = 50 ether;
        vm.prank(address(0xCAFE));
        practice.proveSplitBypass(split);

        require(token.balanceOf(address(protected)) == 200 ether, "protected vault balance");
        require(token.balanceOf(approvedRecipient) == 100 ether, "recipient balance");
        require(token.balanceOf(address(practice)) == 110 ether, "actual balance delta");
        require(practice.solver() == address(0xCAFE), "proof owner");
        require(practice.solved(), "missing proof");
    }
}
