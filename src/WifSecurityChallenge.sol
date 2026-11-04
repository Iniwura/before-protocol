// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IChallengeVerifier {
    /// @notice Return true only when evidence proves the challenge's stated finding.
    /// @dev The verifier must be independently reviewed and should bind challengeId and solver.
    function verify(uint256 challengeId, address solver, bytes calldata evidence)
        external
        view
        returns (bool);
}

interface IERC20Challenge {
    function balanceOf(address account) external view returns (uint256);
}

/// @notice Bounded, commit/reveal ERC-20 escrow for independently verifiable security findings.
/// @dev This contract is reward-token agnostic and can hold WIF when configured with the
///      intended Robinhood Chain WIF token. It is not a verifier, an audit, or a custody vault.
contract WifSecurityChallenge {
    error ZeroAddress();
    error InvalidReward();
    error InvalidBond();
    error InvalidVerifier();
    error InvalidWindow();
    error ChallengeNotFound();
    error ChallengeClosed();
    error CommitWindowClosed();
    error RevealWindowClosed();
    error CommitmentRequired();
    error AlreadyCommitted();
    error CommitmentMismatch();
    error AlreadySettled();
    error VerifierChanged();
    error VerifierFailed();
    error NotSponsor();
    error HasCommitments();
    error RewardAlreadyReleased();
    error NotExpired();
    error TransferFailed();
    error UnsupportedToken();
    error ReentrantCall();

    uint256 public constant MAX_WINDOW = 30 days;

    enum CommitmentStatus {
        None,
        Pending,
        Settled,
        Slashed,
        Refunded
    }

    struct Challenge {
        address sponsor;
        address rewardToken;
        address verifier;
        bytes32 rewardTokenCodeHash;
        bytes32 verifierCodeHash;
        uint256 rewardAmount;
        uint256 bondAmount;
        uint64 commitDeadline;
        uint64 revealDeadline;
        uint256 commitmentCount;
        bool rewardReleased;
        bool canceled;
    }

    struct Commitment {
        bytes32 digest;
        uint256 bondAmount;
        CommitmentStatus status;
    }

    uint256 public nextChallengeId = 1;
    mapping(uint256 => Challenge) public challenges;
    mapping(uint256 => mapping(address => Commitment)) public commitments;

    bool private _entered;

    event ChallengeCreated(
        uint256 indexed challengeId,
        address indexed sponsor,
        address indexed rewardToken,
        address verifier,
        uint256 rewardAmount,
        uint256 bondAmount,
        uint64 commitDeadline,
        uint64 revealDeadline
    );
    event CommitmentSubmitted(
        uint256 indexed challengeId, address indexed solver, bytes32 commitment
    );
    event RewardPaid(
        uint256 indexed challengeId,
        address indexed solver,
        uint256 rewardAmount,
        uint256 bondAmount
    );
    event InvalidEvidence(uint256 indexed challengeId, address indexed solver, uint256 slashedBond);
    event ChallengeCanceled(uint256 indexed challengeId, uint256 refundedReward);
    event ChallengeExpired(uint256 indexed challengeId, uint256 refundedReward);
    event BondRefunded(uint256 indexed challengeId, address indexed solver, uint256 bondAmount);

    modifier nonReentrant() {
        if (_entered) revert ReentrantCall();
        _entered = true;
        _;
        _entered = false;
    }

    /// @notice Escrow a reward and publish a bounded challenge window.
    /// @dev The verifier is part of the challenge's public trust boundary. Review its source
    ///      and ensure it binds both challengeId and solver before funding a live challenge.
    function createChallenge(
        address rewardToken,
        uint256 rewardAmount,
        uint256 bondAmount,
        address verifier,
        uint64 commitDeadline,
        uint64 revealDeadline
    ) external nonReentrant returns (uint256 challengeId) {
        if (rewardToken == address(0) || verifier == address(0)) {
            revert ZeroAddress();
        }
        if (rewardAmount == 0) revert InvalidReward();
        if (bondAmount == 0 || rewardAmount > type(uint256).max - bondAmount) revert InvalidBond();
        if (rewardToken.code.length == 0) revert UnsupportedToken();
        if (verifier.code.length == 0) revert InvalidVerifier();
        if (
            commitDeadline <= block.timestamp || revealDeadline <= commitDeadline
                || revealDeadline > block.timestamp + MAX_WINDOW
        ) revert InvalidWindow();

        _pullExact(rewardToken, msg.sender, address(this), rewardAmount);

        challengeId = nextChallengeId++;
        challenges[challengeId] = Challenge({
            sponsor: msg.sender,
            rewardToken: rewardToken,
            verifier: verifier,
            rewardTokenCodeHash: rewardToken.codehash,
            verifierCodeHash: verifier.codehash,
            rewardAmount: rewardAmount,
            bondAmount: bondAmount,
            commitDeadline: commitDeadline,
            revealDeadline: revealDeadline,
            commitmentCount: 0,
            rewardReleased: false,
            canceled: false
        });

        emit ChallengeCreated(
            challengeId,
            msg.sender,
            rewardToken,
            verifier,
            rewardAmount,
            bondAmount,
            commitDeadline,
            revealDeadline
        );
    }

    /// @notice Derive the solver-bound commitment offchain before submitting commit().
    function commitmentFor(
        uint256 challengeId,
        address solver,
        bytes32 salt,
        bytes calldata evidence
    ) external view returns (bytes32) {
        _requireChallenge(challengeId);
        return _commitment(challengeId, solver, salt, evidence);
    }

    /// @notice Lock a bond against a private evidence hash.
    /// @dev The solver address is part of the digest, so a copied commitment cannot be revealed
    ///      by a mempool observer under their own address.
    function commit(uint256 challengeId, bytes32 commitment) external nonReentrant {
        Challenge storage challenge = _requireChallenge(challengeId);
        if (challenge.canceled || challenge.rewardReleased) revert ChallengeClosed();
        if (block.timestamp >= challenge.commitDeadline) revert CommitWindowClosed();
        if (commitment == bytes32(0)) revert CommitmentRequired();
        if (challenge.rewardToken.codehash != challenge.rewardTokenCodeHash) {
            revert UnsupportedToken();
        }

        Commitment storage current = commitments[challengeId][msg.sender];
        if (current.status != CommitmentStatus.None) revert AlreadyCommitted();

        _pullExact(challenge.rewardToken, msg.sender, address(this), challenge.bondAmount);
        current.digest = commitment;
        current.bondAmount = challenge.bondAmount;
        current.status = CommitmentStatus.Pending;
        challenge.commitmentCount += 1;
        emit CommitmentSubmitted(challengeId, msg.sender, commitment);
    }

    /// @notice Reveal evidence and settle the first valid proof.
    /// @dev A verifier revert does not slash the solver's bond; the solver can retry while the
    ///      reveal window remains open. A verifier returning false is an invalid proof and slashes.
    function reveal(uint256 challengeId, bytes32 salt, bytes calldata evidence)
        external
        nonReentrant
    {
        Challenge storage challenge = _requireChallenge(challengeId);
        if (challenge.canceled || challenge.rewardReleased) revert ChallengeClosed();
        if (
            block.timestamp <= challenge.commitDeadline
                || block.timestamp > challenge.revealDeadline
        ) {
            revert RevealWindowClosed();
        }
        if (challenge.verifier.codehash != challenge.verifierCodeHash) revert VerifierChanged();
        if (challenge.rewardToken.codehash != challenge.rewardTokenCodeHash) {
            revert UnsupportedToken();
        }

        Commitment storage current = commitments[challengeId][msg.sender];
        if (current.status == CommitmentStatus.None) revert CommitmentRequired();
        if (current.status != CommitmentStatus.Pending) revert AlreadySettled();
        if (current.digest != _commitment(challengeId, msg.sender, salt, evidence)) {
            revert CommitmentMismatch();
        }

        bool valid = false;
        try IChallengeVerifier(challenge.verifier)
            .verify(challengeId, msg.sender, evidence) returns (
            bool result
        ) {
            valid = result;
        } catch {
            revert VerifierFailed();
        }

        current.status = valid ? CommitmentStatus.Settled : CommitmentStatus.Slashed;
        challenge.commitmentCount -= 1;
        if (valid) {
            challenge.rewardReleased = true;
            _pushExact(
                challenge.rewardToken, msg.sender, challenge.rewardAmount + current.bondAmount
            );
            emit RewardPaid(challengeId, msg.sender, challenge.rewardAmount, current.bondAmount);
        } else {
            _pushExact(challenge.rewardToken, challenge.sponsor, current.bondAmount);
            emit InvalidEvidence(challengeId, msg.sender, current.bondAmount);
        }
    }

    /// @notice Refund an unclaimed reward after the reveal window closes.
    function refundExpiredReward(uint256 challengeId) external nonReentrant {
        Challenge storage challenge = _requireChallenge(challengeId);
        if (msg.sender != challenge.sponsor) revert NotSponsor();
        if (block.timestamp <= challenge.revealDeadline) revert NotExpired();
        if (challenge.rewardReleased || challenge.canceled) revert RewardAlreadyReleased();
        if (challenge.rewardToken.codehash != challenge.rewardTokenCodeHash) {
            revert UnsupportedToken();
        }

        challenge.rewardReleased = true;
        _pushExact(challenge.rewardToken, challenge.sponsor, challenge.rewardAmount);
        emit ChallengeExpired(challengeId, challenge.rewardAmount);
    }

    /// @notice Return a solver's bond after an unanswered commitment expires.
    function refundExpiredBond(uint256 challengeId) external nonReentrant {
        Challenge storage challenge = _requireChallenge(challengeId);
        if (!challenge.rewardReleased && block.timestamp <= challenge.revealDeadline) {
            revert NotExpired();
        }
        if (challenge.rewardToken.codehash != challenge.rewardTokenCodeHash) {
            revert UnsupportedToken();
        }

        Commitment storage current = commitments[challengeId][msg.sender];
        if (current.status != CommitmentStatus.Pending) revert AlreadySettled();
        current.status = CommitmentStatus.Refunded;
        challenge.commitmentCount -= 1;
        _pushExact(challenge.rewardToken, msg.sender, current.bondAmount);
        emit BondRefunded(challengeId, msg.sender, current.bondAmount);
    }

    /// @notice Cancel an unfunded-to-solvers challenge before anyone commits.
    function cancel(uint256 challengeId) external nonReentrant {
        Challenge storage challenge = _requireChallenge(challengeId);
        if (msg.sender != challenge.sponsor) revert NotSponsor();
        if (block.timestamp >= challenge.commitDeadline) revert CommitWindowClosed();
        if (challenge.commitmentCount != 0) revert HasCommitments();
        if (challenge.rewardReleased || challenge.canceled) revert RewardAlreadyReleased();
        if (challenge.rewardToken.codehash != challenge.rewardTokenCodeHash) {
            revert UnsupportedToken();
        }

        challenge.canceled = true;
        challenge.rewardReleased = true;
        _pushExact(challenge.rewardToken, challenge.sponsor, challenge.rewardAmount);
        emit ChallengeCanceled(challengeId, challenge.rewardAmount);
    }

    function _requireChallenge(uint256 challengeId)
        private
        view
        returns (Challenge storage challenge)
    {
        challenge = challenges[challengeId];
        if (challenge.sponsor == address(0)) revert ChallengeNotFound();
    }

    function _commitment(uint256 challengeId, address solver, bytes32 salt, bytes calldata evidence)
        private
        view
        returns (bytes32)
    {
        return keccak256(abi.encode(address(this), challengeId, solver, salt, keccak256(evidence)));
    }

    function _pullExact(address asset, address from, address to, uint256 amount) private {
        uint256 beforeBalance = IERC20Challenge(asset).balanceOf(to);
        (bool ok, bytes memory data) = asset.call(
            abi.encodeWithSignature("transferFrom(address,address,uint256)", from, to, amount)
        );
        if (!ok || !_accepted(data)) revert TransferFailed();
        uint256 afterBalance = IERC20Challenge(asset).balanceOf(to);
        if (afterBalance < beforeBalance || afterBalance - beforeBalance != amount) {
            revert UnsupportedToken();
        }
    }

    function _pushExact(address asset, address to, uint256 amount) private {
        uint256 beforeBalance = IERC20Challenge(asset).balanceOf(to);
        (bool ok, bytes memory data) =
            asset.call(abi.encodeWithSignature("transfer(address,uint256)", to, amount));
        if (!ok || !_accepted(data)) revert TransferFailed();
        uint256 afterBalance = IERC20Challenge(asset).balanceOf(to);
        if (afterBalance < beforeBalance || afterBalance - beforeBalance != amount) {
            revert UnsupportedToken();
        }
    }

    function _accepted(bytes memory data) private pure returns (bool) {
        if (data.length == 0) return true;
        if (data.length != 32) return false;
        return abi.decode(data, (bool));
    }
}
