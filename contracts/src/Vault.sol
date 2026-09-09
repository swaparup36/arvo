// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {VaultErrors} from "./libraries/VaultErrors.sol";
import {IVaultEvents} from "./events/IVaultEvents.sol";

contract Vault is Ownable, AccessControl, IVaultEvents, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // allow users to name their vault for convinience
    string public vaultName;
    // locked token deposits
    mapping(address => uint256) public lockedAmount;
    // RBAC
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
    bytes32 public constant ARVO_ROLE = keccak256("ARVO_ROLE");

    constructor(
        address _vaultOwner,
        address _executor,
        address _arvoProto,
        string memory _vaultName
    ) Ownable(_vaultOwner) {
        vaultName = _vaultName;
        _grantRole(EXECUTOR_ROLE, _executor);
        _grantRole(ARVO_ROLE, _arvoProto);
    }

    modifier onlyArvo() {
        require(
            hasRole(ARVO_ROLE, msg.sender),
            "Caller is not Arvo main contract!"
        );
        _;
    }

    modifier onlyExecutor() {
        require(
            hasRole(EXECUTOR_ROLE, msg.sender),
            "Caller is not Executor contract!"
        );
        _;
    }

    modifier checkAmount(uint256 amount) {
        if (amount == 0) {
            revert VaultErrors.InvalidAmount();
        }
        _;
    }

    // helper function to get contract balance
    function _getBalance(address asset) internal view returns (uint256) {
        if (asset == address(0)) {
            return address(this).balance;
        }

        return IERC20(asset).balanceOf(address(this));
    }

    // to allow users to check available unlocked balance
    function availableBalance(address asset) public view returns (uint256) {
        uint256 balance = _getBalance(asset);

        return balance - lockedAmount[asset];
    }

    // to deposit ETH
    function depositETH() external payable onlyOwner checkAmount(msg.value) {
        emit ETHDeposited(owner(), msg.value);
    }

    // to deposit ERC20 token
    function depositToken(
        address token,
        uint256 amount
    ) external onlyOwner checkAmount(amount) {
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        emit TokenDeposited(token, amount, msg.sender);
    }

    // to withdraw ETH
    function withdrawETH(
        uint256 amount
    ) external onlyOwner checkAmount(amount) nonReentrant {
        uint256 available = availableBalance(address(0));

        if (amount > available) {
            revert VaultErrors.InsufficientBalance(available);
        }

        (bool success, ) = payable(owner()).call{value: amount}("");

        if (!success) {
            revert VaultErrors.ExecutionFailed();
        }

        emit ETHWithdrawn(owner(), amount);
    }

    // to withdraw ERC20 token
    function withdrawToken(
        address token,
        uint256 amount
    ) external onlyOwner checkAmount(amount) nonReentrant {
        uint256 available = availableBalance(token);

        if (amount > available) {
            revert VaultErrors.InsufficientBalance(available);
        }

        IERC20(token).safeTransfer(owner(), amount);
        emit TokenWithdrawn(token, owner(), amount);
    }

    // to lock an asset
    function lockAsset(
        address asset,
        uint256 amount
    ) external onlyArvo checkAmount(amount) {
        uint256 available = availableBalance(asset);

        if (available < amount) {
            revert VaultErrors.InsufficientBalance(available);
        }

        lockedAmount[asset] += amount;
        emit AssetLocked(asset, amount);
    }

    // to unlock an asset
    function unlockAsset(
        address asset,
        uint256 amount
    ) external onlyArvo checkAmount(amount) {
        if (lockedAmount[asset] < amount) {
            revert VaultErrors.InvalidUnlock(lockedAmount[asset]);
        }

        lockedAmount[asset] -= amount;
        emit AssetUnlocked(asset, amount);
    }

    // submit trade txn. on-chain
    // currently this function assumes that the txn. sent for execution considers the lock amount
    function execute(
        address target,
        uint256 value,
        bytes calldata data
    ) external onlyExecutor nonReentrant returns (bytes memory result) {
        (bool success, bytes memory returnData) = target.call{value: value}(
            data
        );
        if (!success) revert VaultErrors.ExecutionFailed();

        emit TradeExecuted(target, value, data);

        return returnData;
    }

    // approve spending to router
    function approveToken(
        address token,
        address spender,
        uint256 amount
    ) external onlyExecutor {
        uint256 available = availableBalance(token);

        if (available < amount) {
            revert VaultErrors.InsufficientBalance(available);
        }

        IERC20(token).forceApprove(spender, amount);
        emit SpendApproved(token, spender, amount);
    }

    // to deduct coverage premium
    function deductPremium(
        address to,
        address usdc,
        uint256 amount
    ) external onlyArvo checkAmount(amount) nonReentrant {
        uint256 available = availableBalance(usdc);

        if (available < amount) {
            revert VaultErrors.InsufficientBalance(available);
        }

        IERC20(usdc).safeTransfer(to, amount);

        emit PremiumDeducted(owner(), amount);
    }
}
