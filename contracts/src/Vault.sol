// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {
    SafeERC20
} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

struct TradeExecution {
    address target;
    uint256 value;
    bytes data;
    address inputToken;
    uint256 inputAmount;
    address outputToken;
    uint256 minOutputAmount;
    uint256 deadline;
}

contract Vault is Ownable, AccessControl {
    using SafeERC20 for IERC20;

    // allow users to name their vault for convinience
    string public vaultName;
    // locked token deposits
    mapping(address => uint256) public lockedAmount;
    // RBAC
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
    bytes32 public constant ARVO_ROLE = keccak256("ARVO_ROLE");
    // target whitelist
    mapping(address => bool) public allowedTargets;

    constructor(
        address _executor,
        address _arvoProto,
        string memory _vaultName
    ) Ownable(msg.sender) {
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

    function _getBalance(address asset) internal view returns (uint256) {
        if (asset == address(0)) {
            return address(this).balance;
        }

        return IERC20(asset).balanceOf(address(this));
    }

    function depositETH() external payable {
        require(msg.value > 0);
    }

    function depositToken(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
    }

    function receive() external payable {}

    function withdrawETH(address token, uint256 amount) external onlyOwner {
        uint256 balance = _getBalance(token);
        uint256 available = balance - lockedAmount[address(0)];

        require(amount <= available, "Insufficient unlocked balance");

        (bool success, ) = payable(owner()).call{value: amount}("");

        require(success, "ETH transfer failed");
    }

    function withdrawToken(address token, uint256 amount) external onlyOwner {
        uint256 balance = _getBalance(token);

        uint256 available = balance - lockedAmount[token];

        require(amount <= available, "Insufficient unlocked balance");

        IERC20(token).safeTransfer(owner(), amount);
    }

    function lockAsset(address asset, uint256 amount) external onlyArvo {
        uint256 balance = _getBalance(asset);

        require(
            balance >= lockedAmount[asset] + amount,
            "Insufficient balance"
        );

        lockedAmount[asset] += amount;
    }

    function unlockAsset(address asset, uint256 amount) external onlyArvo {
        require(lockedAmount[asset] >= amount, "Invalid unlock");

        lockedAmount[asset] -= amount;
    }

    // function execute(
    //     TradeExecution calldata trade
    // ) external onlyExecutor returns (bytes memory result) {

    //     require(
    //     allowedTargets[trade.target],
    //     "Target not allowed"
    //     );

    //     uint256 balance = _getBalance(trade.inputToken);
    //     uint256 available = balance - lockedAmount[trade.inputToken];

    //     require(
    //         trade.inputAmount <= available,
    //         "Insufficient unlocked balance"
    //     );

    //     (bool success, bytes memory returnData) = trade.target.call{
    //         value: trade.value
    //     }(trade.data);

    //     if (!success) {
    //         revert ExecutionFailed();
    //     }

    //     return returnData;
    // }

    function approveToken(
        address token,
        address spender,
        uint256 amount
    ) external onlyExecutor {
        IERC20(token).forceApprove(spender, amount);
    }
}
