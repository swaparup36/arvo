// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

using SafeERC20 for IERC20;

uint256 constant MAX_ALLOWED_RISK_SCORE = 70; // 70 percent is the maximum risk score allowed for a trade to be approved

// All structs and enums
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

    address tokenIn;
    address tokenOut;
    uint256 amountIn;
    uint256 minAmountOut;

    uint256 deadline; // by the date and time which the trade must be executed
    uint256 maxPremium; // max premium the user is willing to pay for the coverage
    uint32 minCoverage; // minimum coverage the user requires, percentage (0-100)
    uint256 minCoverageDuration; // the duration for which the user is requesting coverage, in seconds

    bytes signature; // signature of the trade intent, signed by the agent's private key
    TradeIntentStatus status;
    uint256 createdAt;
}

struct RiskAssessment {
    string id;

    string intentId;

    uint256 riskScore; // the risk score of the trade, in percentage (0-100)
    uint256 premium; // the premium that needs to be paid for the coverage, in wei
    uint256 coverage; // the amount of coverage that can be issued for the trade, in percentage (0-100)
    uint256 coverageDuration; // duration for which the issued coverage can be valid, in seconds

    bytes signature; // signature of the risk assessment, signed by the risk engine's private key
    uint256 assessedAt;
    uint256 expiresAt;

    string assessmentHash;
}

struct TradeConfirmation {
    string id;

    string intentId;

    string transactionHash; // hash of the transaction

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
    string riskAssessmentId;
    string tradeConfirmationId;

    uint256 premium; // the premium that was paid for the coverage, in wei
    uint256 coverage; // the amount of coverage that was issued for the trade, in percentage (0-100)
    uint256 coverageDuration; // the duration for which the coverage is valid, in seconds

    bool valid; // whether the insurance is valid or not

    uint256 createdAt;
}

struct Position {
    string id;

    string insuranceId;

    address vaultAddress; // the address of the vault that holds the position
    address tokenOutAddress; // the address of the token that is being held in the position
    address tokenInAddress; // the address of the token that is spent to open the position
    uint256 amountOut; // the amount of the token that is being held in the position
    uint256 amountIn; // the amount of the token that is spent to open the position

    bool isActive; // whether the position is active or not

    uint256 createdAt;
}

// events
event SubmitTradeIntent(string id, address indexed userAddress, address indexed agentAddress, address indexed vaultAddress);
event SubmitRiskAssessment(string id, string indexed intentId, uint256 riskScore, uint256 premium, uint256 coverage, uint256 coverageDuration);
event SubmitTradeConfirmation(string id, string indexed intentId, string indexed transactionHash,  address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut);
event InsuranceIssued(string indexed insuranceId, string indexed tradeIntentId, string indexed riskAssessmentId, string tradeConfirmationId, uint256 premium, uint256 coverage, uint256 coverageDuration);
event PositionCreated(string indexed positionId, string indexed insuranceId, address indexed vaultAddress, address tokenInAddress, uint256 amountIn, address tokenOutAddress, uint256 amountOut);
event InsuranceInvalidated(string indexed insuranceId, string indexed tradeIntentId, string indexed riskAssessmentId, string tradeConfirmationId);
event PositionDeactivated(string indexed positionId, string indexed insuranceId, address indexed vaultAddress, address tokenInAddress, uint256 amountIn);
event TradeIntentRejected(string indexed intentId, string reason);

contract ArvoMain is Ownable, EIP712 {
    // tradeintent id to TradeIntent mapping
    mapping(string => TradeIntent) public tradeIntents;
    // tradeintent id to exists mapping
    mapping(string => bool) public tradeIntentExists;
    // tradeintent id to RiskAssessment mapping
    mapping(string => RiskAssessment) public riskAssessments;
    // tradeintent id to exists mapping
    mapping(string => bool) public riskAssessmentExists;
    // tradeintent id to TradeConfirmation mapping
    mapping(string => TradeConfirmation) public tradeConfirmations;
    // tradeintent id to exists mapping
    mapping(string => bool) public tradeConfirmationExists;
    // insurance id to Insurance mapping
    mapping(string => Insurance) public insurances;
    // insurances id to exists mapping
    mapping(string => bool) public insuranceExists;
    // tradeintent id to insurance id mapping
    mapping(string => string) public tradeIntentToInsurance;
    // insurance id to Position mapping
    mapping(string => Position) public insuranceToPosition;

    address public premiumTokenAddress; // address of the token that is used to pay the premium
    address riskEngineAddress; // address of the risk engine
    address executorAddress; // address of the executor

    bytes32 private constant TRADE_INTENT_TYPEHASH = keccak256(
        "TradeIntent(string id,address userAddress,address agentAddress,address vaultAddress,address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,uint256 deadline,uint256 maxPremium,uint32 minCoverage,uint256 minCoverageDuration)"
    );

    bytes32 private constant RISK_ASSESSMENT_TYPEHASH = keccak256(
        "RiskAssessment(string id,string intentId,uint256 riskScore,uint256 premium,uint256 coverage,uint256 coverageDuration,uint256 assessedAt,uint256 expiresAt,string assessmentHash)"
    );

    bytes32 private constant TRADE_CONFIRMATION_TYPEHASH = keccak256(
        "TradeConfirmation(string id,string intentId,string transactionHash,address tokenIn,address tokenOut,uint256 amountIn,uint256 amountOut,uint256 executedAt)"
    );

    constructor(address _premiumTokenAddress, address _riskEngineAddress, address _executorAddress) Ownable(msg.sender) EIP712("ArvoMain", "1") {
        premiumTokenAddress = _premiumTokenAddress;
        riskEngineAddress = _riskEngineAddress;
        executorAddress = _executorAddress;
    }

    // verify the signature of the trade intent
    function _verifyTradeIntent(TradeIntent memory intent) internal view returns (bool) {
        bytes32 structHash = keccak256(
            abi.encode(
                TRADE_INTENT_TYPEHASH,
                keccak256(bytes(intent.id)),
                intent.userAddress,
                intent.agentAddress,
                intent.vaultAddress,
                intent.tokenIn,
                intent.tokenOut,
                intent.amountIn,
                intent.minAmountOut,
                intent.deadline,
                intent.maxPremium,
                intent.minCoverage,
                intent.minCoverageDuration
            )
        );

        bytes32 digest = _hashTypedDataV4(structHash);

        address signer = ECDSA.recover(digest, intent.signature);

        return signer == intent.agentAddress;
    }

    // verify the signature of the risk assessment
    function _verifyRiskAssessment(RiskAssessment memory assessment) internal view returns (bool) {
        bytes32 structHash = keccak256(
            abi.encode(
                RISK_ASSESSMENT_TYPEHASH,
                keccak256(bytes(assessment.id)),
                keccak256(bytes(assessment.intentId)),
                assessment.riskScore,
                assessment.premium,
                assessment.coverage,
                assessment.coverageDuration,
                assessment.assessedAt,
                assessment.expiresAt,
                keccak256(bytes(assessment.assessmentHash))
            )
        );

        bytes32 digest = _hashTypedDataV4(structHash);

        address signer = ECDSA.recover(digest, assessment.signature);

        return signer == riskEngineAddress;
    }

    // verify the signature of the trade confirmation
    function _verifyTradeConfirmation(TradeConfirmation memory confirmation) internal view returns (bool) {
        bytes32 structHash = keccak256(
            abi.encode(
                TRADE_CONFIRMATION_TYPEHASH,
                keccak256(bytes(confirmation.id)),
                keccak256(bytes(confirmation.intentId)),
                keccak256(bytes(confirmation.transactionHash)),
                confirmation.tokenIn,
                confirmation.tokenOut,
                confirmation.amountIn,
                confirmation.amountOut,
                confirmation.executedAt
            )
        );

        bytes32 digest = _hashTypedDataV4(structHash);

        address signer = ECDSA.recover(
            digest,
            confirmation.signature
        );

        return signer == executorAddress;
    }

    // checks if a trade intent is evaluatable, i.e. it has it corresponding risk assessment and trade confirmation
    function _isTradeIntentEvaluatable(string memory intentId) internal view returns (bool) {
        return (
            tradeIntentExists[intentId] &&
            riskAssessmentExists[intentId] &&
            tradeConfirmationExists[intentId]
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
        TradeConfirmation memory confirmation = tradeConfirmations[intentId];

        // check if already a insurance has been issued for this trade intent
        require(
            tradeIntentToInsurance[intentId].length == 0,
            "Insurance already issued for this trade intent!"
        );

        // check the status of the trade intent
        require(
            intent.status == TradeIntentStatus.PENDING,
            "Trade intent is not in pending status!"
        );

        if (block.timestamp > assessment.expiresAt) {
            tradeIntents[intentId].status = TradeIntentStatus.REJECTED;
            emit TradeIntentRejected(intentId, "Risk assessment has expired");
            return;
        }

        if (assessment.coverageDuration == 0) {
            tradeIntents[intentId].status = TradeIntentStatus.REJECTED;
            emit TradeIntentRejected(intentId, "Coverage duration is zero");
            return;
        }

        if (assessment.premium > intent.maxPremium) {
            tradeIntents[intentId].status = TradeIntentStatus.REJECTED;
            emit TradeIntentRejected(intentId, "Premium exceeds maximum");
            return;
        }

        if (assessment.coverage < intent.minCoverage) {
            tradeIntents[intentId].status = TradeIntentStatus.REJECTED;
            emit TradeIntentRejected(intentId, "Coverage is below minimum");
            return;
        }

        if (assessment.coverageDuration < intent.minCoverageDuration) {
            tradeIntents[intentId].status = TradeIntentStatus.REJECTED;
            emit TradeIntentRejected(intentId, "Coverage duration is below minimum");
            return;
        }

        if (assessment.riskScore > MAX_ALLOWED_RISK_SCORE) {
            tradeIntents[intentId].status = TradeIntentStatus.REJECTED;
            emit TradeIntentRejected(intentId, "Risk score is too high");
            return;
        }

        // issue insurance for the trade intent
        Insurance memory insurance = Insurance({
            id: string(abi.encodePacked("INSURANCE-", intentId)),
            tradeIntentId: intentId,
            riskAssessmentId: assessment.id,
            tradeConfirmationId: tradeConfirmations[intentId].id,
            premium: assessment.premium,
            coverage: assessment.coverage,
            coverageDuration: assessment.coverageDuration,
            valid: true,
            createdAt: block.timestamp
        });

        insurances[insurance.id] = insurance;
        tradeIntentToInsurance[intentId] = insurance.id;
        insuranceExists[insurance.id] = true;

        // create a position for the insurance
        Position memory position = Position({
            id: string(abi.encodePacked("POSITION-", insurance.id)),
            insuranceId: insurance.id,
            vaultAddress: intent.vaultAddress,
            tokenInAddress: confirmation.tokenIn,
            tokenOutAddress: confirmation.tokenOut,
            amountIn: confirmation.amountIn,
            amountOut: confirmation.amountOut,
            isActive: true,
            createdAt: block.timestamp
        });

        insuranceToPosition[insurance.id] = position;

        // TODO: Lock the asset on the vault contract - pass - ok / fail - invalidate the insurance and position

        // TODO: Transfer the premium from the vault to this contract - pass - ok / fail - invalidate the insurance and position

        // mark trade intent as approved
        tradeIntents[intentId].status = TradeIntentStatus.APPROVED;

        emit PositionCreated(position.id, insurance.id, intent.vaultAddress, confirmation.tokenIn, confirmation.amountIn, confirmation.tokenOut, confirmation.amountOut);
        emit InsuranceIssued(insurance.id, insurance.tradeIntentId, insurance.riskAssessmentId, insurance.tradeConfirmationId, insurance.premium, insurance.coverage, insurance.coverageDuration);
    }

    // submit a trade intent - can be submitted by the owner only
    function submitTradeIntent(TradeIntent memory intent) public onlyOwner {
        // check if the trade intent already exists
        require(
            !tradeIntentExists[intent.id],
            "Trade intent already exists!"
        );

        require(intent.deadline > block.timestamp, "Invalid deadline");
        require(intent.minCoverage <= 100, "Invalid coverage");
        require(intent.minCoverageDuration > 0, "Invalid coverage duration");

        // verify the signature of the trade intent
        require(
            _verifyTradeIntent(intent),
            "Invalid trade intent signature!"
        );

        tradeIntents[intent.id] = intent;
        tradeIntentExists[intent.id] = true;
        emit SubmitTradeIntent(intent.id, intent.userAddress, intent.agentAddress, intent.vaultAddress);
    }

    // submit a risk assesment - can be submitted by the owner only
    function submitRiskAssessment(RiskAssessment memory assessment) public onlyOwner {
        // check if the trade intent exists
        require(
            tradeIntentExists[assessment.intentId],
            "Trade intent does not exists!"
        );

        // multiple risk assesment is not allowed
        require(
            !riskAssessmentExists[assessment.intentId],
            "Risk assessment already submitted for the trade intent"
        );

        require(assessment.coverage <= 100, "Invalid coverage");
        require(assessment.riskScore <= 100, "Invalid risk score");

        // if the dadeline of the trade intent has passed, the risk assesment cannot be submitted
        require(
            block.timestamp <= tradeIntents[assessment.intentId].deadline,
            "Trade intent deadline has passed!"
        );

        // verify the signature of the risk assessment against the risk engine's address
        require(
            _verifyRiskAssessment(assessment),
            "Invalid risk assessment signature!"
        );

        string tradeIntentId = assessment.intentId;
        riskAssessments[tradeIntentId] = assessment;
        riskAssessmentExists[tradeIntentId] = true;
        emit SubmitRiskAssessment(assessment.id, tradeIntentId, assessment.riskScore, assessment.premium, assessment.coverage, assessment.coverageDuration);

        // check if the trade intent is evaluable
        if (_isTradeIntentEvaluatable(tradeIntentId)) {
            evaluateTradeIntent(tradeIntentId);
        }
    }

    // submit a trade confirmation - can be submitted by the owner only
    function submitTradeConfirmation(TradeConfirmation memory confirmation) public onlyOwner {
        require(
            tradeIntentExists[confirmation.intentId],
            "Trade intent does not exist!"
        );

        // multiple trade confirmation is not allowed
        require(
            !tradeConfirmationExists[confirmation.intentId],
            "Trade confirmation already submitted for the trade intent"
        );

        TradeIntent memory intent = tradeIntents[confirmation.intentId];

        // if the dadeline of the trade intent has passed, the trade confirmation cannot be submitted
        require(
            confirmation.executedAt <= intent.deadline,
            "Trade was executed after deadline"
        );

        require(
            confirmation.executedAt <= block.timestamp,
            "Trade execution timestamp is in the future"
        );

        // validate the trade confirmation against the trade intent
        require(
            confirmation.tokenIn == intent.tokenIn &&
            confirmation.tokenOut == intent.tokenOut &&
            confirmation.amountIn == intent.amountIn &&
            confirmation.amountOut >= intent.minAmountOut,
            "Trade confirmation does not match the trade intent!"
        );

        // verify the signature of the trade confirmation against the executor's address
        require(
            _verifyTradeConfirmation(confirmation),
            "Invalid trade confirmation signature!"
        );

        string tradeIntentId = confirmation.intentId;
        tradeConfirmations[tradeIntentId] = confirmation;
        tradeConfirmationExists[tradeIntentId] = true;
        emit SubmitTradeConfirmation(confirmation.id, tradeIntentId, confirmation.transactionHash, confirmation.tokenIn, confirmation.tokenOut, confirmation.amountIn, confirmation.amountOut);


        // check if the trade intent is evaluable
        if (_isTradeIntentEvaluatable(tradeIntentId)) {
            evaluateTradeIntent(tradeIntentId);
        }
    }

    // invalidate a insurance - can be called by the owner or the user who own the userAddress in the trade intent
    function invalidateInsurance(string memory insuranceId) public {
        // check if the insurance exists
        require(
            insuranceExists[insuranceId],
            "Insurance does not exist!"
        );


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

        emit InsuranceInvalidated(insurance.id, insurance.tradeIntentId, insurance.riskAssessmentId, insurance.tradeConfirmationId);
        emit PositionDeactivated(insuranceToPosition[insuranceId].id, insurance.id, intent.vaultAddress, insuranceToPosition[insuranceId].tokenInAddress, insuranceToPosition[insuranceId].amountIn);
    }

    // claim insurance - owner calls it after off-chain verification that the claim is legit
    function claimInsurance(string memory insuranceId) public onlyOwner {
        // check if the insurance exists
        require(
            insuranceExists[insuranceId],
            "Insurance does not exist!"
        );

        Insurance memory insurance = insurances[insuranceId];
        TradeIntent memory intent = tradeIntents[insurance.tradeIntentId];
        TradeConfirmation memory confirmation = tradeConfirmations[insurance.tradeIntentId];

        // check if the insurance is still valid
        require(
            insurance.valid,
            "Insurance is not valid!"
        );

        require(
            block.timestamp <= confirmation.executedAt + insurance.coverageDuration,
            "Insurance coverage duration has expired!"
        );

        // calculate coverage amount in tokenIn based on the coverage percentage and the amountIn from the trade confirmation
        address tokenIn = confirmation.tokenIn;
        uint256 amountIn = confirmation.amountIn;
        uint256 coverageAmount =  amountIn * insurance.coverage / 100;

        // transfer the coverage amount to the user
        IERC20 token = IERC20(tokenIn);
        token.safeTransfer(intent.vaultAddress, coverageAmount);

        // invalidate the insurance and deactivate the position
        insurances[insuranceId].valid = false;
        insuranceToPosition[insuranceId].isActive = false;
        

        emit InsuranceInvalidated(insurance.id, insurance.tradeIntentId, insurance.riskAssessmentId, insurance.tradeConfirmationId);
        emit PositionDeactivated(insuranceToPosition[insuranceId].id, insurance.id, intent.vaultAddress, insuranceToPosition[insuranceId].tokenInAddress, insuranceToPosition[insuranceId].amountIn);
    }

    // all the getters for the mappings
    // get the trade intent by id
    function getTradeIntent(string memory intentId) public view returns (TradeIntent memory) {
        return tradeIntents[intentId];
    }

    // get the risk assessment by intent id
    function getRiskAssessment(string memory intentId) public view returns (RiskAssessment memory) {
        return riskAssessments[intentId];
    }

    // get the trade confirmation by intent id
    function getTradeConfirmation(string memory intentId) public view returns (TradeConfirmation memory) {
        return tradeConfirmations[intentId];
    }

    // get the insurance by id
    function getInsurance(string memory insuranceId) public view returns (Insurance memory) {
        return insurances[insuranceId];
    }

    // get the position by insurance Id
    function getPosition(string memory insuranceId) public view returns (Position memory) {
        return insuranceToPosition[insuranceId];
    }

    // get the position by trade intent Id
    function getPositionByTradeIntentId(string memory intentId) public view returns (Position memory) {
        string memory insuranceId = tradeIntentToInsurance[intentId];
        return insuranceToPosition[insuranceId];
    }

    // get the insurance by trade intent id
    function getInsuranceByTradeIntentId(string memory intentId) public view returns (Insurance memory) {
        string memory insuranceId = tradeIntentToInsurance[intentId];
        return insurances[insuranceId];
    }
}
