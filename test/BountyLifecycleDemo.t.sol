// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BountyLifecycleDemo} from "../src/mocks/BountyLifecycleDemo.sol";
import {WifSecurityChallenge} from "../src/WifSecurityChallenge.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {TrainingVault} from "../src/TrainingVault.sol";

interface VmLifecycle {
    function warp(uint256 newTimestamp) external;
    function prank(address caller) external;
    function expectRevert(bytes4 selector) external;
}

contract BountyLifecycleDemoTest {
    VmLifecycle private constant vm =
        VmLifecycle(address(uint160(uint256(keccak256("hevm cheat code")))));

    WifSecurityChallenge private escrow;
    MockERC20 private token;
    TrainingVault private target;
    BountyLifecycleDemo private demo;

    function setUp() public {
        escrow = new WifSecurityChallenge();
        token = new MockERC20();
        target = new TrainingVault(address(token), 60 ether);
        demo = new BountyLifecycleDemo(address(escrow), address(token), address(target));
    }

    function testDemoExecutesEntireBtestBountyLifecycle() public {
        require(demo.stage() == 0, "initial stage");
        demo.start();
        require(demo.stage() == 1, "start stage");
        require(token.balanceOf(address(escrow)) == 330 ether, "escrow must hold exact mock reward+bonds");
        require(demo.paidId() != demo.invalidId(), "challenge ids must differ");

        WifSecurityChallenge.Challenge memory cancelled = escrow.challenges(demo.canceledId());
        require(cancelled.canceled, "zero-commit challenge not cancelled");
        require(cancelled.rewardReleased, "cancelled reward not refunded");

        vm.warp(uint256(demo.settleAfter()) + 1);
        demo.settle();
        require(demo.stage() == 2, "settled stage");
        require(token.balanceOf(address(escrow)) == 100 ether, "only invalid reward remains");
        require(token.balanceOf(address(demo.solver())) == 150 ether, "solver reward + bond + expired bond");
        require(token.balanceOf(address(demo.sponsor())) == 310 ether, "invalid bond and expired reward recovered");

        WifSecurityChallenge.Challenge memory paid = escrow.challenges(demo.paidId());
        WifSecurityChallenge.Challenge memory expired = escrow.challenges(demo.expiredId());
        require(paid.rewardReleased && expired.rewardReleased, "both paid and expired should close");

        vm.warp(uint256(demo.cleanupAfter()) + 1);
        demo.cleanup();
        require(demo.stage() == 3, "cleanup stage");
        require(token.balanceOf(address(escrow)) == 0, "all mock funds accounted for");
        require(token.balanceOf(address(demo.sponsor())) == 410 ether, "sponsor final balance");
        require(token.balanceOf(address(demo.solver())) == 150 ether, "solver final balance");
    }

    function testLifecyclePreventsPrematureOrRepeatedActions() public {
        vm.prank(address(0xBEEF));
        vm.expectRevert(BountyLifecycleDemo.NotOperator.selector);
        demo.start();

        demo.start();
        vm.expectRevert(BountyLifecycleDemo.WrongStage.selector);
        demo.start();
        vm.expectRevert(BountyLifecycleDemo.TooEarly.selector);
        demo.settle();

        vm.warp(uint256(demo.settleAfter()) + 1);
        demo.settle();
        vm.expectRevert(BountyLifecycleDemo.WrongStage.selector);
        demo.settle();
        vm.expectRevert(BountyLifecycleDemo.TooEarly.selector);
        demo.cleanup();

        vm.warp(uint256(demo.cleanupAfter()) + 1);
        demo.cleanup();
        vm.expectRevert(BountyLifecycleDemo.WrongStage.selector);
        demo.cleanup();
    }

    function testDemoCannotUseUnrelatedTokenContract() public {
        // An arbitrary contract is never accepted as the freely mintable BTEST.
        vm.expectRevert(BountyLifecycleDemo.NotMockToken.selector);
        new BountyLifecycleDemo(address(escrow), address(target), address(target));
    }

    function testDemoCannotUseUnrelatedEscrowContract() public {
        vm.expectRevert(BountyLifecycleDemo.InvalidDeployment.selector);
        new BountyLifecycleDemo(address(target), address(token), address(target));
    }
}
