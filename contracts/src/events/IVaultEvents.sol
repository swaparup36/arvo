// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

interface IVaultEvents {
    event ETHDeposited(address indexed owner, uint256 amount);

    event TokenDeposited(
        address indexed token,
        uint256 amount,
        address indexed owner
    );

    event ETHWithdrawn(address indexed owner, uint256 amount);

    event TokenWithdrawn(
        address indexed token,
        address indexed owner,
        uint256 amount
    );

    event AssetLocked(address indexed asset, uint256 amount);

    event AssetUnlocked(address indexed asset, uint256 amount);

    event SpendApproved(
        address indexed token,
        address indexed spender,
        uint256 amount
    );

    event TradeExecuted(address indexed target, uint256 value, bytes data);

    event PremiumDeducted(address indexed from, uint256 amount);
}
