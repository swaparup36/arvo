// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

interface IVault {
    function availableBalance(address asset) external view returns (uint256);

    function depositETH() external payable;

    function depositToken(address token, uint256 amount) external;

    function withdrawETH(uint256 amount) external;

    function withdrawToken(address token, uint256 amount) external;

    function lockAsset(address asset, uint256 amount) external;

    function unlockAsset(address asset, uint256 amount) external;

    function execute(
        address target,
        uint256 value,
        bytes calldata data
    ) external returns (bytes memory result);

    function approveToken(
        address token,
        address spender,
        uint256 amount
    ) external;

    function deductPremium(address to, address usdc, uint256 amount) external;
}
