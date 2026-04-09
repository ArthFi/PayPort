// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockKycSBT {

    enum KycLevel  { NONE, BASIC, ADVANCED, PREMIUM, ULTIMATE }
    enum KycStatus { NONE, APPROVED, REVOKED }

    struct KycInfo {
        string    ensName;
        KycLevel  level;
        KycStatus status;
        uint256   createTime;
    }

    address public owner;
    mapping(address => KycInfo) private _kycData;

    event KycApproved(address indexed user, KycLevel level, string ensName);
    event KycRevoked(address indexed user);
    event KycRequested(address indexed user, string ensName);

    error OnlyOwner();
    error InsufficientFee();
    error ZeroAddress();

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }


    function approveKyc(address user, string calldata ensName, uint8 level)
        external onlyOwner
    {
        if (user == address(0)) revert ZeroAddress();
        _kycData[user] = KycInfo({
            ensName:    ensName,
            level:      KycLevel(level),
            status:     KycStatus.APPROVED,
            createTime: block.timestamp
        });
        emit KycApproved(user, KycLevel(level), ensName);
    }

    function revokeKyc(address user) external onlyOwner {
        _kycData[user].status = KycStatus.REVOKED;
        emit KycRevoked(user);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        owner = newOwner;
    }

    function withdraw() external onlyOwner {
        (bool ok,) = owner.call{value: address(this).balance}("");
        require(ok, "Withdraw failed");
    }


    function requestKyc(string calldata ensName) external payable {
        if (msg.value < 0.001 ether) revert InsufficientFee();
        _kycData[msg.sender] = KycInfo({
            ensName:    ensName,
            level:      KycLevel.BASIC,
            status:     KycStatus.APPROVED,
            createTime: block.timestamp
        });
        emit KycRequested(msg.sender, ensName);
        emit KycApproved(msg.sender, KycLevel.BASIC, ensName);
    }


    function isHuman(address account)
        external view
        returns (bool isValid, uint8 level)
    {
        KycInfo storage info = _kycData[account];
        isValid = (info.status == KycStatus.APPROVED && info.level >= KycLevel.BASIC);
        level   = uint8(info.level);
    }

    function getKycInfo(address account)
        external view
        returns (
            string memory ensName,
            uint8  level,
            uint8  status,
            uint256 createTime
        )
    {
        KycInfo storage info = _kycData[account];
        return (info.ensName, uint8(info.level), uint8(info.status), info.createTime);
    }

    receive() external payable {}
}
