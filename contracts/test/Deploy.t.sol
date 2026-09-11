// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Test } from "forge-std/Test.sol";
import { Deploy } from "../script/Deploy.s.sol";

contract DeployTest is Test {
    Deploy d;

    function setUp() public {
        d = new Deploy();
    }

    function test_usdcByChainId() public view {
        assertEq(d.usdc(8453), 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913);
        assertEq(d.usdc(42161), 0xaf88d065e77c8cC2239327C5EDb3A432268e5831);
    }

    function test_unknownChainReverts() public {
        vm.expectRevert();
        d.usdc(999999);
    }

    function test_envOverrideWins() public {
        vm.setEnv("PREMIUM_TOKEN_ADDRESS", "0x00000000000000000000000000000000DeaDBeef");
        vm.chainId(999999); // unsupported chain still deploys when overridden
        assertEq(d.premiumToken(), 0x00000000000000000000000000000000DeaDBeef);
    }
}
