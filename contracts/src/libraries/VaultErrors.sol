// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

library VaultErrors {
    error ExecutionFailed();

    error InsufficientBalance(uint256 balance);

    error InvalidUnlock(uint256 lockedBalance);

    error InvalidAmount();
}
