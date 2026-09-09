// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

interface IVaultFactoryEvents {
    event VaultCreatedSuccessfully(
        address indexed user,
        address indexed vaultAddress
    );
}
