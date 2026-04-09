// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/MockKycSBT.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deploying MockKycSBT...");
        console.log("Deployer:", deployer);
        console.log("Chain ID:", block.chainid);

        vm.startBroadcast(deployerPrivateKey);

        MockKycSBT kycSBT = new MockKycSBT();

        address devAccount = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;
        kycSBT.approveKyc(devAccount, "dev.hsk", 2);

        vm.stopBroadcast();

        console.log("");
        console.log("===========================================");
        console.log("MockKycSBT deployed successfully!");
        console.log("===========================================");
        console.log("Address:", address(kycSBT));
        console.log("");
        console.log("Update backend/.env:");
        console.log("KYC_CONTRACT_ADDRESS=", address(kycSBT));
        console.log("DEV_BYPASS_KYC=false");
        console.log("===========================================");
    }
}
