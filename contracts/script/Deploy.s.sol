// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Script } from "forge-std/Script.sol";
import { console } from "forge-std/console.sol";

import { VaultFactory } from "../src/VaultFactory.sol";
import { ArvoMain } from "../src/ArvoMain.sol";

contract Deploy is Script {
    // chain agnostic function to get the premium token address for the current chain
    function premiumToken() public view returns (address) {
        if (block.chainid == 1) return 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48; // mainnet USDC
        if (block.chainid == 11155111) return 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238; // Sepolia USDC

        revert("No known USDC for this chain; set PREMIUM_TOKEN_ADDRESS");
    }

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address riskEngineAddress = vm.envAddress("RISK_ENGINE_ADDRESS");
        address executorAddress = vm.envAddress("EXECUTOR_ADDRESS");
        address premiumTokenAddress = premiumToken();
        console.log("Chain:", block.chainid, "premium token:", premiumTokenAddress);

        vm.startBroadcast(deployerPrivateKey);

        // deploy VaultFactory contract
        address vaultFactoryAddress = address(new VaultFactory());
        console.log("VaultFactory deployed at:", vaultFactoryAddress);

        // deploy ArvoMain contract
        ArvoMain arvoMain = new ArvoMain(
            premiumTokenAddress,
            riskEngineAddress,
            executorAddress
        );
        console.log("ArvoMain deployed at:", address(arvoMain));

        vm.stopBroadcast();
    }
}
