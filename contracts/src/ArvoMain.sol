// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {
    SafeERC20
} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

using SafeERC20 for IERC20;

uint256 constant MAX_ALLOWED_RISK_SCORE = 70; // 70 percent is the maximum risk score allowed for a trade to be approved

enum TradeIntentStatus {
    PENDING,
    APPROVED,
    REJECTED,
}

struct TradeIntent {
    string id;

    address userAddress;
    address agentAddress;
    address vaultAddress;
    uint32 chainId;

    uint256 tokenIn;
    uint256 tokenOut;
    uint256 amountIn;
    uint256 minAmountOut;

    uint256 deadline; // by the date and time which the trade must be executed
    uint256 maxPremium; // max premium the user is willing to pay for the coverage
    uint32 maxCoverage; // max coverage the user is willing to take for the trade, in percentage (0-100)
    uint256 requestedCoverageDuration; // the duration for which the user is requesting coverage, in seconds

    bytes signature; // signature of the trade intent, signed by the agent's private key
    TradeIntentStatus status;
    uint256 createdAt;
}

struct RiskAssessment {
    string id;

    string intentId;

    uint256 riskScore; // the risk score of the trade, in percentage (0-100)
    uint256 premium; // the premium that needs to be paid for the coverage, in wei
    uint256 coverageAmount; // the amount of coverage that can be issued for the trade, in percentage (0-100)
    uint256 coverageDuration; // duration for which the issued coverage can be valid, in seconds

    bytes signature; // signature of the risk assessment, signed by the risk engine's private key
    uint256 assessedAt;
    uint256 expiresAt;

    string assessmentHash;

    uint256 createdAt;
}

struct TradeConfirmation {
    string id;

    string intentId;

    string transactionHash; // hash of the transaction
    uint32 chainId;

    address tokenIn; // address of the token being sold
    address tokenOut; // address of the token being bought

    uint256 amountIn; // amount of tokenIn being sold
    uint256 amountOut; // amount of tokenOut being bought

    bytes signature; // signature of the trade confirmation, signed by the executor's private key
    uint256 executedAt; // timestamp when the trade was executed

    uint256 createdAt;
}

struct Insurance {
    string id;

    string tradeIntentId;
    string riskAssesmentId;
    string tradeConfirmationId;

    uint256 premium; // the premium that was paid for the coverage, in wei
    uint256 coverageAmount; // the amount of coverage that was issued for the trade, in percentage (0-100)
    uint256 coverageDuration; // the duration for which the coverage is valid, in seconds

    bool valid; // whether the insurance is valid or not

    uint256 createdAt;
}

struct Position {
    string id;

    string insuranceId;

    address vaultAddress; // the address of the vault that holds the position
    address tokenAddress; // the address of the token that is being held in the position
    uint256 amount; // the amount of the token that is being held in the position

    bool isActive; // whether the position is active or not

    uint256 createdAt;
}

contract ArvoMain is Ownable, AccessControl {
    // tradeintent id to TradeIntent mapping
    mapping(string => TradeIntent) public tradeIntents;
    // tradeintent id to RiskAssessment mapping
    mapping(string => RiskAssessment) public riskAssessments;
    // tradeintent id to TradeConfirmation mapping
    mapping(string => TradeConfirmation) public tradeConfirmations;
    // insurance id to Insurance mapping
    mapping(string => Insurance) public insurances;
    // tradeintent id to insurance id mapping
    mapping(string => string) public tradeIntentToInsurance;
    // insurance id to Position mapping
    mapping(string => Position) public insuranceToPosition;

    constructor() Ownable(msg.sender) {}

    // checks if a trade intent is evaluatable, i.e. it has it corresponding risk assessment and trade confirmation
    function _isTradeIntentEvaluatable(string memory intentId) internal view returns (bool) {
        TradeIntent memory intent = tradeIntents[intentId];
        RiskAssessment memory assessment = riskAssessments[intentId];
        TradeConfirmation memory confirmation = tradeConfirmations[intentId];

        return (
            intent.createdAt > 0 &&
            assessment.createdAt > 0 &&
            confirmation.createdAt > 0
        );
    }

    // evaluate a trade intent if it is evaluateable, i.e. it has it corresponding risk assessment and trade confirmation
    function evaluateTradeIntent(string memory intentId) public {
        require(
            _isTradeIntentEvaluatable(intentId),
            "Trade intent is not evaluatable!"
        );

        RiskAssessment memory assessment = riskAssessments[intentId];
        TradeIntent memory intent = tradeIntents[intentId];

        // check if the risk assessment is still valid
        require(
            block.timestamp <= assessment.expiresAt,
            "Risk assessment has expired!"
        );

        // check if the premium is within the max premium specified in the trade intent
        require(
            assessment.premium <= intent.maxPremium,
            "Premium exceeds max premium specified in trade intent!"
        );

        // check if the coverage percentage is greater than or equal to the max coverage specified in the trade intent
        require(
            assessment.coverageAmount >= intent.maxCoverage,
            "Coverage amount is less than max coverage specified in trade intent!"
        );

        // check if the risk score is within the allowed range
        require(
            assessment.riskScore <= MAX_ALLOWED_RISK_SCORE,
            "Risk score exceeds max allowed risk score!"
        );

        // if all checks pass, the trade intent is evaluated successfully
        tradeIntents[intentId].status = TradeIntentStatus.APPROVED;

        // issue insurance for the trade intent
        Insurance memory insurance = Insurance({
            id: string(abi.encodePacked("INSURANCE-", intentId)),
            tradeIntentId: intentId,
            riskAssesmentId: assessment.id,
            tradeConfirmationId: tradeConfirmations[intentId].id,
            premium: assessment.premium,
            coverageAmount: assessment.coverageAmount,
            coverageDuration: assessment.coverageDuration,
            valid: true,
            createdAt: block.timestamp
        });

        insurances[insurance.id] = insurance;
        tradeIntentToInsurance[intentId] = insurance.id;

        // create a position for the insurance
        Position memory position = Position({
            id: string(abi.encodePacked("POSITION-", insurance.id)),
            insuranceId: insurance.id,
            vaultAddress: intent.vaultAddress,
            tokenAddress: intent.tokenIn,
            amount: intent.amountIn,
            isActive: true,
            createdAt: block.timestamp
        });

        insuranceToPosition[insurance.id] = position;

        // TODO: Lock the asset on the vault contract - pass - ok / fail - invalidate the insurance and position
    }

    // submit a trade intent - can be submitted by the owner only
    function submitTradeIntent(TradeIntent memory intent) public onlyOwner {
        tradeIntents[intent.id] = intent;
    }

    // submit a risk assesment - can be submitted by the risk engine only
    function submitRiskAssessment(RiskAssessment memory assessment) public {
        riskAssessments[assessment.id] = assessment;

        string tradeIntentId = assessment.intentId;

        // check if the trade intent is evaluable
        if (_isTradeIntentEvaluatable(tradeIntentId)) {
            evaluateTradeIntent(tradeIntentId);
        }
    }

    // submit a trade confirmation - can be submitted by the executor only
    function submitTradeConfirmation(TradeConfirmation memory confirmation) public {
        tradeConfirmations[confirmation.id] = confirmation;

        string tradeIntentId = confirmation.intentId;

        // check if the trade intent is evaluable
        if (_isTradeIntentEvaluatable(tradeIntentId)) {
            evaluateTradeIntent(tradeIntentId);
        }
    }

    // invalidate a insurance - can be called by the owner or the user who own the userAddress in the trade intent
    function invalidateInsurance(string memory insuranceId) public {
        Insurance memory insurance = insurances[insuranceId];
        TradeIntent memory intent = tradeIntents[insurance.tradeIntentId];

        require(
            msg.sender == owner() || msg.sender == intent.userAddress,
            "Caller is not authorized to invalidate the insurance!"
        );

        // invalidate the insurance
        insurances[insuranceId].valid = false;

        // deactivate the position
        insuranceToPosition[insuranceId].isActive = false;

        // TODO: Unlock the asset on the vault contract - pass - ok / fail - revert the insurance and position to valid and active respectively
    }

    // all the getters for the mappings
    // get the trade intent by id
    function getTradeIntent(string memory intentId) public view returns (TradeIntent memory) {
        return tradeIntents[intentId];
    }

    // get the risk assessment by id
    function getRiskAssessment(string memory assessmentId) public view returns (RiskAssessment memory) {
        return riskAssessments[assessmentId];
    }

    // get the trade confirmation by id
    function getTradeConfirmation(string memory confirmationId) public view returns (TradeConfirmation memory) {
        return tradeConfirmations[confirmationId];
    }

    // get the insurance by id
    function getInsurance(string memory insuranceId) public view returns (Insurance memory) {
        return insurances[insuranceId];
    }

    // get the position by id
    function getPosition(string memory positionId) public view returns (Position memory) {
        return insuranceToPosition[positionId];
    }

    // get the insurance by trade intent id
    function getInsuranceByTradeIntentId(string memory intentId) public view returns (Insurance memory) {
        string memory insuranceId = tradeIntentToInsurance[intentId];
        return insurances[insuranceId];
    }
}
