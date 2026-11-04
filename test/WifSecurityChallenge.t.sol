// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IChallengeVerifier, WifSecurityChallenge} from "../src/WifSecurityChallenge.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {MockFeeToken} from "../src/mocks/MockFeeToken.sol";

interface VmChallenge {
    function prank(address who) external;
    function warp(uint256 timestamp) external;
    function expectRevert(bytes4 errorSelector) external;
}

contract FixedEvidenceVerifier is IChallengeVerifier {
    bytes32 private immutable _expected;
    bool private immutable _accept;

    constructor(bytes memory expectedEvidence, bool accept_) {
        _expected = keccak256(expectedEvidence);
        _accept = accept_;
    }

    function verify(uint256, address, bytes calldata evidence) external view returns (bool) {
        return _accept && keccak256(evidence) == _expected;
    }
}

contract RevertingVerifier is IChallengeVerifier {
    function verify(uint256, address, bytes calldata) external pure returns (bool) {
        revert("verifier unavailable");
    }
}

contract WifSecurityChallengeTest {
    VmChallenge private constant vm =
        VmChallenge(address(uint160(uint256(keccak256("hevm cheat code")))));
    address internal constant SOLVER = address(0xB0B);
    address internal constant OTHER_SOLVER = address(0xCAFE);

    WifSecurityChallenge internal escrow;
    MockERC20 internal reward;
    FixedEvidenceVerifier internal verifier;

    uint256 internal constant REWARD = 100 ether;
    uint256 internal constant BOND = 10 ether;

    function setUp() public {
        escrow = new WifSecurityChallenge();
        reward = new MockERC20();
        verifier = new FixedEvidenceVerifier(bytes("valid"), true);
        reward.mint(address(this), 1_000 ether);
        reward.mint(SOLVER, 100 ether);
        reward.mint(OTHER_SOLVER, 100 ether);
        reward.approve(address(escrow), type(uint256).max);
        vm.prank(SOLVER);
        reward.approve(address(escrow), type(uint256).max);
        vm.prank(OTHER_SOLVER);
        reward.approve(address(escrow), type(uint256).max);
    }

    function testCreateChallengeEscrowsExactReward() public {
        (uint256 id,,) = _create(verifier);
        (
            address sponsor,
            address token,
            address configuredVerifier,,,
            uint256 rewardAmount,
            uint256 bondAmount,,,
            uint256 commitmentCount,
            bool rewardReleased,
            bool canceled
        ) = escrow.challenges(id);
        require(sponsor == address(this), "wrong sponsor");
        require(token == address(reward), "wrong reward token");
        require(configuredVerifier == address(verifier), "wrong verifier");
        require(rewardAmount == REWARD && bondAmount == BOND, "wrong economics");
        require(commitmentCount == 0 && !rewardReleased && !canceled, "wrong initial state");
        require(reward.balanceOf(address(escrow)) == REWARD, "reward not escrowed exactly");
    }

    function testCommitRevealPaysFirstValidSolverAndBond() public {
        (uint256 id, uint64 commitDeadline,) = _create(verifier);
        bytes memory evidence = bytes("valid");
        bytes32 salt = bytes32(uint256(7));
        bytes32 digest = escrow.commitmentFor(id, SOLVER, salt, evidence);

        vm.prank(SOLVER);
        escrow.commit(id, digest);
        require(reward.balanceOf(address(escrow)) == REWARD + BOND, "bond not escrowed");

        vm.warp(uint256(commitDeadline) + 1);
        vm.prank(SOLVER);
        escrow.reveal(id, salt, evidence);

        require(reward.balanceOf(SOLVER) == 100 ether + REWARD, "wrong payout");
        require(reward.balanceOf(address(escrow)) == 0, "escrow not settled");
        (,, WifSecurityChallenge.CommitmentStatus settledStatus) = escrow.commitments(id, SOLVER);
        require(settledStatus == WifSecurityChallenge.CommitmentStatus.Settled, "not settled");
    }

    function testCopiedCommitmentCannotBeRevealedByAnotherWallet() public {
        (uint256 id, uint64 commitDeadline,) = _create(verifier);
        bytes memory evidence = bytes("valid");
        bytes32 salt = bytes32(uint256(8));
        bytes32 digest = escrow.commitmentFor(id, SOLVER, salt, evidence);

        vm.prank(SOLVER);
        escrow.commit(id, digest);
        vm.prank(OTHER_SOLVER);
        escrow.commit(id, digest);

        vm.warp(uint256(commitDeadline) + 1);
        vm.expectRevert(WifSecurityChallenge.CommitmentMismatch.selector);
        vm.prank(OTHER_SOLVER);
        escrow.reveal(id, salt, evidence);
        require(reward.balanceOf(OTHER_SOLVER) == 100 ether - BOND, "copied reveal moved funds");
    }

    function testOtherCommittedSolverCanRecoverBondAfterFirstValidClaim() public {
        (uint256 id, uint64 commitDeadline,) = _create(verifier);
        bytes memory evidence = bytes("valid");
        bytes32 solverSalt = bytes32(uint256(13));
        bytes32 otherSalt = bytes32(uint256(14));
        bytes32 solverDigest = escrow.commitmentFor(id, SOLVER, solverSalt, evidence);
        bytes32 otherDigest = escrow.commitmentFor(id, OTHER_SOLVER, otherSalt, evidence);
        vm.prank(SOLVER);
        escrow.commit(id, solverDigest);
        vm.prank(OTHER_SOLVER);
        escrow.commit(id, otherDigest);

        vm.warp(uint256(commitDeadline) + 1);
        vm.prank(SOLVER);
        escrow.reveal(id, solverSalt, evidence);
        vm.prank(OTHER_SOLVER);
        escrow.refundExpiredBond(id);
        require(reward.balanceOf(OTHER_SOLVER) == 100 ether, "settled challenge locked bond");
    }

    function testInvalidEvidenceSlashesOnlyTheBond() public {
        (uint256 id, uint64 commitDeadline,) = _create(verifier);
        bytes memory evidence = bytes("wrong");
        bytes32 salt = bytes32(uint256(9));
        bytes32 digest = escrow.commitmentFor(id, SOLVER, salt, evidence);
        vm.prank(SOLVER);
        escrow.commit(id, digest);

        vm.warp(uint256(commitDeadline) + 1);
        vm.prank(SOLVER);
        escrow.reveal(id, salt, evidence);

        require(reward.balanceOf(SOLVER) == 100 ether - BOND, "invalid proof was paid");
        require(reward.balanceOf(address(this)) == 900 ether + BOND, "bond was not slashed");
        require(reward.balanceOf(address(escrow)) == REWARD, "reward escrow was touched");
        (,, WifSecurityChallenge.CommitmentStatus slashedStatus) = escrow.commitments(id, SOLVER);
        require(slashedStatus == WifSecurityChallenge.CommitmentStatus.Slashed, "not slashed");
    }

    function testVerifierFailureDoesNotSlashAndBondCanExpire() public {
        RevertingVerifier unavailable = new RevertingVerifier();
        (uint256 id, uint64 commitDeadline, uint64 revealDeadline) = _create(unavailable);
        bytes memory evidence = bytes("anything");
        bytes32 salt = bytes32(uint256(10));
        bytes32 digest = escrow.commitmentFor(id, SOLVER, salt, evidence);
        vm.prank(SOLVER);
        escrow.commit(id, digest);

        vm.warp(uint256(commitDeadline) + 1);
        vm.expectRevert(WifSecurityChallenge.VerifierFailed.selector);
        vm.prank(SOLVER);
        escrow.reveal(id, salt, evidence);
        (,, WifSecurityChallenge.CommitmentStatus pendingStatus) = escrow.commitments(id, SOLVER);
        require(pendingStatus == WifSecurityChallenge.CommitmentStatus.Pending, "bond changed");

        vm.warp(uint256(revealDeadline) + 1);
        vm.prank(SOLVER);
        escrow.refundExpiredBond(id);
        require(reward.balanceOf(SOLVER) == 100 ether, "bond not refunded");
    }

    function testExpiryRefundsRewardAndLeavesPendingBondsClaimable() public {
        (uint256 id,, uint64 revealDeadline) = _create(verifier);
        bytes memory evidence = bytes("valid");
        bytes32 salt = bytes32(uint256(11));
        bytes32 digest = escrow.commitmentFor(id, SOLVER, salt, evidence);
        vm.prank(SOLVER);
        escrow.commit(id, digest);

        vm.warp(uint256(revealDeadline) + 1);
        escrow.refundExpiredReward(id);
        require(reward.balanceOf(address(this)) == 1_000 ether, "reward not refunded");

        vm.prank(SOLVER);
        escrow.refundExpiredBond(id);
        require(reward.balanceOf(SOLVER) == 100 ether, "pending bond not refunded");
        (,, WifSecurityChallenge.CommitmentStatus refundedStatus) = escrow.commitments(id, SOLVER);
        require(refundedStatus == WifSecurityChallenge.CommitmentStatus.Refunded, "not refunded");
    }

    function testSponsorCanCancelBeforeAnyCommit() public {
        (uint256 id,,) = _create(verifier);
        escrow.cancel(id);
        require(reward.balanceOf(address(this)) == 1_000 ether, "cancel did not refund reward");
        (,,,,,,,,,, bool rewardReleased, bool canceled) = escrow.challenges(id);
        require(rewardReleased && canceled, "cancel state missing");
    }

    function testSponsorCannotCancelAfterCommit() public {
        (uint256 id,,) = _create(verifier);
        bytes memory evidence = bytes("valid");
        bytes32 digest = escrow.commitmentFor(id, SOLVER, bytes32(uint256(12)), evidence);
        vm.prank(SOLVER);
        escrow.commit(id, digest);
        vm.expectRevert(WifSecurityChallenge.HasCommitments.selector);
        escrow.cancel(id);
    }

    function testFeeOnTransferRewardCannotBeEscrowed() public {
        MockFeeToken fee = new MockFeeToken();
        fee.mint(address(this), 100 ether);
        fee.approve(address(escrow), 100 ether);
        vm.expectRevert(WifSecurityChallenge.UnsupportedToken.selector);
        escrow.createChallenge(
            address(fee),
            10 ether,
            1 ether,
            address(verifier),
            uint64(block.timestamp + 1 days),
            uint64(block.timestamp + 2 days)
        );
    }

    function testInvalidWindowsAndMissingChallengeFailClosed() public {
        vm.expectRevert(WifSecurityChallenge.InvalidWindow.selector);
        escrow.createChallenge(
            address(reward),
            REWARD,
            BOND,
            address(verifier),
            uint64(block.timestamp + 2 days),
            uint64(block.timestamp + 1 days)
        );
        vm.expectRevert(WifSecurityChallenge.ChallengeNotFound.selector);
        escrow.commitmentFor(999, SOLVER, bytes32(0), bytes("valid"));
    }

    function _create(IChallengeVerifier configuredVerifier)
        internal
        returns (uint256 id, uint64 commitDeadline, uint64 revealDeadline)
    {
        commitDeadline = uint64(block.timestamp + 1 days);
        revealDeadline = uint64(block.timestamp + 2 days);
        id = escrow.createChallenge(
            address(reward),
            REWARD,
            BOND,
            address(configuredVerifier),
            commitDeadline,
            revealDeadline
        );
    }
}
