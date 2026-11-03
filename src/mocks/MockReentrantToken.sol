// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Test-only token that tries entering the vault again during transfer.
contract MockReentrantToken {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    address public vault;
    address public destination;
    bool public attempted;
    bool public reenterSucceeded;

    function configure(address vault_, address destination_) external {
        vault = vault_;
        destination = destination_;
    }
    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        _transfer(from, to, amount);
        return true;
    }
    function transfer(address to, uint256 amount) external returns (bool) {
        if (vault != address(0) && !attempted) {
            attempted = true;
            (reenterSucceeded,) = vault.call(
                abi.encodeWithSignature("withdraw(address,uint256)", destination, 1)
            );
        }
        _transfer(msg.sender, to, amount);
        return true;
    }
    function _transfer(address from, address to, uint256 amount) internal {
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
    }
}
