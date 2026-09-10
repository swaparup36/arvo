// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Vault} from "./Vault.sol";
import {VaultFactoryErrors} from "./libraries/VaultFactoryErrors.sol";
import {IVaultFactoryEvents} from "./events/IVaultFactoryEvents.sol";

contract VaultFactory is IVaultFactoryEvents {
    mapping(address => address[]) private userVaults;

    constructor() {}

    // to create new vault
    function createVault(
        string memory _vaultName,
        address _arvoProto,
        address _executor
    ) external returns (address) {
        // deploy new vault contract
        Vault newVault = new Vault(
            msg.sender,
            _executor,
            _arvoProto,
            _vaultName
        );

        address vaultAddress = address(newVault);
        userVaults[msg.sender].push(vaultAddress);

        emit VaultCreatedSuccessfully(msg.sender, vaultAddress);

        return vaultAddress;
    }

    function getUserVaults(
        address user
    ) external view returns (address[] memory) {
        return userVaults[user];
    }
}
