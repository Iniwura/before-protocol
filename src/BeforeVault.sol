// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20Minimal {
    function balanceOf(address account) external view returns (uint256);
}

/// @notice A deliberately narrow, single-token vault with immutable spending policy.
/// @dev Prototype, not audited. Only standard ERC-20 tokens are in scope.
contract BeforeVault {
    error ZeroAddress();
    error InvalidLimits();
    error ZeroAmount();
    error Unauthorized();
    error DestinationNotAllowed();
    error TransferTooLarge();
    error DailyLimitExceeded();
    error TokenTransferFailed();
    error UnsupportedToken();
    error ReentrantCall();

    address public immutable owner;
    address public immutable token;
    address public immutable allowedRecipient;
    uint256 public immutable maxPerTransfer;
    uint256 public immutable dailyLimit;

    uint256 public spentInDay;
    uint256 public currentDay;
    bool private _entered;

    event Deposited(address indexed from, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount, uint256 indexed day, uint256 spentInDay);

    constructor(
        address owner_,
        address token_,
        address allowedRecipient_,
        uint256 maxPerTransfer_,
        uint256 dailyLimit_
    ) {
        if (owner_ == address(0) || token_ == address(0) || allowedRecipient_ == address(0)) {
            revert ZeroAddress();
        }
        if (maxPerTransfer_ == 0 || dailyLimit_ < maxPerTransfer_) revert InvalidLimits();
        if (token_.code.length == 0) revert UnsupportedToken();
        owner = owner_;
        token = token_;
        allowedRecipient = allowedRecipient_;
        maxPerTransfer = maxPerTransfer_;
        dailyLimit = dailyLimit_;
        currentDay = block.timestamp / 1 days;
    }

    modifier nonReentrant() {
        if (_entered) revert ReentrantCall();
        _entered = true;
        _;
        _entered = false;
    }

    /// @notice Send tokens to the vault after approving this contract.
    /// @dev Reject fee-on-transfer / rebasing behavior that breaks exact accounting.
    function deposit(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        uint256 beforeBalance = IERC20Minimal(token).balanceOf(address(this));
        _safeTransferFrom(token, msg.sender, address(this), amount);
        uint256 afterBalance = IERC20Minimal(token).balanceOf(address(this));
        if (afterBalance < beforeBalance || afterBalance - beforeBalance != amount) {
            revert UnsupportedToken();
        }
        emit Deposited(msg.sender, amount);
    }

    /// @notice Withdraw only to the one immutable permitted recipient.
    /// @dev Uses UTC-sized 86400-second windows, not a rolling 24-hour window.
    function withdraw(address recipient, uint256 amount) external nonReentrant {
        if (msg.sender != owner) revert Unauthorized();
        if (recipient != allowedRecipient) revert DestinationNotAllowed();
        if (amount == 0) revert ZeroAmount();
        if (amount > maxPerTransfer) revert TransferTooLarge();

        uint256 day = block.timestamp / 1 days;
        if (currentDay != day) {
            currentDay = day;
            spentInDay = 0;
        }
        if (amount > dailyLimit - spentInDay) revert DailyLimitExceeded();
        uint256 vaultBefore = IERC20Minimal(token).balanceOf(address(this));
        uint256 recipientBefore = IERC20Minimal(token).balanceOf(recipient);
        spentInDay += amount; // effects before interaction
        _safeTransfer(token, recipient, amount);
        uint256 vaultAfter = IERC20Minimal(token).balanceOf(address(this));
        uint256 recipientAfter = IERC20Minimal(token).balanceOf(recipient);
        // Fail closed if balances do not move by the exact authorized amount.
        if (
            vaultAfter > vaultBefore || vaultBefore - vaultAfter != amount
                || recipientAfter < recipientBefore || recipientAfter - recipientBefore != amount
        ) revert UnsupportedToken();
        emit Withdrawn(recipient, amount, day, spentInDay);
    }

    function remainingToday() external view returns (uint256) {
        if (currentDay != block.timestamp / 1 days) return dailyLimit;
        return dailyLimit - spentInDay;
    }

    function _safeTransfer(address asset, address to, uint256 amount) private {
        (bool ok, bytes memory data) = asset.call(
            abi.encodeWithSignature("transfer(address,uint256)", to, amount)
        );
        if (!ok || !_accepted(data)) revert TokenTransferFailed();
    }

    function _safeTransferFrom(address asset, address from, address to, uint256 amount) private {
        (bool ok, bytes memory data) = asset.call(
            abi.encodeWithSignature("transferFrom(address,address,uint256)", from, to, amount)
        );
        if (!ok || !_accepted(data)) revert TokenTransferFailed();
    }

    function _accepted(bytes memory data) private pure returns (bool) {
        if (data.length == 0) return true;
        if (data.length != 32) return false;
        return abi.decode(data, (bool));
    }
}
