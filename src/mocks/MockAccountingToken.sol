// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Test-only token that can violate source-side ERC-20 accounting.
/// @dev It is used to prove that the challenge escrow checks both balance deltas.
contract MockAccountingToken {
    string public constant name = "BEFORE Accounting Test Token";
    string public constant symbol = "BAT";
    uint8 public constant decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    /// @dev Zero is standard accounting; one mints to the recipient without debiting the source.
    uint8 public mode;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function setMode(uint8 mode_) external {
        mode = mode_;
    }

    function mint(address to, uint256 amount) external {
        require(to != address(0), "zero");
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        if (mode == 0) balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) allowance[from][msg.sender] = allowed - amount;
        if (mode == 0) balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}
