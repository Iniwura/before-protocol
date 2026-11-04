// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IChallengeVerifier} from "./WifSecurityChallenge.sol";

/// @notice Fixed-quorum reviewer gate for a concrete security-finding evidence blob.
/// @dev Reviewers approve the exact challenge context and evidence hash offchain, then record
///      their approvals. The set and threshold are immutable; this contract is not an oracle.
contract ReviewedFindingVerifier is IChallengeVerifier {
    error InvalidReviewers();
    error InvalidEscrow();
    error NotReviewer();
    error AlreadyApproved();

    uint256 public immutable threshold;
    uint256 public immutable reviewerCount;
    mapping(address => bool) public isReviewer;
    mapping(bytes32 => uint256) public approvalCount;
    mapping(bytes32 => mapping(address => bool)) public approvedBy;

    event FindingApproved(bytes32 indexed findingKey, address indexed reviewer);

    constructor(address[] memory reviewers, uint256 threshold_) {
        if (reviewers.length == 0 || threshold_ == 0 || threshold_ > reviewers.length) {
            revert InvalidReviewers();
        }
        for (uint256 i; i < reviewers.length; ++i) {
            address reviewer = reviewers[i];
            if (reviewer == address(0) || isReviewer[reviewer]) revert InvalidReviewers();
            isReviewer[reviewer] = true;
        }
        reviewerCount = reviewers.length;
        threshold = threshold_;
    }

    /// @notice Record one irreversible review of the exact public finding context.
    function approveFinding(
        address escrow,
        uint256 challengeId,
        address solver,
        address target,
        bytes32 scopeHash,
        bytes32 evidenceHash
    ) external {
        if (!isReviewer[msg.sender]) revert NotReviewer();
        if (escrow == address(0) || escrow.code.length == 0) revert InvalidEscrow();
        bytes32 key = findingKey(escrow, challengeId, solver, target, scopeHash, evidenceHash);
        if (approvedBy[key][msg.sender]) revert AlreadyApproved();
        approvedBy[key][msg.sender] = true;
        approvalCount[key] += 1;
        emit FindingApproved(key, msg.sender);
    }

    /// @notice Return true only after the configured reviewer quorum approved this exact evidence.
    function verify(
        uint256 challengeId,
        address solver,
        address target,
        bytes32 scopeHash,
        bytes calldata evidence
    ) external view returns (bool) {
        // msg.sender is the escrow invoking the verifier; binding it prevents approvals from
        // replaying across separate escrow deployments that reuse a challenge ID.
        if (msg.sender.code.length == 0 || target.code.length == 0 || evidence.length == 0) {
            return false;
        }
        bytes32 key = findingKey(
            msg.sender, challengeId, solver, target, scopeHash, keccak256(evidence)
        );
        return approvalCount[key] >= threshold;
    }

    function findingKey(
        address escrow,
        uint256 challengeId,
        address solver,
        address target,
        bytes32 scopeHash,
        bytes32 evidenceHash
    ) public view returns (bytes32) {
        return keccak256(
            abi.encode(
                address(this), block.chainid, escrow, challengeId, solver, target, scopeHash, evidenceHash
            )
        );
    }
}
