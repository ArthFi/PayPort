// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MockKycSBT.sol";

contract MockKycSBTTest is Test {

    MockKycSBT public kycSBT;
    address public user1;
    address public user2;

    event KycApproved(address indexed user, MockKycSBT.KycLevel level, string ensName);
    event KycRevoked(address indexed user);
    event KycRequested(address indexed user, string ensName);

    function setUp() public {
        user1  = makeAddr("user1");
        user2  = makeAddr("user2");
        kycSBT = new MockKycSBT();
    }


    function test_IsHumanFalseByDefault() public view {
        (bool isValid, uint8 level) = kycSBT.isHuman(user1);
        assertFalse(isValid, "Should not be human by default");
        assertEq(level, 0, "Level should be 0 by default");
    }

    function test_IsHumanTrueAfterApproval() public {
        kycSBT.approveKyc(user1, "user1.hsk", 2);
        (bool isValid, uint8 level) = kycSBT.isHuman(user1);
        assertTrue(isValid, "Should be human after approval");
        assertEq(level, 2, "Level should be 2 (ADVANCED)");
    }

    function test_IsHumanFalseAfterRevoke() public {
        kycSBT.approveKyc(user1, "user1.hsk", 2);
        kycSBT.revokeKyc(user1);
        (bool isValid,) = kycSBT.isHuman(user1);
        assertFalse(isValid, "Should not be human after revoke");
    }


    function test_ApproveKycSetsAllFields() public {
        kycSBT.approveKyc(user1, "user1.hsk", 3);
        (string memory ensName, uint8 level, uint8 status, uint256 createTime) =
            kycSBT.getKycInfo(user1);
        assertEq(ensName,    "user1.hsk",   "ENS name mismatch");
        assertEq(level,      3,             "Level mismatch");
        assertEq(status,     1,             "Status should be APPROVED (1)");
        assertGt(createTime, 0,             "createTime should be set");
    }

    function test_ApproveKycEmitsEvent() public {
        vm.expectEmit(true, false, false, true);
        emit KycApproved(user1, MockKycSBT.KycLevel.ADVANCED, "user1.hsk");
        kycSBT.approveKyc(user1, "user1.hsk", 2);
    }

    function test_OnlyOwnerCanApprove() public {
        vm.prank(user1);
        vm.expectRevert(MockKycSBT.OnlyOwner.selector);
        kycSBT.approveKyc(user2, "user2.hsk", 1);
    }

    function test_ApproveRejectsZeroAddress() public {
        vm.expectRevert(MockKycSBT.ZeroAddress.selector);
        kycSBT.approveKyc(address(0), "zero.hsk", 1);
    }

    function test_OnlyOwnerCanRevoke() public {
        kycSBT.approveKyc(user1, "user1.hsk", 2);
        vm.prank(user2);
        vm.expectRevert(MockKycSBT.OnlyOwner.selector);
        kycSBT.revokeKyc(user1);
    }


    function test_RequestKycSelfApproves() public {
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        kycSBT.requestKyc{value: 0.001 ether}("selfkyc.hsk");
        (bool isValid, uint8 level) = kycSBT.isHuman(user1);
        assertTrue(isValid, "Should be human after self-KYC");
        assertEq(level, 1, "Level should be BASIC (1)");
    }

    function test_RequestKycRequiresFee() public {
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        vm.expectRevert(MockKycSBT.InsufficientFee.selector);
        kycSBT.requestKyc{value: 0}("noFee.hsk");
    }


    function test_GetKycInfoReturnsZerosForUnknown() public view {
        (string memory ensName, uint8 level, uint8 status, uint256 createTime) =
            kycSBT.getKycInfo(user2);
        assertEq(bytes(ensName).length, 0, "ensName should be empty");
        assertEq(level,      0, "level should be 0");
        assertEq(status,     0, "status should be 0 (NONE)");
        assertEq(createTime, 0, "createTime should be 0");
    }


    function test_FullFlow_ApprovePayRevoke() public {
        kycSBT.approveKyc(user1, "merchant.hsk", 2);
        (bool v1,) = kycSBT.isHuman(user1);
        assertTrue(v1);

        kycSBT.approveKyc(user2, "customer.hsk", 1);
        (bool v2,) = kycSBT.isHuman(user2);
        assertTrue(v2);

        kycSBT.revokeKyc(user2);
        (bool v3,) = kycSBT.isHuman(user2);
        assertFalse(v3);

        (bool v4,) = kycSBT.isHuman(user1);
        assertTrue(v4);
    }
}
