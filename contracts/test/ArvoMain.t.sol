// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import { Test } from "forge-std/Test.sol";
import { ArvoMain, TradeIntent, RiskAssessment, TradeConfirmation } from "../src/ArvoMain.sol";



contract ArvoMainTest is Test {
    ArvoMain public arvoMain;
    address public premiumTokenAddress;

    function setUp() public {
        premiumTokenAddress = address(0); // Replace with the actual address of the premium token
        arvoMain = new ArvoMain(premiumTokenAddress);    
    }

    
}