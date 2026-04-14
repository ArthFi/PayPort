// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/MockUSDC.sol";

contract DeployMockUSDC is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address recipient = vm.envOr("MOCK_USDC_RECIPIENT", deployer);
        uint256 initialSupply = vm.envOr("MOCK_USDC_INITIAL_SUPPLY", uint256(1_000_000 * 1e6));

        console.log("Deploying MockUSDC...");
        console.log("Deployer:", deployer);
        console.log("Recipient:", recipient);
        console.log("Initial supply (6 decimals):", initialSupply);
        console.log("Chain ID:", block.chainid);

        vm.startBroadcast(deployerPrivateKey);

        MockUSDC mockUsdc = new MockUSDC(recipient, initialSupply);

        vm.stopBroadcast();

        console.log("");
        console.log("===========================================");
        console.log("MockUSDC deployed successfully!");
        console.log("===========================================");
        console.log("Address:", address(mockUsdc));
        console.log("");
        console.log("Update backend/.env:");
        console.log("USDC_ADDRESS=", address(mockUsdc));
        console.log("SUPPORTED_TOKENS=USDC,USDT");
        console.log("TOKEN_CONFIG_JSON={\"USDC\":{\"coin\":\"USDC\",\"address\":\"<replace-with-address>\"},\"USDT\":{\"coin\":\"USDT\",\"address\":\"0x372325443233fEbaC1F6998aC750276468c83CC6\"}}");
        console.log("===========================================");
    }
}
