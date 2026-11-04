// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IChallengeVerifier, WifSecurityChallenge} from "../src/WifSecurityChallenge.sol";
import {MockAccountingToken} from "../src/mocks/MockAccountingToken.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {MockFeeToken} from "../src/mocks/MockFeeToken.sol";
import {ReviewedFindingVerifier} from "../src/ReviewedFindingVerifier.sol";

interface VmChallenge {
    function prank(address who) external;
    function warp(uint256 timestamp) external;
    function etch(address target, bytes calldata code) external;
    function expectRevert(bytes4 errorSelector) external;
}

contract FixedEvidenceVerifier is IChallengeVerifier {
    bytes32 private immutable _expected;
    bool private immutable _accept;

    constructor(bytes memory expectedEvidence, bool accept_) {
        _expected = keccak256(expectedEvidence);
        _accept = accept_;
    }

    function verify(uint256, address, address, bytes32, bytes calldata evidence)
        external
        view
        returns (bool)
    {
        return _accept && keccak256(evidence) == _expected;
    }
}

contract RevertingVerifier is IChallengeVerifier {
    function verify(uint256, address, address, bytes32, bytes calldata)
        external
        pure
        returns (bool)
    {
        revert("verifier unavailable");
    }
}

contract BindingVerifier is IChallengeVerifier {
    uint256 private immutable _challengeId;
    address private immutable _solver;
    address private immutable _target;
    bytes32 private immutable _scopeHash;
    bytes32 private immutable _evidenceHash;

    constructor(
        uint256 challengeId,
        address solver,
        address target,
        bytes32 scopeHash,
        bytes memory evidence
    ) {
        _challengeId = challengeId;
        _solver = solver;
        _target = target;
        _scopeHash = scopeHash;
        _evidenceHash = keccak256(evidence);
    }

    function verify(
        uint256 challengeId,
        address solver,
        address target,
        bytes32 scopeHash,
        bytes calldata evidence
    ) external view returns (bool) {
        return challengeId == _challengeId && solver == _solver && target == _target
            && scopeHash == _scopeHash && keccak256(evidence) == _evidenceHash;
    }
}

contract ChallengeTarget {}

contract WifSecurityChallengeTest {
    VmChallenge private constant vm =
        VmChallenge(address(uint160(uint256(keccak256("hevm cheat code")))));
    address internal constant SOLVER = address(0xB0B);
    address internal constant OTHER_SOLVER = address(0xCAFE);

    WifSecurityChallenge internal escrow;
    MockERC20 internal reward;
    FixedEvidenceVerifier internal verifier;
    ChallengeTarget internal target;

    uint256 internal constant REWARD = 100 ether;
    uint256 internal constant BOND = 10 ether;

    function setUp() public {
        escrow = new WifSecurityChallenge();
        reward = new MockERC20();
        verifier = new FixedEvidenceVerifier(bytes("valid"), true);
        target = new ChallengeTarget();
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
        WifSecurityChallenge.Challenge memory challenge = escrow.challenges(id);
        require(challenge.sponsor == address(this), "wrong sponsor");
        require(challenge.rewardToken == address(reward), "wrong reward token");
        require(challenge.verifier == address(verifier), "wrong verifier");
        require(challenge.target == address(target), "wrong target");
        require(escrow.targetCodeHashes(id) == address(target).codehash, "wrong target hash");
        require(escrow.scopeHashes(id) == keccak256("before-training-scope-v1"), "wrong scope hash");
        require(challenge.rewardAmount == REWARD && challenge.bondAmount == BOND, "wrong economics");
        require(
            challenge.commitmentCount == 0 && !challenge.rewardReleased && !challenge.canceled,
            "wrong initial state"
        );
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

    function testVerifierReceivesBoundChallengeContext() public {
        bytes memory evidence = bytes("bound");
        bytes32 scopeHash = keccak256("before-bound-scope-v1");
        BindingVerifier binding =
            new BindingVerifier(1, SOLVER, address(target), scopeHash, evidence);
        uint64 commitDeadline = uint64(block.timestamp + 1 days);
        uint64 revealDeadline = uint64(block.timestamp + 2 days);
        uint256 id = escrow.createChallenge(
            _config(
                address(reward),
                REWARD,
                BOND,
                address(binding),
                address(target),
                scopeHash,
                commitDeadline,
                revealDeadline
            )
        );
        bytes32 salt = bytes32(uint256(16));
        bytes32 digest = escrow.commitmentFor(id, SOLVER, salt, evidence);
        vm.prank(SOLVER);
        escrow.commit(id, digest);
        vm.warp(uint256(commitDeadline) + 1);
        vm.prank(SOLVER);
        escrow.reveal(id, salt, evidence);
        require(reward.balanceOf(SOLVER) == 100 ether + REWARD, "bound verifier rejected context");
    }

    function testReviewedVerifierRequiresFixedQuorumForExactEvidence() public {
        address reviewerA = address(0xA11CE);
        address reviewerB = address(0xB0B0);
        address[] memory reviewers = new address[](2);
        reviewers[0] = reviewerA;
        reviewers[1] = reviewerB;
        ReviewedFindingVerifier reviewed = new ReviewedFindingVerifier(reviewers, 2);
        bytes memory evidence = bytes("reviewed finding");
        bytes32 scopeHash = keccak256("before-reviewed-scope-v1");
        uint64 commitDeadline = uint64(block.timestamp + 1 days);
        uint64 revealDeadline = uint64(block.timestamp + 2 days);
        uint256 id = escrow.createChallenge(
            _config(
                address(reward),
                REWARD,
                BOND,
                address(reviewed),
                address(target),
                scopeHash,
                commitDeadline,
                revealDeadline
            )
        );
        bytes32 evidenceHash = keccak256(evidence);
        vm.prank(reviewerA);
        reviewed.approveFinding(address(escrow), id, SOLVER, address(target), scopeHash, evidenceHash);
        vm.prank(address(escrow));
        require(
            !reviewed.verify(id, SOLVER, address(target), scopeHash, evidence),
            "one review met a two-review quorum"
        );
        vm.prank(reviewerB);
        reviewed.approveFinding(address(escrow), id, SOLVER, address(target), scopeHash, evidenceHash);
        vm.prank(address(escrow));
        require(
            !reviewed.verify(id, SOLVER, address(target), scopeHash, bytes("tampered finding")),
            "review was reused for different evidence"
        );
        WifSecurityChallenge otherEscrow = new WifSecurityChallenge();
        vm.prank(address(otherEscrow));
        require(
            !reviewed.verify(id, SOLVER, address(target), scopeHash, evidence),
            "review was replayed by another escrow"
        );
        bytes32 salt = bytes32(uint256(17));
        bytes32 commitment = escrow.commitmentFor(id, SOLVER, salt, evidence);
        vm.prank(SOLVER);
        escrow.commit(id, commitment);
        vm.warp(uint256(commitDeadline) + 1);
        vm.prank(SOLVER);
        escrow.reveal(id, salt, evidence);
        require(reward.balanceOf(SOLVER) == 100 ether + REWARD, "reviewed finding was not paid");
    }

    function testReviewedVerifierRejectsUnauthorizedAndDuplicateApproval() public {
        address reviewer = address(0xA11CE);
        address[] memory reviewers = new address[](1);
        reviewers[0] = reviewer;
        ReviewedFindingVerifier reviewed = new ReviewedFindingVerifier(reviewers, 1);
        bytes32 scopeHash = keccak256("before-reviewed-scope-v1");
        bytes32 evidenceHash = keccak256(bytes("finding"));

        vm.expectRevert(ReviewedFindingVerifier.NotReviewer.selector);
        reviewed.approveFinding(address(escrow), 1, SOLVER, address(target), scopeHash, evidenceHash);
        vm.prank(reviewer);
        reviewed.approveFinding(address(escrow), 1, SOLVER, address(target), scopeHash, evidenceHash);
        vm.expectRevert(ReviewedFindingVerifier.AlreadyApproved.selector);
        vm.prank(reviewer);
        reviewed.approveFinding(address(escrow), 1, SOLVER, address(target), scopeHash, evidenceHash);
    }

    function testReviewedVerifierRejectsInvalidReviewerConfiguration() public {
        address reviewer = address(0xA11CE);
        address[] memory reviewers = new address[](1);
        reviewers[0] = reviewer;
        vm.expectRevert(ReviewedFindingVerifier.InvalidReviewers.selector);
        new ReviewedFindingVerifier(reviewers, 2);
        reviewers[0] = address(0);
        vm.expectRevert(ReviewedFindingVerifier.InvalidReviewers.selector);
        new ReviewedFindingVerifier(reviewers, 1);
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

    function testTargetCodeChangeFailsClosed() public {
        (uint256 id, uint64 commitDeadline,) = _create(verifier);
        bytes memory evidence = bytes("valid");
        bytes32 salt = bytes32(uint256(15));
        bytes32 digest = escrow.commitmentFor(id, SOLVER, salt, evidence);
        vm.prank(SOLVER);
        escrow.commit(id, digest);

        vm.etch(address(target), hex"6000");
        vm.warp(uint256(commitDeadline) + 1);
        vm.expectRevert(WifSecurityChallenge.TargetChanged.selector);
        vm.prank(SOLVER);
        escrow.reveal(id, salt, evidence);
    }

    function testVerifierCodeChangeFailsClosed() public {
        (uint256 id, uint64 commitDeadline,) = _create(verifier);
        bytes memory evidence = bytes("valid");
        bytes32 salt = bytes32(uint256(18));
        bytes32 digest = escrow.commitmentFor(id, SOLVER, salt, evidence);
        vm.prank(SOLVER);
        escrow.commit(id, digest);

        vm.etch(address(verifier), hex"6000");
        vm.warp(uint256(commitDeadline) + 1);
        vm.expectRevert(WifSecurityChallenge.VerifierChanged.selector);
        vm.prank(SOLVER);
        escrow.reveal(id, salt, evidence);
    }

    function testRewardTokenCodeChangeFailsClosed() public {
        (uint256 id, uint64 commitDeadline,) = _create(verifier);
        bytes memory evidence = bytes("valid");
        bytes32 salt = bytes32(uint256(19));
        bytes32 digest = escrow.commitmentFor(id, SOLVER, salt, evidence);
        vm.prank(SOLVER);
        escrow.commit(id, digest);

        vm.etch(address(reward), hex"6000");
        vm.warp(uint256(commitDeadline) + 1);
        vm.expectRevert(WifSecurityChallenge.UnsupportedToken.selector);
        vm.prank(SOLVER);
        escrow.reveal(id, salt, evidence);
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
        WifSecurityChallenge.Challenge memory challenge = escrow.challenges(id);
        require(challenge.rewardReleased && challenge.canceled, "cancel state missing");
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
            _config(
                address(fee),
                10 ether,
                1 ether,
                address(verifier),
                address(target),
                bytes32(uint256(1)),
                uint64(block.timestamp + 1 days),
                uint64(block.timestamp + 2 days)
            )
        );
    }

    function testInflatingTokenCannotBeEscrowed() public {
        MockAccountingToken inflation = new MockAccountingToken();
        inflation.mint(address(this), REWARD);
        inflation.approve(address(escrow), REWARD);
        inflation.setMode(1);
        vm.expectRevert(WifSecurityChallenge.UnsupportedToken.selector);
        escrow.createChallenge(
            _config(
                address(inflation),
                REWARD,
                BOND,
                address(verifier),
                address(target),
                bytes32(uint256(1)),
                uint64(block.timestamp + 1 days),
                uint64(block.timestamp + 2 days)
            )
        );
    }

    function testInflatingTokenCannotReleaseEscrowedReward() public {
        MockAccountingToken accounting = new MockAccountingToken();
        accounting.mint(address(this), REWARD);
        accounting.approve(address(escrow), REWARD);
        uint256 id = escrow.createChallenge(
            _config(
                address(accounting),
                REWARD,
                BOND,
                address(verifier),
                address(target),
                bytes32(uint256(1)),
                uint64(block.timestamp + 1 days),
                uint64(block.timestamp + 2 days)
            )
        );
        accounting.setMode(1);
        vm.warp(block.timestamp + 3 days);
        vm.expectRevert(WifSecurityChallenge.UnsupportedToken.selector);
        escrow.refundExpiredReward(id);
        require(!escrow.challenges(id).rewardReleased, "failed transfer changed state");
    }

    function testInvalidWindowsAndMissingChallengeFailClosed() public {
        vm.expectRevert(WifSecurityChallenge.InvalidWindow.selector);
        escrow.createChallenge(
            _config(
                address(reward),
                REWARD,
                BOND,
                address(verifier),
                address(target),
                bytes32(uint256(1)),
                uint64(block.timestamp + 2 days),
                uint64(block.timestamp + 1 days)
            )
        );
        vm.expectRevert(WifSecurityChallenge.InvalidTarget.selector);
        escrow.createChallenge(
            _config(
                address(reward),
                REWARD,
                BOND,
                address(verifier),
                SOLVER,
                bytes32(uint256(1)),
                uint64(block.timestamp + 1 days),
                uint64(block.timestamp + 2 days)
            )
        );
        vm.expectRevert(WifSecurityChallenge.ScopeRequired.selector);
        escrow.createChallenge(
            _config(
                address(reward),
                REWARD,
                BOND,
                address(verifier),
                address(target),
                bytes32(0),
                uint64(block.timestamp + 1 days),
                uint64(block.timestamp + 2 days)
            )
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
            _config(
                address(reward),
                REWARD,
                BOND,
                address(configuredVerifier),
                address(target),
                keccak256("before-training-scope-v1"),
                commitDeadline,
                revealDeadline
            )
        );
    }

    function _config(
        address rewardToken,
        uint256 rewardAmount,
        uint256 bondAmount,
        address configuredVerifier,
        address configuredTarget,
        bytes32 scopeHash,
        uint64 commitDeadline,
        uint64 revealDeadline
    ) internal pure returns (WifSecurityChallenge.ChallengeConfig memory) {
        return WifSecurityChallenge.ChallengeConfig({
                rewardToken: rewardToken,
                rewardAmount: rewardAmount,
                bondAmount: bondAmount,
                verifier: configuredVerifier,
                target: configuredTarget,
                scopeHash: scopeHash,
                commitDeadline: commitDeadline,
                revealDeadline: revealDeadline
            });
    }
}
