// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

interface IVaultFactory {
    function createVault(
        string memory _vaultName,
        address _arvoProto,
        address _executor
    ) external returns (address);

    function getVault(address user) external view returns (address);
}
