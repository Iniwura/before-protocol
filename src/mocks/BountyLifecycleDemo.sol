// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {WifSecurityChallenge} from "../WifSecurityChallenge.sol";
import {ReviewedFindingVerifier} from "../ReviewedFindingVerifier.sol";
import {MockERC20} from "./MockERC20.sol";

/// @notice Synthetic demo actor controlled by one testnet operator. NOT an independent reviewer.
/// @dev Distinct onchain role addresses exercise the real escrow's sender-bound rules.
contract BountyDemoActor {
    error OnlyCoordinator();

    address public immutable coordinator;

    constructor(address coordinator_) {
        coordinator = coordinator_;
    }

    function execute(address target, bytes calldata data) external returns (bytes memory result) {
        if (msg.sender != coordinator) revert OnlyCoordinator();
        (bool ok, bytes memory output) = target.call(data);
        if (!ok) {
            assembly {
                revert(add(output, 32), mload(output))
            }
        }
        return output;
    }
}

/// @notice BTEST-only orchestrator to demonstrate the existing escrow end-to-end on testnet.
/// @dev ALL roles and approvals are synthetic and controlled by one operator.
///      This proves settlement state transitions, NOT independent review of vulnerabilities.
///      Deployed protocol contracts are never modified. No real WIF can be used.
contract BountyLifecycleDemo {
    error TestnetOnly();
    error NotOperator();
    error NotMockToken();
    error InvalidDeployment();
    error WrongStage();
    error TooEarly();
    error BadAccounting();

    uint256 public constant REWARD = 100 ether;
    uint256 public constant BOND = 10 ether;

    address public immutable operator;
    WifSecurityChallenge public immutable escrow;
    MockERC20 public immutable token;
    address public immutable target;
    BountyDemoActor public immutable sponsor;
    BountyDemoActor public immutable solver;
    BountyDemoActor public immutable reviewerOne;
    BountyDemoActor public immutable reviewerTwo;
    ReviewedFindingVerifier public immutable verifier;

    bytes32 public immutable scopeHash;
    bytes32 public immutable salt;
    uint256 public paidId;
    uint256 public invalidId;
    uint256 public expiredId;
    uint256 public canceledId;
    uint64 public settleAfter;
    uint64 public cleanupAfter;
    uint256 public initialEscrowBalance;

    uint8 public stage; // 0 = deployed, 1 = committed, 2 = settled, 3 = cleaned up

    event DemoStarted(
        uint256 paidId, uint256 invalidId, uint256 expiredId, uint256 canceledId,
        uint64 settleAfter, uint64 cleanupAfter
    );
    event DemoSettled(uint256 sponsorBalance, uint256 solverBalance, uint256 escrowBalance);
    event DemoCompleted(uint256 sponsorBalance, uint256 solverBalance, uint256 escrowBalance);

    modifier onlyOperator() {
        if (msg.sender != operator) revert NotOperator();
        _;
    }

    constructor(address escrow_, address mockToken_, address target_) {
        if (block.chainid != 46630 && block.chainid != 31337) revert TestnetOnly();
        if (escrow_.code.length == 0 || target_.code.length == 0) revert InvalidDeployment();
        if (escrow_.codehash != keccak256(type(WifSecurityChallenge).runtimeCode)) {
            revert InvalidDeployment();
        }
        if (mockToken_.codehash != keccak256(type(MockERC20).runtimeCode)) {
            revert NotMockToken();
        }

        operator = msg.sender;
        escrow = WifSecurityChallenge(escrow_);
        token = MockERC20(mockToken_);
        target = target_;
        scopeHash = keccak256(
            abi.encodePacked("BEFORE-DEMO-BTEST-ONLY-NO-WIF-NO-INDEPENDENT-REVIEW", address(this))
        );
        salt = keccak256(abi.encodePacked("BEFORE-DEMO-SALT", address(this)));
        sponsor = new BountyDemoActor(address(this));
        solver = new BountyDemoActor(address(this));
        reviewerOne = new BountyDemoActor(address(this));
        reviewerTwo = new BountyDemoActor(address(this));
        address[] memory reviewActors = new address[](2);
        reviewActors[0] = address(reviewerOne);
        reviewActors[1] = address(reviewerTwo);
        verifier = new ReviewedFindingVerifier(reviewActors, 2);
    }

    /// @notice One transaction: mint valueless BTEST, create four challenges,
    ///         commit three synthetic findings, cancel one and record two demo approvals.
    function start() external onlyOperator {
        if (stage != 0) revert WrongStage();
        initialEscrowBalance = token.balanceOf(address(escrow));
        token.mint(address(sponsor), 500 ether);
        token.mint(address(solver), 60 ether);
        sponsor.execute(
            address(token),
            abi.encodeWithSelector(MockERC20.approve.selector, address(escrow), type(uint256).max)
        );
        solver.execute(
            address(token),
            abi.encodeWithSelector(MockERC20.approve.selector, address(escrow), type(uint256).max)
        );

        uint64 now_ = uint64(block.timestamp);
        settleAfter = now_ + 65;
        cleanupAfter = now_ + 180;
        paidId = _create(now_ + 65, now_ + 1 days);
        invalidId = _create(now_ + 65, now_ + 180);
        expiredId = _create(now_ + 30, now_ + 65);
        canceledId = _create(now_ + 65, now_ + 180);

        bytes memory evidence = validEvidence();
        bytes memory badEvidence = invalidEvidence();
        _commit(paidId, evidence);
        _commit(invalidId, badEvidence);
        _commit(expiredId, bytes("unanswered mock-only commitment"));

        bytes32 digest = keccak256(evidence);
        reviewerOne.execute(
            address(verifier),
            abi.encodeWithSelector(
                ReviewedFindingVerifier.approveFinding.selector,
                address(escrow), paidId, address(solver), target, scopeHash, digest
            )
        );
        reviewerTwo.execute(
            address(verifier),
            abi.encodeWithSelector(
                ReviewedFindingVerifier.approveFinding.selector,
                address(escrow), paidId, address(solver), target, scopeHash, digest
            )
        );
        sponsor.execute(
            address(escrow), abi.encodeWithSelector(WifSecurityChallenge.cancel.selector, canceledId)
        );

        stage = 1;
        _checkBalances(200 ether, 30 ether, initialEscrowBalance + 330 ether);
        emit DemoStarted(paidId, invalidId, expiredId, canceledId, settleAfter, cleanupAfter);
    }

    /// @notice After testnet clock passes settleAfter: settle approved mock finding,
    ///         slash invalid bond, and refund unanswered expired reward and bond.
    function settle() external onlyOperator {
        if (stage != 1) revert WrongStage();
        if (block.timestamp <= settleAfter) revert TooEarly();
        solver.execute(
            address(escrow),
            abi.encodeWithSelector(WifSecurityChallenge.reveal.selector, paidId, salt, validEvidence())
        );
        solver.execute(
            address(escrow),
            abi.encodeWithSelector(
                WifSecurityChallenge.reveal.selector, invalidId, salt, invalidEvidence()
            )
        );
        sponsor.execute(
            address(escrow),
            abi.encodeWithSelector(WifSecurityChallenge.refundExpiredReward.selector, expiredId)
        );
        solver.execute(
            address(escrow),
            abi.encodeWithSelector(WifSecurityChallenge.refundExpiredBond.selector, expiredId)
        );
        stage = 2;
        _checkBalances(310 ether, 150 ether, initialEscrowBalance + 100 ether);
        emit DemoSettled(
            token.balanceOf(address(sponsor)),
            token.balanceOf(address(solver)),
            token.balanceOf(address(escrow))
        );
    }

    /// @notice After the invalid finding's window closes, return its unclaimed reward.
    function cleanup() external onlyOperator {
        if (stage != 2) revert WrongStage();
        if (block.timestamp <= cleanupAfter) revert TooEarly();
        sponsor.execute(
            address(escrow),
            abi.encodeWithSelector(WifSecurityChallenge.refundExpiredReward.selector, invalidId)
        );
        stage = 3;
        _checkBalances(410 ether, 150 ether, initialEscrowBalance);
        emit DemoCompleted(
            token.balanceOf(address(sponsor)),
            token.balanceOf(address(solver)),
            token.balanceOf(address(escrow))
        );
    }

    function validEvidence() public pure returns (bytes memory) {
        return bytes("BTEST-only training-vault cumulative limit case. Demo reviewers approve context, not independent validation.");
    }

    function invalidEvidence() public pure returns (bytes memory) {
        return bytes("BTEST-only invalid finding. No reviewer approval. Bond should be slashed.");
    }

    function _create(uint64 commitDeadline, uint64 revealDeadline) private returns (uint256 id) {
        WifSecurityChallenge.ChallengeConfig memory config = WifSecurityChallenge.ChallengeConfig({
            rewardToken: address(token),
            rewardAmount: REWARD,
            bondAmount: BOND,
            verifier: address(verifier),
            target: target,
            scopeHash: scopeHash,
            commitDeadline: commitDeadline,
            revealDeadline: revealDeadline
        });
        bytes memory output = sponsor.execute(
            address(escrow), abi.encodeWithSelector(WifSecurityChallenge.createChallenge.selector, config)
        );
        id = abi.decode(output, (uint256));
    }

    function _commit(uint256 id, bytes memory evidence) private {
        bytes32 digest = escrow.commitmentFor(id, address(solver), salt, evidence);
        solver.execute(
            address(escrow),
            abi.encodeWithSelector(WifSecurityChallenge.commit.selector, id, digest)
        );
    }

    function _checkBalances(uint256 sponsorExpected, uint256 solverExpected, uint256 escrowExpected)
        private
        view
    {
        if (
            token.balanceOf(address(sponsor)) != sponsorExpected
                || token.balanceOf(address(solver)) != solverExpected
                || token.balanceOf(address(escrow)) != escrowExpected
        ) revert BadAccounting();
    }
}
