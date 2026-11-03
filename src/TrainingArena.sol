// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TrainingVault} from "./TrainingVault.sol";
import {IERC20Minimal} from "./BeforeVault.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

/// @notice Deterministic training proof only. No rewards or customer funds.
/// @dev Deploy only with a mock ERC-20 token. Each instance can be solved once.
contract TrainingArena {
    error InvalidSetup();
    error TrainingNetworkOnly();
    error AlreadySolved();
    error NotAnExploit();
    error BadEvidence();
    error FundingFailed();
    error NotMockToken();
    error ReentrantCall();

    TrainingVault public immutable vault;
    address public immutable token;
    uint256 public immutable hypotheticalDailyCap;
    bool public solved;
    bool private _entered;
    address public solver;

    event SplitLimitBypassProved(address indexed solver, uint256 totalReleased, uint256 assumedDailyCap);

    constructor(address mockToken, uint256 perTransferCap, uint256 assumedDailyCap) {
        if (block.chainid != 31337 && block.chainid != 46630) revert TrainingNetworkOnly();
        if (mockToken == address(0) || perTransferCap == 0 || assumedDailyCap <= perTransferCap) {
            revert InvalidSetup();
        }
        // Bytecode equality prevents accidentally funding a practice challenge with
        // mainnet WIF or any other asset. Test/mock tokens have unrestricted minting.
        if (mockToken.codehash != keccak256(type(MockERC20).runtimeCode)) revert NotMockToken();
        token = mockToken;
        hypotheticalDailyCap = assumedDailyCap;
        vault = new TrainingVault(mockToken, perTransferCap);
    }

    modifier nonReentrant() {
        if (_entered) revert ReentrantCall();
        _entered = true;
        _;
        _entered = false;
    }

    /// @notice A sponsor sends mock tokens directly to the deliberately insecure vault.
    function fund(uint256 amount) external nonReentrant {
        if (amount == 0) revert InvalidSetup();
        uint256 previous = IERC20Minimal(token).balanceOf(address(vault));
        (bool ok, bytes memory data) = token.call(
            abi.encodeWithSignature("transferFrom(address,address,uint256)", msg.sender, address(vault), amount)
        );
        if (!ok || (data.length != 0 && (data.length != 32 || !abi.decode(data, (bool))))) {
            revert FundingFailed();
        }
        if (IERC20Minimal(token).balanceOf(address(vault)) != previous + amount) revert FundingFailed();
    }

    /// @notice Prove an actual multi-transfer bypass with token balance deltas.
    /// @dev The missing daily rule is intentional, and the success condition is public.
    function proveSplitBypass(uint256[] calldata amounts) external nonReentrant {
        if (solved) revert AlreadySolved();
        if (amounts.length < 2 || amounts.length > 8) revert BadEvidence();

        uint256 beforeBalance = IERC20Minimal(token).balanceOf(address(this));
        uint256 released = 0;
        for (uint256 i; i < amounts.length; ++i) {
            uint256 amount = amounts[i];
            vault.release(address(this), amount);
            released += amount;
        }
        if (released <= hypotheticalDailyCap) revert NotAnExploit();
        if (IERC20Minimal(token).balanceOf(address(this)) - beforeBalance != released) {
            revert BadEvidence();
        }
        solved = true;
        solver = msg.sender;
        emit SplitLimitBypassProved(msg.sender, released, hypotheticalDailyCap);
    }
}
