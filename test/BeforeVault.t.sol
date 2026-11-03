// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BeforeVault} from "../src/BeforeVault.sol";
import {TrainingArena} from "../src/TrainingArena.sol";
import {TrainingVault} from "../src/TrainingVault.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {MockFeeToken} from "../src/mocks/MockFeeToken.sol";
import {MockReentrantToken} from "../src/mocks/MockReentrantToken.sol";

interface Vm {
    function prank(address) external;
    function warp(uint256) external;
    function expectRevert(bytes4) external;
    function assume(bool) external;
}

contract BeforeVaultTest {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address internal constant RECIPIENT = address(0xBEEF);
    address internal constant OUTSIDER = address(0xBAD);
    address internal constant OTHER = address(0xCAFE);

    MockERC20 internal token;
    BeforeVault internal vault;

    function setUp() public {
        token = new MockERC20();
        vault = new BeforeVault(address(this), address(token), RECIPIENT, 60 ether, 100 ether);
        token.mint(address(this), 1_000 ether);
        token.approve(address(vault), type(uint256).max);
        vault.deposit(300 ether);
    }

    function testDepositUsesRealBalanceDelta() public {
        vault.deposit(20 ether);
        _eq(token.balanceOf(address(vault)), 320 ether);
    }

    function testAuthorizedWithdrawalToFixedRecipient() public {
        vault.withdraw(RECIPIENT, 60 ether);
        _eq(token.balanceOf(RECIPIENT), 60 ether);
        _eq(vault.remainingToday(), 40 ether);
    }

    function testOtherCallerCannotWithdraw() public {
        vm.expectRevert(BeforeVault.Unauthorized.selector);
        vm.prank(OUTSIDER);
        vault.withdraw(RECIPIENT, 10 ether);
    }

    function testOwnerCannotSendToOtherRecipient() public {
        vm.expectRevert(BeforeVault.DestinationNotAllowed.selector);
        vault.withdraw(OTHER, 10 ether);
    }

    function testOversizedTransferFails() public {
        vm.expectRevert(BeforeVault.TransferTooLarge.selector);
        vault.withdraw(RECIPIENT, 61 ether);
    }

    function testSplitTransfersCannotExceedDayBudget() public {
        vault.withdraw(RECIPIENT, 60 ether);
        vault.withdraw(RECIPIENT, 40 ether);
        vm.expectRevert(BeforeVault.DailyLimitExceeded.selector);
        vault.withdraw(RECIPIENT, 1);
        _eq(vault.spentInDay(), 100 ether);
        _eq(token.balanceOf(RECIPIENT), 100 ether);
    }

    function testDailyWindowResetsOnNextDay() public {
        vault.withdraw(RECIPIENT, 60 ether);
        vm.warp(block.timestamp + 1 days);
        _eq(vault.remainingToday(), 100 ether);
        vault.withdraw(RECIPIENT, 60 ether);
        _eq(token.balanceOf(RECIPIENT), 120 ether);
        _eq(vault.spentInDay(), 60 ether);
    }

    function testZeroAmountRejected() public {
        vm.expectRevert(BeforeVault.ZeroAmount.selector);
        vault.deposit(0);
        vm.expectRevert(BeforeVault.ZeroAmount.selector);
        vault.withdraw(RECIPIENT, 0);
    }

    function testWithdrawalRevertDoesNotConsumeBudget() public {
        BeforeVault empty = new BeforeVault(address(this), address(token), RECIPIENT, 60 ether, 100 ether);
        vm.expectRevert(BeforeVault.TokenTransferFailed.selector);
        empty.withdraw(RECIPIENT, 20 ether);
        _eq(empty.spentInDay(), 0);
    }

    function testFeeOnTransferDepositRejected() public {
        MockFeeToken fee = new MockFeeToken();
        BeforeVault feeVault = new BeforeVault(address(this), address(fee), RECIPIENT, 60, 100);
        fee.mint(address(this), 100);
        fee.approve(address(feeVault), 100);
        vm.expectRevert(BeforeVault.UnsupportedToken.selector);
        feeVault.deposit(10);
        _eq(fee.balanceOf(address(feeVault)), 0);
    }

    function testBadConstructorLimitsRejected() public {
        vm.expectRevert(BeforeVault.InvalidLimits.selector);
        new BeforeVault(address(this), address(token), RECIPIENT, 101 ether, 100 ether);
    }

    function testFuzzOutsideCallerNeverWithdraws(address actor, uint96 seed) public {
        vm.assume(actor != address(this));
        uint256 amount = (uint256(seed) % (60 ether)) + 1;
        vm.expectRevert(BeforeVault.Unauthorized.selector);
        vm.prank(actor);
        vault.withdraw(RECIPIENT, amount);
    }

    function testFuzzDailyLimitWithTwoWithdrawals(uint96 firstSeed, uint96 secondSeed) public {
        uint256 a = (uint256(firstSeed) % (60 ether)) + 1;
        uint256 b = (uint256(secondSeed) % (60 ether)) + 1;
        vault.withdraw(RECIPIENT, a);
        if (a + b > 100 ether) {
            vm.expectRevert(BeforeVault.DailyLimitExceeded.selector);
            vault.withdraw(RECIPIENT, b);
            _eq(vault.spentInDay(), a);
        } else {
            vault.withdraw(RECIPIENT, b);
            _eq(vault.spentInDay(), a + b);
        }
    }

    function testFeeOnTransferWithdrawalRejectedAndRolledBack() public {
        MockFeeToken fee = new MockFeeToken();
        BeforeVault feeVault = new BeforeVault(address(this), address(fee), RECIPIENT, 60, 100);
        fee.mint(address(feeVault), 200); // direct funding to exercise the withdrawal path
        vm.expectRevert(BeforeVault.UnsupportedToken.selector);
        feeVault.withdraw(RECIPIENT, 10);
        _eq(feeVault.spentInDay(), 0);
        _eq(fee.balanceOf(RECIPIENT), 0);
        _eq(fee.balanceOf(address(feeVault)), 200);
    }

    function testTokenEOARejectedAtDeployment() public {
        vm.expectRevert(BeforeVault.UnsupportedToken.selector);
        new BeforeVault(address(this), address(0xDEAD), RECIPIENT, 60, 100);
    }

    function testReentrantTokenCannotExecuteSecondWithdrawal() public {
        MockReentrantToken attacker = new MockReentrantToken();
        BeforeVault guarded = new BeforeVault(address(this), address(attacker), RECIPIENT, 60, 100);
        attacker.mint(address(guarded), 200);
        attacker.configure(address(guarded), RECIPIENT);
        guarded.withdraw(RECIPIENT, 40);
        require(attacker.attempted(), "reentrancy not exercised");
        require(!attacker.reenterSucceeded(), "reentrant withdrawal succeeded");
        _eq(guarded.spentInDay(), 40);
        _eq(attacker.balanceOf(RECIPIENT), 40);
    }

    function testBoundaryIsFixedUTCEpochNotRollingWindow() public {
        // Day-boundary behavior is a documented policy tradeoff.
        vm.warp(2 days - 1);
        vault.withdraw(RECIPIENT, 60 ether);
        vm.warp(2 days);
        vault.withdraw(RECIPIENT, 60 ether);
        _eq(token.balanceOf(RECIPIENT), 120 ether);
    }

    function testDirectTransferCannotMintSpendingBudget() public {
        token.transfer(address(vault), 55 ether);
        vault.withdraw(RECIPIENT, 60 ether);
        vault.withdraw(RECIPIENT, 40 ether);
        vm.expectRevert(BeforeVault.DailyLimitExceeded.selector);
        vault.withdraw(RECIPIENT, 1);
    }

    function _eq(uint256 actual, uint256 expected) internal pure {
        require(actual == expected, "uint values differ");
    }
}

contract TrainingArenaTest {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    MockERC20 internal token;
    TrainingArena internal arena;

    function setUp() public {
        token = new MockERC20();
        arena = new TrainingArena(address(token), 60 ether, 100 ether);
        token.mint(address(this), 200 ether);
        token.approve(address(arena), 200 ether);
        arena.fund(150 ether);
    }

    function testPublicProofDetectsRealSplitBypass() public {
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 60 ether;
        amounts[1] = 50 ether;
        arena.proveSplitBypass(amounts);
        require(arena.solved(), "should be solved");
        require(arena.solver() == address(this), "wrong solver");
        require(token.balanceOf(address(arena)) == 110 ether, "missing actual transfer");
    }

    function testProofRejectsNoBypass() public {
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 60 ether;
        amounts[1] = 40 ether;
        vm.expectRevert(TrainingArena.NotAnExploit.selector);
        arena.proveSplitBypass(amounts);
        require(token.balanceOf(address(arena.vault())) == 150 ether, "revert not atomic");
    }

    function testProofRejectsOversizedSingleTransfer() public {
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 61 ether;
        amounts[1] = 50 ether;
        vm.expectRevert(TrainingVault.TooLarge.selector);
        arena.proveSplitBypass(amounts);
    }

    function testProofCanOnlyBeClaimedOnce() public {
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 60 ether;
        amounts[1] = 50 ether;
        arena.proveSplitBypass(amounts);
        vm.expectRevert(TrainingArena.AlreadySolved.selector);
        arena.proveSplitBypass(amounts);
    }

    function testArenaRejectsArbitraryTokenIncludingWIFLikeTokens() public {
        MockFeeToken arbitrary = new MockFeeToken();
        vm.expectRevert(TrainingArena.NotMockToken.selector);
        new TrainingArena(address(arbitrary), 60, 100);
    }

    function testDirectTrainingVaultRejectsArbitraryToken() public {
        MockFeeToken arbitrary = new MockFeeToken();
        vm.expectRevert(TrainingVault.NotMockToken.selector);
        new TrainingVault(address(arbitrary), 60);
    }

    function testArenaRejectsEmptyProof() public {
        uint256[] memory amounts = new uint256[](0);
        vm.expectRevert(TrainingArena.BadEvidence.selector);
        arena.proveSplitBypass(amounts);
    }

    function testArenaRejectsUnfundedExploitation() public {
        TrainingArena emptyArena = new TrainingArena(address(token), 60 ether, 100 ether);
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 60 ether;
        amounts[1] = 50 ether;
        vm.expectRevert(TrainingVault.TransferFailed.selector);
        emptyArena.proveSplitBypass(amounts);
        require(!emptyArena.solved(), "unexpected success");
    }

    function testNoRealRewardTokenIsHeld() public {
        require(arena.solver() == address(0), "unexpected solver");
        require(!arena.solved(), "unexpected success");
    }
}
