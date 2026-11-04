// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BeforeFactory} from "../src/BeforeFactory.sol";
import {BeforeVault} from "../src/BeforeVault.sol";
import {TrainingArena} from "../src/TrainingArena.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {MockFeeToken} from "../src/mocks/MockFeeToken.sol";

interface VmFactory {
    function prank(address who) external;
    function chainId(uint256 newChainId) external;
    function expectRevert(bytes4 errorSelector) external;
    function assume(bool condition) external;
}

contract BeforeFactoryTest {
    VmFactory private constant vm =
        VmFactory(address(uint160(uint256(keccak256("hevm cheat code")))));
    BeforeFactory internal factory;
    MockERC20 internal mock;
    address internal constant ALICE = address(0xA11CE);
    address internal constant BOB = address(0xB0B);

    function setUp() public {
        factory = new BeforeFactory();
        mock = new MockERC20();
    }

    function testDemoIsOwnedByCallerAndFundedAtomically() public {
        vm.prank(ALICE);
        address location = factory.createDemoVault(address(mock));
        BeforeVault vault = BeforeVault(location);
        require(factory.isVault(location), "factory provenance missing");
        require(vault.owner() == ALICE, "owner must be user");
        require(vault.allowedRecipient() == ALICE, "recipient must be user");
        require(vault.token() == address(mock), "wrong token");
        require(vault.maxPerTransfer() == 60 ether, "wrong per-tx cap");
        require(vault.dailyLimit() == 100 ether, "wrong daily cap");
        require(mock.balanceOf(location) == 150 ether, "mock-only funding missing");
        require(factory.latestVaultOf(ALICE) == location, "latest incorrect");
        require(factory.vaultCount(ALICE) == 1, "count incorrect");
    }

    function testUserCanWithdrawWithinLimit() public {
        vm.prank(ALICE);
        address location = factory.createDemoVault(address(mock));
        vm.prank(ALICE);
        BeforeVault(location).withdraw(ALICE, 60 ether);
        require(mock.balanceOf(ALICE) == 60 ether, "withdraw wrong amount");
        require(BeforeVault(location).remainingToday() == 40 ether, "wrong remaining budget");
    }

    function testOutsiderCannotWithdraw() public {
        vm.prank(ALICE);
        address location = factory.createDemoVault(address(mock));
        vm.expectRevert(BeforeVault.Unauthorized.selector);
        vm.prank(BOB);
        BeforeVault(location).withdraw(ALICE, 5 ether);
    }

    function testPolicyDeniesSplitOverspend() public {
        vm.prank(ALICE);
        address location = factory.createDemoVault(address(mock));
        vm.prank(ALICE);
        BeforeVault(location).withdraw(ALICE, 60 ether);
        vm.prank(ALICE);
        BeforeVault(location).withdraw(ALICE, 40 ether);
        vm.expectRevert(BeforeVault.DailyLimitExceeded.selector);
        vm.prank(ALICE);
        BeforeVault(location).withdraw(ALICE, 1 ether);
        require(mock.balanceOf(location) == 50 ether, "funding was incorrectly spent");
    }

    function testCustomVaultPreservesIndividualParameters() public {
        vm.prank(BOB);
        address location = factory.createVault(address(mock), ALICE, 3 ether, 7 ether);
        BeforeVault vault = BeforeVault(location);
        require(vault.owner() == BOB, "owner incorrect");
        require(vault.allowedRecipient() == ALICE, "recipient incorrect");
        require(vault.maxPerTransfer() == 3 ether, "per-transfer incorrect");
        require(vault.dailyLimit() == 7 ether, "daily incorrect");
        require(mock.balanceOf(location) == 0, "custom vault unexpectedly funded");
    }

    function testVaultsOfOnlyReturnsActualVaultsFromThatOwner() public {
        vm.prank(ALICE);
        address first = factory.createDemoVault(address(mock));
        vm.prank(ALICE);
        address second = factory.createDemoVault(address(mock));
        vm.prank(BOB);
        address third = factory.createDemoVault(address(mock));
        address[] memory owned = factory.vaultsOf(ALICE);
        require(owned.length == 2, "count incorrect");
        require(owned[0] == first && owned[1] == second, "order incorrect");
        require(factory.latestVaultOf(BOB) == third, "other owner mixed up");
        require(!factory.isVault(address(0xDEAD)), "spoofed vault incorrectly registered");
    }

    function testCannotProvideAValuableOrNoncanonicalToken() public {
        MockFeeToken fee = new MockFeeToken();
        vm.expectRevert(BeforeFactory.NotMockToken.selector);
        factory.createDemoVault(address(fee));
        vm.expectRevert(BeforeFactory.NotMockToken.selector);
        factory.createVault(address(fee), ALICE, 1, 2);
        vm.expectRevert(BeforeFactory.NotMockToken.selector);
        factory.createDemoVault(address(0));
    }

    function testInvalidPolicyFailsWithoutRegistering() public {
        vm.expectRevert(BeforeVault.InvalidLimits.selector);
        factory.createVault(address(mock), ALICE, 20, 10);
        require(factory.vaultCount(address(this)) == 0, "revert registered a vault");
    }

    function testLatestVaultBeforeCreationReverts() public {
        vm.expectRevert(BeforeFactory.NoVault.selector);
        factory.latestVaultOf(ALICE);
    }

    function testCannotDeployFactoryOnMainnet() public {
        vm.chainId(4663);
        vm.expectRevert(BeforeFactory.TestNetworkOnly.selector);
        new BeforeFactory();
    }

    function testFuzzOwnerAlwaysOwnsVault(address actor) public {
        vm.assume(actor != address(0) && actor != address(factory) && actor != address(mock));
        vm.prank(actor);
        address location = factory.createDemoVault(address(mock));
        require(BeforeVault(location).owner() == actor, "user ownership lost");
        require(factory.isVault(location), "provenance lost");
    }
    function testPracticeIsRegisteredAndFundedWithOnlyMockToken() public {
        vm.prank(ALICE);
        address arena = factory.createPractice(address(mock));
        require(factory.isPractice(arena), "practice provenance missing");
        require(factory.latestPracticeOf(ALICE) == arena, "latest practice wrong");
        require(factory.practiceCount(ALICE) == 1, "practice count wrong");
        address practiceVault = address(TrainingArena(arena).vault());
        require(mock.balanceOf(practiceVault) == 150 ether, "mock practice not funded");
        require(!factory.isVault(practiceVault), "practice must never be trusted as protected");
    }

    function testFreshPracticeCanBeProvenByAnyParticipant() public {
        vm.prank(ALICE);
        address arena = factory.createPractice(address(mock));
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 60 ether;
        amounts[1] = 50 ether;
        vm.prank(BOB);
        TrainingArena(arena).proveSplitBypass(amounts);
        require(TrainingArena(arena).solved(), "not solved");
        require(TrainingArena(arena).solver() == BOB, "wrong solver");
        require(mock.balanceOf(arena) == 110 ether, "no real mock-token movement");
    }

    function testEveryUserCanCreateFreshPractice() public {
        vm.prank(ALICE);
        address first = factory.createPractice(address(mock));
        vm.prank(ALICE);
        address second = factory.createPractice(address(mock));
        require(first != second, "same practice reused");
        require(factory.practiceCount(ALICE) == 2, "practice count wrong");
        require(factory.latestPracticeOf(ALICE) == second, "latest practice wrong");
    }

    function testNoArbitraryTokensInPractice() public {
        MockFeeToken fee = new MockFeeToken();
        vm.expectRevert(BeforeFactory.NotMockToken.selector);
        factory.createPractice(address(fee));
    }

}
