// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockUSDC {
    string public constant name = "Mock USD Coin";
    string public constant symbol = "USDC";
    uint8 public constant decimals = 6;

    uint256 public totalSupply;
    address public owner;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error NotOwner();
    error InsufficientBalance();
    error InsufficientAllowance();
    error ZeroAddress();

    constructor(address initialRecipient, uint256 initialSupply) {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), owner);

        if (initialRecipient != address(0) && initialSupply > 0) {
            _mint(initialRecipient, initialSupply);
        }
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transfer(address to, uint256 value) external returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed < value) revert InsufficientAllowance();

        allowance[from][msg.sender] = allowed - value;
        emit Approval(from, msg.sender, allowance[from][msg.sender]);

        _transfer(from, to, value);
        return true;
    }

    function mint(address to, uint256 value) external onlyOwner {
        _mint(to, value);
    }

    function faucet(uint256 value) external {
        _mint(msg.sender, value);
    }

    function _transfer(address from, address to, uint256 value) internal {
        if (to == address(0)) revert ZeroAddress();

        uint256 bal = balanceOf[from];
        if (bal < value) revert InsufficientBalance();

        balanceOf[from] = bal - value;
        balanceOf[to] += value;

        emit Transfer(from, to, value);
    }

    function _mint(address to, uint256 value) internal {
        if (to == address(0)) revert ZeroAddress();

        totalSupply += value;
        balanceOf[to] += value;

        emit Transfer(address(0), to, value);
    }
}
