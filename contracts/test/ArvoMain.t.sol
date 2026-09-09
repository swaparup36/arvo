// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";

import {Vault} from "../src/Vault.sol";
import {VaultFactory} from "../src/VaultFactory.sol";
import {IVault} from "../src/interfaces/IVault.sol";
import {VaultErrors} from "../src/libraries/VaultErrors.sol";
import {VaultFactoryErrors} from "../src/libraries/VaultFactoryErrors.sol";

import {
    ArvoMain,
    TradeIntent,
    RiskAssessment,
    TradeConfirmation,
    Insurance,
    Position,
    TradeIntentStatus,
    MAX_ALLOWED_RISK_SCORE,
    SubmitTradeIntent,
    SubmitRiskAssessment,
    SubmitTradeConfirmation,
    InsuranceIssued,
    PositionCreated,
    InsuranceInvalidated,
    PositionDeactivated,
    TradeIntentRejected
} from "../src/ArvoMain.sol";

/// @dev Minimal ERC20 with configurable decimals so the suite can use realistic
///      6-decimal premium tokens next to 18-decimal trade tokens.
contract MockERC20 is ERC20 {
    uint8 private immutable _decimals;

    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
        _decimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }
}

contract ArvoMainTest is Test {
    // Typehashes for EIP-712 signing
    bytes32 internal constant EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

    bytes32 internal constant TRADE_INTENT_TYPEHASH = keccak256(
        "TradeIntent(string id,address userAddress,address agentAddress,address vaultAddress,address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,uint256 deadline,uint256 maxPremium,uint32 minCoverage,uint256 minCoverageDuration)"
    );

    bytes32 internal constant RISK_ASSESSMENT_TYPEHASH = keccak256(
        "RiskAssessment(string id,string intentId,uint256 riskScore,uint256 premium,uint256 coverage,uint256 coverageDuration,uint256 assessedAt,uint256 expiresAt,string assessmentHash)"
    );

    bytes32 internal constant TRADE_CONFIRMATION_TYPEHASH = keccak256(
        "TradeConfirmation(string id,string intentId,string transactionHash,address tokenIn,address tokenOut,uint256 amountIn,uint256 amountOut,uint256 executedAt)"
    );

    // Actors
    address internal owner;
    uint256 internal ownerPk;
    address internal user;
    uint256 internal userPk;
    address internal agent;
    uint256 internal agentPk;
    address internal riskEngine;
    uint256 internal riskEnginePk;
    address internal executor;
    uint256 internal executorPk;
    address internal attacker;
    uint256 internal attackerPk;
    address internal dummyUser;
    uint256 internal dummyUserPk;

    // Contracts
    ArvoMain internal arvoMain;
    VaultFactory internal factory;
    Vault internal vault;
    address internal vaultAddress;

    MockERC20 internal tokenIn;
    MockERC20 internal tokenOut;
    MockERC20 internal usdc; // premium token, 6 decimals

    
    // Scenario constants
    uint256 internal constant AMOUNT_IN = 1_000e18;
    uint256 internal constant MIN_AMOUNT_OUT = 900e18;
    uint256 internal constant AMOUNT_OUT = 950e18;

    uint256 internal constant MAX_PREMIUM = 100e6;
    uint256 internal constant PREMIUM = 50e6;

    uint32 internal constant MIN_COVERAGE = 50;
    uint256 internal constant COVERAGE = 80;

    uint256 internal constant MIN_COVERAGE_DURATION = 1 days;
    uint256 internal constant COVERAGE_DURATION = 7 days;

    uint256 internal constant RISK_SCORE = 40;

    uint256 internal constant INTENT_TTL = 1 days;
    uint256 internal constant ASSESSMENT_TTL = 1 hours;

    uint256 internal constant VAULT_TOKEN_OUT = 10_000e18;
    uint256 internal constant VAULT_USDC = 10_000e6;
    uint256 internal constant ARVO_TOKEN_IN = 1_000_000e18;

    string internal constant INTENT_ID = "INTENT-1";

    // Setup
    function setUp() public {
        // Sane wall-clock so that "deadline in the past" tests can subtract safely
        vm.warp(1_700_000_000);

        (owner, ownerPk) = makeAddrAndKey("owner");
        (user, userPk) = makeAddrAndKey("user");
        (agent, agentPk) = makeAddrAndKey("agent");
        (riskEngine, riskEnginePk) = makeAddrAndKey("riskEngine");
        (executor, executorPk) = makeAddrAndKey("executor");
        (attacker, attackerPk) = makeAddrAndKey("attacker");
        (dummyUser, dummyUserPk) = makeAddrAndKey("dummyUser");

        tokenIn = new MockERC20("Token In", "TIN", 18);
        tokenOut = new MockERC20("Token Out", "TOUT", 18);
        usdc = new MockERC20("USD Coin", "USDC", 6);

        // ArvoMain is owned by owner
        vm.prank(owner);
        arvoMain = new ArvoMain(address(usdc), riskEngine, executor);

        // The vault is created through the real factory, by the dummy user, so the vault owner is the dummy user
        factory = new VaultFactory();
        vm.prank(dummyUser);
        vaultAddress = factory.createVault("dummy-user-vault", address(arvoMain), executor);
        vault = Vault(vaultAddress);

        _fundVault(vault, dummyUser, VAULT_TOKEN_OUT, VAULT_USDC);

        // ArvoMain needs tokenIn liquidity to pay out claims.
        tokenIn.mint(address(arvoMain), ARVO_TOKEN_IN);
    }

    /// @dev Funds a vault through its real depositToken path (owner-only,
    ///      transferFrom-based) rather than by writing balances directly.
    function _fundVault(Vault v, address vaultOwner, uint256 tokenOutAmount, uint256 usdcAmount) internal {
        if (tokenOutAmount > 0) {
            tokenOut.mint(vaultOwner, tokenOutAmount);
        }
        if (usdcAmount > 0) {
            usdc.mint(vaultOwner, usdcAmount);
        }
        vm.startPrank(vaultOwner);
        if (tokenOutAmount > 0) {
            tokenOut.approve(address(v), tokenOutAmount);
            v.depositToken(address(tokenOut), tokenOutAmount);
        }
        if (usdcAmount > 0) {
            usdc.approve(address(v), usdcAmount);
            v.depositToken(address(usdc), usdcAmount);
        }
        vm.stopPrank();
    }

    ///  EIP-712 signing helpers
    /// @dev Rebuilt independently from the production contract so the tests
    ///      actually pin down name/version/chainId/verifyingContract.
    function _domainSeparator() internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                keccak256(bytes("ArvoMain")),
                keccak256(bytes("1")),
                block.chainid,
                address(arvoMain)
            )
        );
    }

    function _sign(uint256 pk, bytes32 structHash) internal view returns (bytes memory) {
        bytes32 digest = MessageHashUtils.toTypedDataHash(_domainSeparator(), structHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _intentStructHash(TradeIntent memory intent) internal pure returns (bytes32) {
        return keccak256(
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
    }

    function _assessmentStructHash(RiskAssessment memory a) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                RISK_ASSESSMENT_TYPEHASH,
                keccak256(bytes(a.id)),
                keccak256(bytes(a.intentId)),
                a.riskScore,
                a.premium,
                a.coverage,
                a.coverageDuration,
                a.assessedAt,
                a.expiresAt,
                keccak256(bytes(a.assessmentHash))
            )
        );
    }

    function _confirmationStructHash(TradeConfirmation memory c) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                TRADE_CONFIRMATION_TYPEHASH,
                keccak256(bytes(c.id)),
                keccak256(bytes(c.intentId)),
                keccak256(bytes(c.transactionHash)),
                c.tokenIn,
                c.tokenOut,
                c.amountIn,
                c.amountOut,
                c.executedAt
            )
        );
    }

    function _signIntent(TradeIntent memory intent, uint256 pk) internal view returns (bytes memory) {
        return _sign(pk, _intentStructHash(intent));
    }

    function _signAssessment(RiskAssessment memory a, uint256 pk) internal view returns (bytes memory) {
        return _sign(pk, _assessmentStructHash(a));
    }

    function _signConfirmation(TradeConfirmation memory c, uint256 pk) internal view returns (bytes memory) {
        return _sign(pk, _confirmationStructHash(c));
    }

    // struct builders
    function _baseIntent(string memory id) internal view returns (TradeIntent memory intent) {
        intent = TradeIntent({
            id: id,
            userAddress: dummyUser,
            agentAddress: agent,
            vaultAddress: vaultAddress,
            tokenIn: address(tokenIn),
            tokenOut: address(tokenOut),
            amountIn: AMOUNT_IN,
            minAmountOut: MIN_AMOUNT_OUT,
            deadline: block.timestamp + INTENT_TTL,
            maxPremium: MAX_PREMIUM,
            minCoverage: MIN_COVERAGE,
            minCoverageDuration: MIN_COVERAGE_DURATION,
            signature: "",
            status: TradeIntentStatus.PENDING,
            createdAt: block.timestamp
        });
    }

    /// @dev Base intent already signed by the legitimate agent.
    function _signedIntent(string memory id) internal view returns (TradeIntent memory intent) {
        intent = _baseIntent(id);
        intent.signature = _signIntent(intent, agentPk);
    }

    function _baseAssessment(string memory intentId) internal view returns (RiskAssessment memory a) {
        a = RiskAssessment({
            id: string.concat("RISK-", intentId),
            intentId: intentId,
            riskScore: RISK_SCORE,
            premium: PREMIUM,
            coverage: COVERAGE,
            coverageDuration: COVERAGE_DURATION,
            signature: "",
            assessedAt: block.timestamp,
            expiresAt: block.timestamp + ASSESSMENT_TTL,
            assessmentHash: "0xassessmenthash"
        });
    }

    function _signedAssessment(string memory intentId) internal view returns (RiskAssessment memory a) {
        a = _baseAssessment(intentId);
        a.signature = _signAssessment(a, riskEnginePk);
    }

    function _baseConfirmation(string memory intentId) internal view returns (TradeConfirmation memory c) {
        c = TradeConfirmation({
            id: string.concat("CONFIRM-", intentId),
            intentId: intentId,
            transactionHash: "0xtransactionhash",
            tokenIn: address(tokenIn),
            tokenOut: address(tokenOut),
            amountIn: AMOUNT_IN,
            amountOut: AMOUNT_OUT,
            signature: "",
            executedAt: block.timestamp,
            createdAt: block.timestamp
        });
    }

    function _signedConfirmation(string memory intentId) internal view returns (TradeConfirmation memory c) {
        c = _baseConfirmation(intentId);
        c.signature = _signConfirmation(c, executorPk);
    }

    // deep copies (memory structs assign by reference in Solidity)
    function _copy(TradeIntent memory x) internal pure returns (TradeIntent memory) {
        return TradeIntent({
            id: x.id,
            userAddress: x.userAddress,
            agentAddress: x.agentAddress,
            vaultAddress: x.vaultAddress,
            tokenIn: x.tokenIn,
            tokenOut: x.tokenOut,
            amountIn: x.amountIn,
            minAmountOut: x.minAmountOut,
            deadline: x.deadline,
            maxPremium: x.maxPremium,
            minCoverage: x.minCoverage,
            minCoverageDuration: x.minCoverageDuration,
            signature: x.signature,
            status: x.status,
            createdAt: x.createdAt
        });
    }

    function _copy(RiskAssessment memory x) internal pure returns (RiskAssessment memory) {
        return RiskAssessment({
            id: x.id,
            intentId: x.intentId,
            riskScore: x.riskScore,
            premium: x.premium,
            coverage: x.coverage,
            coverageDuration: x.coverageDuration,
            signature: x.signature,
            assessedAt: x.assessedAt,
            expiresAt: x.expiresAt,
            assessmentHash: x.assessmentHash
        });
    }

    function _copy(TradeConfirmation memory x) internal pure returns (TradeConfirmation memory) {
        return TradeConfirmation({
            id: x.id,
            intentId: x.intentId,
            transactionHash: x.transactionHash,
            tokenIn: x.tokenIn,
            tokenOut: x.tokenOut,
            amountIn: x.amountIn,
            amountOut: x.amountOut,
            signature: x.signature,
            executedAt: x.executedAt,
            createdAt: x.createdAt
        });
    }

    // Flow helpers
    function _submitIntent(string memory id) internal returns (TradeIntent memory intent) {
        intent = _signedIntent(id);
        vm.prank(owner);
        arvoMain.submitTradeIntent(intent);
    }

    function _submitAssessment(string memory intentId) internal returns (RiskAssessment memory a) {
        a = _signedAssessment(intentId);
        vm.prank(owner);
        arvoMain.submitRiskAssessment(a);
    }

    function _submitConfirmation(string memory intentId) internal returns (TradeConfirmation memory c) {
        c = _signedConfirmation(intentId);
        vm.prank(owner);
        arvoMain.submitTradeConfirmation(c);
    }

    /// @dev Runs the happy path (intent -> assessment -> confirmation) and returns the insurance id.
    function _issueInsurance(string memory intentId) internal returns (string memory insuranceId) {
        _submitIntent(intentId);
        _submitAssessment(intentId);
        _submitConfirmation(intentId);
        insuranceId = string.concat("INSURANCE-", intentId);
    }

    function _insuranceId(string memory intentId) internal pure returns (string memory) {
        return string.concat("INSURANCE-", intentId);
    }

    function _positionId(string memory intentId) internal pure returns (string memory) {
        return string.concat("POSITION-INSURANCE-", intentId);
    }

    // development wiring
    function test_Deployment_Wiring() public view {
        assertEq(arvoMain.owner(), owner, "arvoMain owner");
        assertEq(arvoMain.premiumTokenAddress(), address(usdc), "premium token");

        assertEq(factory.getVault(dummyUser), vaultAddress, "factory registry");
        assertEq(vault.owner(), dummyUser, "vault owner is the dummy user");
        assertTrue(vault.hasRole(vault.ARVO_ROLE(), address(arvoMain)), "arvoMain has ARVO_ROLE");
        assertTrue(vault.hasRole(vault.EXECUTOR_ROLE(), executor), "executor has EXECUTOR_ROLE");
        assertFalse(vault.hasRole(vault.ARVO_ROLE(), attacker), "attacker has no ARVO_ROLE");

        // Reached through the production interface, as ArvoMain does.
        assertEq(IVault(vaultAddress).availableBalance(address(tokenOut)), VAULT_TOKEN_OUT, "IVault availableBalance");
        assertEq(IVault(vaultAddress).availableBalance(address(usdc)), VAULT_USDC, "IVault premium balance");

        assertEq(tokenOut.balanceOf(vaultAddress), VAULT_TOKEN_OUT, "vault tokenOut");
        assertEq(usdc.balanceOf(vaultAddress), VAULT_USDC, "vault usdc");
        assertEq(vault.lockedAmount(address(tokenOut)), 0, "nothing locked yet");
        assertEq(tokenIn.balanceOf(address(arvoMain)), ARVO_TOKEN_IN, "arvoMain tokenIn float");
    }

    function test_Deployment_FactoryAllowsOnlyOneVaultPerUser() public {
        vm.prank(dummyUser);
        vm.expectRevert(
            abi.encodeWithSelector(VaultFactoryErrors.VaultAlreadyExistForThisUser.selector, vaultAddress)
        );
        factory.createVault("second-vault", address(arvoMain), executor);
    }

    // Trade intent
    function test_SubmitTradeIntent_Success() public {
        TradeIntent memory intent = _signedIntent(INTENT_ID);

        vm.expectEmit(true, true, true, true, address(arvoMain));
        emit SubmitTradeIntent(INTENT_ID, dummyUser, agent, vaultAddress);

        vm.prank(owner);
        arvoMain.submitTradeIntent(intent);

        assertTrue(arvoMain.tradeIntentExists(INTENT_ID), "intent exists flag");

        TradeIntent memory stored = arvoMain.getTradeIntent(INTENT_ID);
        assertEq(stored.id, INTENT_ID);
        assertEq(stored.userAddress, dummyUser);
        assertEq(stored.agentAddress, agent);
        assertEq(stored.vaultAddress, vaultAddress);
        assertEq(stored.tokenIn, address(tokenIn));
        assertEq(stored.tokenOut, address(tokenOut));
        assertEq(stored.amountIn, AMOUNT_IN);
        assertEq(stored.minAmountOut, MIN_AMOUNT_OUT);
        assertEq(stored.deadline, intent.deadline);
        assertEq(stored.maxPremium, MAX_PREMIUM);
        assertEq(uint256(stored.minCoverage), uint256(MIN_COVERAGE));
        assertEq(stored.minCoverageDuration, MIN_COVERAGE_DURATION);
        assertEq(stored.signature, intent.signature);
        assertEq(uint8(stored.status), uint8(TradeIntentStatus.PENDING), "status PENDING");

        // Nothing downstream should exist yet.
        assertFalse(arvoMain.riskAssessmentExists(INTENT_ID));
        assertFalse(arvoMain.tradeConfirmationExists(INTENT_ID));
        assertEq(arvoMain.tradeIntentToInsurance(INTENT_ID), "");
        assertEq(vault.lockedAmount(address(tokenOut)), 0);
        assertEq(usdc.balanceOf(vaultAddress), VAULT_USDC);
    }

    function test_SubmitTradeIntent_RevertWhen_DuplicateId() public {
        _submitIntent(INTENT_ID);

        TradeIntent memory duplicate = _signedIntent(INTENT_ID);
        duplicate.amountIn = AMOUNT_IN * 2; // even a different payload must not overwrite
        duplicate.signature = _signIntent(duplicate, agentPk);

        vm.prank(owner);
        vm.expectRevert("Trade intent already exists!");
        arvoMain.submitTradeIntent(duplicate);

        // Original untouched.
        assertEq(arvoMain.getTradeIntent(INTENT_ID).amountIn, AMOUNT_IN);
    }

    function test_SubmitTradeIntent_RevertWhen_DeadlineInPast() public {
        TradeIntent memory intent = _baseIntent(INTENT_ID);
        intent.deadline = block.timestamp - 1;
        intent.signature = _signIntent(intent, agentPk);

        vm.prank(owner);
        vm.expectRevert("Invalid deadline");
        arvoMain.submitTradeIntent(intent);

        assertFalse(arvoMain.tradeIntentExists(INTENT_ID));
    }

    function test_SubmitTradeIntent_RevertWhen_DeadlineIsNow() public {
        // Contract requires deadline > block.timestamp (strict).
        TradeIntent memory intent = _baseIntent(INTENT_ID);
        intent.deadline = block.timestamp;
        intent.signature = _signIntent(intent, agentPk);

        vm.prank(owner);
        vm.expectRevert("Invalid deadline");
        arvoMain.submitTradeIntent(intent);
    }

    function test_SubmitTradeIntent_RevertWhen_MinCoverageAbove100() public {
        TradeIntent memory intent = _baseIntent(INTENT_ID);
        intent.minCoverage = 101;
        intent.signature = _signIntent(intent, agentPk);

        vm.prank(owner);
        vm.expectRevert("Invalid coverage");
        arvoMain.submitTradeIntent(intent);

        assertFalse(arvoMain.tradeIntentExists(INTENT_ID));
    }

    function test_SubmitTradeIntent_MinCoverage100IsAccepted() public {
        TradeIntent memory intent = _baseIntent(INTENT_ID);
        intent.minCoverage = 100;
        intent.signature = _signIntent(intent, agentPk);

        vm.prank(owner);
        arvoMain.submitTradeIntent(intent);

        assertTrue(arvoMain.tradeIntentExists(INTENT_ID));
    }

    function test_SubmitTradeIntent_RevertWhen_MinCoverageDurationZero() public {
        TradeIntent memory intent = _baseIntent(INTENT_ID);
        intent.minCoverageDuration = 0;
        intent.signature = _signIntent(intent, agentPk);

        vm.prank(owner);
        vm.expectRevert("Invalid coverage duration");
        arvoMain.submitTradeIntent(intent);

        assertFalse(arvoMain.tradeIntentExists(INTENT_ID));
    }

    function test_SubmitTradeIntent_RevertWhen_AmountInIsZero() public {
        TradeIntent memory intent = _baseIntent(INTENT_ID);
        intent.amountIn = 0;
        intent.signature = _signIntent(intent, agentPk);

        vm.prank(owner);
        vm.expectRevert("Invalid amount in");
        arvoMain.submitTradeIntent(intent);

        assertFalse(arvoMain.tradeIntentExists(INTENT_ID));
    }

    function test_SubmitTradeIntent_RevertWhen_MinAmountOutIsZero() public {
        TradeIntent memory intent = _baseIntent(INTENT_ID);
        intent.minAmountOut = 0;
        intent.signature = _signIntent(intent, agentPk);

        vm.prank(owner);
        vm.expectRevert("Invalid minAmount");
        arvoMain.submitTradeIntent(intent);

        assertFalse(arvoMain.tradeIntentExists(INTENT_ID));
    }

    function test_SubmitTradeIntent_RevertWhen_SignatureFromWrongAgent() public {
        TradeIntent memory intent = _baseIntent(INTENT_ID);
        intent.signature = _signIntent(intent, attackerPk); // valid ECDSA, wrong signer

        vm.prank(owner);
        vm.expectRevert("Invalid trade intent signature!");
        arvoMain.submitTradeIntent(intent);

        assertFalse(arvoMain.tradeIntentExists(INTENT_ID));
    }

    function test_SubmitTradeIntent_RevertWhen_SignatureMalformed() public {
        TradeIntent memory intent = _baseIntent(INTENT_ID);
        intent.signature = hex"deadbeef"; // wrong length -> ECDSA.recover reverts

        vm.prank(owner);
        vm.expectRevert();
        arvoMain.submitTradeIntent(intent);

        assertFalse(arvoMain.tradeIntentExists(INTENT_ID));
    }

    function test_SubmitTradeIntent_RevertWhen_NotOwner() public {
        TradeIntent memory intent = _signedIntent(INTENT_ID);

        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, attacker));
        arvoMain.submitTradeIntent(intent);

        assertFalse(arvoMain.tradeIntentExists(INTENT_ID));
    }

    // Risk assessment
    function test_SubmitRiskAssessment_Success() public {
        _submitIntent(INTENT_ID);
        RiskAssessment memory a = _signedAssessment(INTENT_ID);

        vm.expectEmit(true, true, true, true, address(arvoMain));
        emit SubmitRiskAssessment(a.id, INTENT_ID, RISK_SCORE, PREMIUM, COVERAGE, COVERAGE_DURATION);

        vm.prank(owner);
        arvoMain.submitRiskAssessment(a);

        assertTrue(arvoMain.riskAssessmentExists(INTENT_ID));

        RiskAssessment memory stored = arvoMain.getRiskAssessment(INTENT_ID);
        assertEq(stored.id, a.id);
        assertEq(stored.intentId, INTENT_ID);
        assertEq(stored.riskScore, RISK_SCORE);
        assertEq(stored.premium, PREMIUM);
        assertEq(stored.coverage, COVERAGE);
        assertEq(stored.coverageDuration, COVERAGE_DURATION);
        assertEq(stored.assessedAt, a.assessedAt);
        assertEq(stored.expiresAt, a.expiresAt);
        assertEq(stored.assessmentHash, a.assessmentHash);
        assertEq(stored.signature, a.signature);

        // No confirmation yet -> no evaluation happened.
        assertEq(uint8(arvoMain.getTradeIntent(INTENT_ID).status), uint8(TradeIntentStatus.PENDING));
        assertEq(arvoMain.tradeIntentToInsurance(INTENT_ID), "");
        assertEq(vault.lockedAmount(address(tokenOut)), 0);
    }

    function test_SubmitRiskAssessment_RevertWhen_IntentDoesNotExist() public {
        RiskAssessment memory a = _signedAssessment("NO-SUCH-INTENT");

        vm.prank(owner);
        vm.expectRevert("Trade intent does not exists!");
        arvoMain.submitRiskAssessment(a);

        assertFalse(arvoMain.riskAssessmentExists("NO-SUCH-INTENT"));
    }

    function test_SubmitRiskAssessment_RevertWhen_Duplicate() public {
        _submitIntent(INTENT_ID);
        _submitAssessment(INTENT_ID);

        RiskAssessment memory second = _baseAssessment(INTENT_ID);
        second.id = "RISK-2";
        second.premium = PREMIUM + 1;
        second.signature = _signAssessment(second, riskEnginePk);

        vm.prank(owner);
        vm.expectRevert("Risk assessment already submitted for the trade intent");
        arvoMain.submitRiskAssessment(second);

        assertEq(arvoMain.getRiskAssessment(INTENT_ID).premium, PREMIUM, "first assessment preserved");
    }

    function test_SubmitRiskAssessment_RevertWhen_CoverageAbove100() public {
        _submitIntent(INTENT_ID);
        RiskAssessment memory a = _baseAssessment(INTENT_ID);
        a.coverage = 101;
        a.signature = _signAssessment(a, riskEnginePk);

        vm.prank(owner);
        vm.expectRevert("Invalid coverage");
        arvoMain.submitRiskAssessment(a);

        assertFalse(arvoMain.riskAssessmentExists(INTENT_ID));
    }

    function test_SubmitRiskAssessment_RevertWhen_RiskScoreAbove100() public {
        _submitIntent(INTENT_ID);
        RiskAssessment memory a = _baseAssessment(INTENT_ID);
        a.riskScore = 101;
        a.signature = _signAssessment(a, riskEnginePk);

        vm.prank(owner);
        vm.expectRevert("Invalid risk score");
        arvoMain.submitRiskAssessment(a);

        assertFalse(arvoMain.riskAssessmentExists(INTENT_ID));
    }

    function test_SubmitRiskAssessment_RevertWhen_AfterIntentDeadline() public {
        TradeIntent memory intent = _submitIntent(INTENT_ID);

        vm.warp(intent.deadline + 1);
        RiskAssessment memory a = _signedAssessment(INTENT_ID);

        vm.prank(owner);
        vm.expectRevert("Trade intent deadline has passed!");
        arvoMain.submitRiskAssessment(a);

        assertFalse(arvoMain.riskAssessmentExists(INTENT_ID));
    }

    function test_SubmitRiskAssessment_AcceptedExactlyAtDeadline() public {
        TradeIntent memory intent = _submitIntent(INTENT_ID);

        vm.warp(intent.deadline); // contract uses <=
        RiskAssessment memory a = _signedAssessment(INTENT_ID);

        vm.prank(owner);
        arvoMain.submitRiskAssessment(a);

        assertTrue(arvoMain.riskAssessmentExists(INTENT_ID));
    }

    function test_SubmitRiskAssessment_RevertWhen_SignerIsNotRiskEngine() public {
        _submitIntent(INTENT_ID);
        RiskAssessment memory a = _baseAssessment(INTENT_ID);
        a.signature = _signAssessment(a, agentPk); // valid ECDSA, wrong signer

        vm.prank(owner);
        vm.expectRevert("Invalid risk assessment signature!");
        arvoMain.submitRiskAssessment(a);

        assertFalse(arvoMain.riskAssessmentExists(INTENT_ID));
    }

    function test_SubmitRiskAssessment_RevertWhen_SignatureMalformed() public {
        _submitIntent(INTENT_ID);
        RiskAssessment memory a = _baseAssessment(INTENT_ID);
        a.signature = hex"1234";

        vm.prank(owner);
        vm.expectRevert();
        arvoMain.submitRiskAssessment(a);
    }

    function test_SubmitRiskAssessment_RevertWhen_NotOwner() public {
        _submitIntent(INTENT_ID);
        RiskAssessment memory a = _signedAssessment(INTENT_ID);

        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, attacker));
        arvoMain.submitRiskAssessment(a);

        assertFalse(arvoMain.riskAssessmentExists(INTENT_ID));
    }

    // Trade confirmation
    function test_SubmitTradeConfirmation_Success() public {
        _submitIntent(INTENT_ID);
        TradeConfirmation memory c = _signedConfirmation(INTENT_ID);

        vm.expectEmit(true, true, true, true, address(arvoMain));
        emit SubmitTradeConfirmation(
            c.id, INTENT_ID, c.transactionHash, address(tokenIn), address(tokenOut), AMOUNT_IN, AMOUNT_OUT
        );

        vm.prank(owner);
        arvoMain.submitTradeConfirmation(c);

        assertTrue(arvoMain.tradeConfirmationExists(INTENT_ID));

        TradeConfirmation memory stored = arvoMain.getTradeConfirmation(INTENT_ID);
        assertEq(stored.id, c.id);
        assertEq(stored.intentId, INTENT_ID);
        assertEq(stored.transactionHash, c.transactionHash);
        assertEq(stored.tokenIn, address(tokenIn));
        assertEq(stored.tokenOut, address(tokenOut));
        assertEq(stored.amountIn, AMOUNT_IN);
        assertEq(stored.amountOut, AMOUNT_OUT);
        assertEq(stored.executedAt, c.executedAt);
        assertEq(stored.signature, c.signature);

        // No assessment yet -> no evaluation.
        assertEq(uint8(arvoMain.getTradeIntent(INTENT_ID).status), uint8(TradeIntentStatus.PENDING));
        assertEq(vault.lockedAmount(address(tokenOut)), 0);
    }

    function test_SubmitTradeConfirmation_RevertWhen_IntentDoesNotExist() public {
        TradeConfirmation memory c = _signedConfirmation("NO-SUCH-INTENT");

        vm.prank(owner);
        vm.expectRevert("Trade intent does not exist!");
        arvoMain.submitTradeConfirmation(c);
    }

    function test_SubmitTradeConfirmation_RevertWhen_Duplicate() public {
        _submitIntent(INTENT_ID);
        _submitConfirmation(INTENT_ID);

        TradeConfirmation memory second = _baseConfirmation(INTENT_ID);
        second.id = "CONFIRM-2";
        second.amountOut = AMOUNT_OUT + 1;
        second.signature = _signConfirmation(second, executorPk);

        vm.prank(owner);
        vm.expectRevert("Trade confirmation already submitted for the trade intent");
        arvoMain.submitTradeConfirmation(second);

        assertEq(arvoMain.getTradeConfirmation(INTENT_ID).amountOut, AMOUNT_OUT);
    }

    function test_SubmitTradeConfirmation_RevertWhen_ExecutedAfterDeadline() public {
        TradeIntent memory intent = _submitIntent(INTENT_ID);

        vm.warp(intent.deadline + 10);
        TradeConfirmation memory c = _baseConfirmation(INTENT_ID);
        c.executedAt = intent.deadline + 1;
        c.signature = _signConfirmation(c, executorPk);

        vm.prank(owner);
        vm.expectRevert("Trade was executed after deadline");
        arvoMain.submitTradeConfirmation(c);

        assertFalse(arvoMain.tradeConfirmationExists(INTENT_ID));
    }

    function test_SubmitTradeConfirmation_AcceptedExactlyAtDeadline() public {
        TradeIntent memory intent = _submitIntent(INTENT_ID);

        vm.warp(intent.deadline);
        TradeConfirmation memory c = _baseConfirmation(INTENT_ID);
        c.executedAt = intent.deadline; // contract uses <=
        c.signature = _signConfirmation(c, executorPk);

        vm.prank(owner);
        arvoMain.submitTradeConfirmation(c);

        assertTrue(arvoMain.tradeConfirmationExists(INTENT_ID));
    }

    function test_SubmitTradeConfirmation_RevertWhen_ExecutedInTheFuture() public {
        _submitIntent(INTENT_ID);

        TradeConfirmation memory c = _baseConfirmation(INTENT_ID);
        c.executedAt = block.timestamp + 1;
        c.signature = _signConfirmation(c, executorPk);

        vm.prank(owner);
        vm.expectRevert("Trade execution timestamp is in the future");
        arvoMain.submitTradeConfirmation(c);

        assertFalse(arvoMain.tradeConfirmationExists(INTENT_ID));
    }

    function test_SubmitTradeConfirmation_RevertWhen_WrongTokenIn() public {
        _submitIntent(INTENT_ID);

        TradeConfirmation memory c = _baseConfirmation(INTENT_ID);
        c.tokenIn = address(usdc);
        c.signature = _signConfirmation(c, executorPk);

        vm.prank(owner);
        vm.expectRevert("Trade confirmation does not match the trade intent!");
        arvoMain.submitTradeConfirmation(c);
    }

    function test_SubmitTradeConfirmation_RevertWhen_WrongTokenOut() public {
        _submitIntent(INTENT_ID);

        TradeConfirmation memory c = _baseConfirmation(INTENT_ID);
        c.tokenOut = address(usdc);
        c.signature = _signConfirmation(c, executorPk);

        vm.prank(owner);
        vm.expectRevert("Trade confirmation does not match the trade intent!");
        arvoMain.submitTradeConfirmation(c);
    }

    function test_SubmitTradeConfirmation_RevertWhen_WrongAmountIn() public {
        _submitIntent(INTENT_ID);

        TradeConfirmation memory c = _baseConfirmation(INTENT_ID);
        c.amountIn = AMOUNT_IN - 1;
        c.signature = _signConfirmation(c, executorPk);

        vm.prank(owner);
        vm.expectRevert("Trade confirmation does not match the trade intent!");
        arvoMain.submitTradeConfirmation(c);
    }

    function test_SubmitTradeConfirmation_RevertWhen_AmountOutBelowMinimum() public {
        _submitIntent(INTENT_ID);

        TradeConfirmation memory c = _baseConfirmation(INTENT_ID);
        c.amountOut = MIN_AMOUNT_OUT - 1;
        c.signature = _signConfirmation(c, executorPk);

        vm.prank(owner);
        vm.expectRevert("Trade confirmation does not match the trade intent!");
        arvoMain.submitTradeConfirmation(c);
    }

    function test_SubmitTradeConfirmation_AcceptsAmountOutEqualToMinimum() public {
        _submitIntent(INTENT_ID);

        TradeConfirmation memory c = _baseConfirmation(INTENT_ID);
        c.amountOut = MIN_AMOUNT_OUT;
        c.signature = _signConfirmation(c, executorPk);

        vm.prank(owner);
        arvoMain.submitTradeConfirmation(c);

        assertEq(arvoMain.getTradeConfirmation(INTENT_ID).amountOut, MIN_AMOUNT_OUT);
    }

    function test_SubmitTradeConfirmation_RevertWhen_SignerIsNotExecutor() public {
        _submitIntent(INTENT_ID);

        TradeConfirmation memory c = _baseConfirmation(INTENT_ID);
        c.signature = _signConfirmation(c, riskEnginePk);

        vm.prank(owner);
        vm.expectRevert("Invalid trade confirmation signature!");
        arvoMain.submitTradeConfirmation(c);

        assertFalse(arvoMain.tradeConfirmationExists(INTENT_ID));
    }

    function test_SubmitTradeConfirmation_RevertWhen_SignatureMalformed() public {
        _submitIntent(INTENT_ID);

        TradeConfirmation memory c = _baseConfirmation(INTENT_ID);
        c.signature = hex"abcd";

        vm.prank(owner);
        vm.expectRevert();
        arvoMain.submitTradeConfirmation(c);
    }

    function test_SubmitTradeConfirmation_RevertWhen_NotOwner() public {
        _submitIntent(INTENT_ID);
        TradeConfirmation memory c = _signedConfirmation(INTENT_ID);

        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, attacker));
        arvoMain.submitTradeConfirmation(c);

        assertFalse(arvoMain.tradeConfirmationExists(INTENT_ID));
    }

    // Full insurance flow
    function test_FullFlow_IssuesInsuranceCreatesPositionAndMovesVaultAssets() public {
        uint256 vaultUsdcBefore = usdc.balanceOf(vaultAddress);
        uint256 arvoUsdcBefore = usdc.balanceOf(address(arvoMain));
        uint256 vaultTokenOutBefore = tokenOut.balanceOf(vaultAddress);

        // Pre-conditions: nothing exists.
        assertEq(vault.lockedAmount(address(tokenOut)), 0);
        assertFalse(arvoMain.insuranceExists(_insuranceId(INTENT_ID)));
        assertFalse(arvoMain.getPositionByTradeIntentId(INTENT_ID).isActive);

        TradeIntent memory intent = _submitIntent(INTENT_ID);
        RiskAssessment memory assessment = _submitAssessment(INTENT_ID);
        TradeConfirmation memory confirmation = _submitConfirmation(INTENT_ID);

        string memory insuranceId = _insuranceId(INTENT_ID);
        string memory positionId = _positionId(INTENT_ID);

        // TradeIntent
        assertEq(uint8(arvoMain.getTradeIntent(INTENT_ID).status), uint8(TradeIntentStatus.APPROVED));

        // Insurance
        assertTrue(arvoMain.insuranceExists(insuranceId));
        assertEq(arvoMain.tradeIntentToInsurance(INTENT_ID), insuranceId);

        Insurance memory ins = arvoMain.getInsurance(insuranceId);
        assertEq(ins.id, insuranceId);
        assertEq(ins.tradeIntentId, INTENT_ID);
        assertEq(ins.riskAssessmentId, assessment.id);
        assertEq(ins.tradeConfirmationId, confirmation.id);
        assertEq(ins.premium, PREMIUM);
        assertEq(ins.coverage, COVERAGE);
        assertEq(ins.coverageDuration, COVERAGE_DURATION);
        assertTrue(ins.valid);
        assertEq(ins.createdAt, block.timestamp);

        // getInsuranceByTradeIntentId must agree with getInsurance.
        assertEq(arvoMain.getInsuranceByTradeIntentId(INTENT_ID).id, insuranceId);

        // Position
        Position memory pos = arvoMain.getPosition(insuranceId);
        assertEq(pos.id, positionId);
        assertEq(pos.insuranceId, insuranceId);
        assertEq(pos.vaultAddress, vaultAddress);
        assertEq(pos.tokenInAddress, address(tokenIn));
        assertEq(pos.tokenOutAddress, address(tokenOut));
        assertEq(pos.amountIn, AMOUNT_IN);
        assertEq(pos.amountOut, AMOUNT_OUT);
        assertTrue(pos.isActive);
        assertEq(pos.createdAt, block.timestamp);
        assertEq(arvoMain.getPositionByTradeIntentId(INTENT_ID).id, positionId);

        // Vault
        assertEq(vault.lockedAmount(address(tokenOut)), AMOUNT_OUT, "tokenOut locked");
        assertEq(tokenOut.balanceOf(vaultAddress), vaultTokenOutBefore, "tokenOut stays in vault");
        assertEq(
            vault.availableBalance(address(tokenOut)), vaultTokenOutBefore - AMOUNT_OUT, "available reduced by lock"
        );
        assertEq(usdc.balanceOf(vaultAddress), vaultUsdcBefore - PREMIUM, "premium left the vault");
        assertEq(usdc.balanceOf(address(arvoMain)), arvoUsdcBefore + PREMIUM, "premium landed on ArvoMain");
        assertEq(vault.lockedAmount(address(usdc)), 0, "premium token is not locked");

        // Unused: the intent's own fields are the source of truth for the lock
        assertEq(intent.tokenOut, pos.tokenOutAddress);
    }

    function test_FullFlow_EmitsIssuanceAndPositionEvents() public {
        _submitIntent(INTENT_ID);
        RiskAssessment memory assessment = _submitAssessment(INTENT_ID);

        TradeConfirmation memory c = _signedConfirmation(INTENT_ID);
        string memory insuranceId = _insuranceId(INTENT_ID);
        string memory positionId = _positionId(INTENT_ID);

        vm.expectEmit(true, true, true, true, address(arvoMain));
        emit SubmitTradeConfirmation(
            c.id, INTENT_ID, c.transactionHash, address(tokenIn), address(tokenOut), AMOUNT_IN, AMOUNT_OUT
        );

        vm.expectEmit(true, true, true, true, address(arvoMain));
        emit PositionCreated(
            positionId, insuranceId, vaultAddress, address(tokenIn), AMOUNT_IN, address(tokenOut), AMOUNT_OUT
        );

        vm.expectEmit(true, true, true, true, address(arvoMain));
        emit InsuranceIssued(insuranceId, INTENT_ID, assessment.id, c.id, PREMIUM, COVERAGE, COVERAGE_DURATION);

        vm.prank(owner);
        arvoMain.submitTradeConfirmation(c);
    }

    // Order independence
    function test_OrderIndependence_AssessmentThenConfirmation() public {
        _submitIntent(INTENT_ID);
        _submitAssessment(INTENT_ID);
        _submitConfirmation(INTENT_ID);

        _assertIssuedHappyPath(INTENT_ID);
    }

    function test_OrderIndependence_ConfirmationThenAssessment() public {
        _submitIntent(INTENT_ID);
        _submitConfirmation(INTENT_ID);
        _submitAssessment(INTENT_ID);

        _assertIssuedHappyPath(INTENT_ID);
    }

    function test_OrderIndependence_BothPathsProduceIdenticalState() public {
        // Path A on this fixture
        _submitIntent("A");
        _submitAssessment("A");
        _submitConfirmation("A");

        // Path B on a second, structurally identical intent
        _submitIntent("B");
        _submitConfirmation("B");
        _submitAssessment("B");

        Insurance memory ia = arvoMain.getInsuranceByTradeIntentId("A");
        Insurance memory ib = arvoMain.getInsuranceByTradeIntentId("B");
        assertEq(ia.premium, ib.premium);
        assertEq(ia.coverage, ib.coverage);
        assertEq(ia.coverageDuration, ib.coverageDuration);
        assertEq(ia.valid, ib.valid);

        Position memory pa = arvoMain.getPositionByTradeIntentId("A");
        Position memory pb = arvoMain.getPositionByTradeIntentId("B");
        assertEq(pa.vaultAddress, pb.vaultAddress);
        assertEq(pa.amountIn, pb.amountIn);
        assertEq(pa.amountOut, pb.amountOut);
        assertEq(pa.isActive, pb.isActive);

        // Both locked their own tokenOut and both paid their own premium
        assertEq(vault.lockedAmount(address(tokenOut)), AMOUNT_OUT * 2);
        assertEq(usdc.balanceOf(address(arvoMain)), PREMIUM * 2);
    }

    /// @dev Shared assertions for a successfully issued happy-path insurance.
    function _assertIssuedHappyPath(string memory intentId) internal view {
        string memory insuranceId = _insuranceId(intentId);
        assertEq(uint8(arvoMain.getTradeIntent(intentId).status), uint8(TradeIntentStatus.APPROVED));
        assertTrue(arvoMain.insuranceExists(insuranceId));
        assertTrue(arvoMain.getInsurance(insuranceId).valid);
        assertTrue(arvoMain.getPosition(insuranceId).isActive);
        assertEq(arvoMain.tradeIntentToInsurance(intentId), insuranceId);
        assertEq(vault.lockedAmount(address(tokenOut)), AMOUNT_OUT);
        assertEq(usdc.balanceOf(address(arvoMain)), PREMIUM);
    }

    // Evaluation rejections

    /// @dev Submits intent + confirmation so the next risk assessment triggers the
    ///      automatic evaluation inside `submitRiskAssessment`.
    function _prepareForEvaluation() internal {
        _submitIntent(INTENT_ID);
        _submitConfirmation(INTENT_ID);
    }

    /// @dev Signs and submits a hand-tailored assessment (this is the call that
    ///      triggers evaluation, so `expectEmit` must be set immediately before it).
    function _submitTailoredAssessment(RiskAssessment memory a) internal {
        a.signature = _signAssessment(a, riskEnginePk);
        vm.prank(owner);
        arvoMain.submitRiskAssessment(a);
    }

    /// @dev Convenience wrapper for cases that do not assert on events.
    function _evaluateWithAssessment(RiskAssessment memory a) internal {
        _prepareForEvaluation();
        _submitTailoredAssessment(a);
    }

    function _assertRejected(string memory reason) internal view {
        assertEq(uint8(arvoMain.getTradeIntent(INTENT_ID).status), uint8(TradeIntentStatus.REJECTED), reason);
        assertEq(arvoMain.tradeIntentToInsurance(INTENT_ID), "", "no insurance id mapped");
        assertFalse(arvoMain.insuranceExists(_insuranceId(INTENT_ID)), "no insurance");
        assertFalse(arvoMain.getPosition(_insuranceId(INTENT_ID)).isActive, "no active position");
        assertEq(vault.lockedAmount(address(tokenOut)), 0, "nothing locked");
        assertEq(usdc.balanceOf(vaultAddress), VAULT_USDC, "no premium deducted");
        assertEq(usdc.balanceOf(address(arvoMain)), 0, "ArvoMain received nothing");
    }

    function test_Evaluate_RejectsExpiredRiskAssessment() public {
        _submitIntent(INTENT_ID);
        _submitConfirmation(INTENT_ID);

        RiskAssessment memory a = _baseAssessment(INTENT_ID);
        a.expiresAt = block.timestamp - 1; // already expired
        a.signature = _signAssessment(a, riskEnginePk);

        vm.expectEmit(true, true, true, true, address(arvoMain));
        emit TradeIntentRejected(INTENT_ID, "Risk assessment has expired");

        vm.prank(owner);
        arvoMain.submitRiskAssessment(a);

        _assertRejected("expired assessment");
    }

    function test_Evaluate_AcceptsAssessmentExactlyAtExpiry() public {
        _submitIntent(INTENT_ID);
        _submitConfirmation(INTENT_ID);

        RiskAssessment memory a = _baseAssessment(INTENT_ID);
        a.expiresAt = block.timestamp; // contract rejects only when strictly greater
        a.signature = _signAssessment(a, riskEnginePk);

        vm.prank(owner);
        arvoMain.submitRiskAssessment(a);

        assertEq(uint8(arvoMain.getTradeIntent(INTENT_ID).status), uint8(TradeIntentStatus.APPROVED));
    }

    function test_Evaluate_RejectsZeroCoverageDuration() public {
        _prepareForEvaluation();
        RiskAssessment memory a = _baseAssessment(INTENT_ID);
        a.coverageDuration = 0;

        vm.expectEmit(true, true, true, true, address(arvoMain));
        emit TradeIntentRejected(INTENT_ID, "Coverage duration is zero");

        _submitTailoredAssessment(a);
        _assertRejected("zero coverage duration");
    }

    function test_Evaluate_RejectsPremiumAboveMaximum() public {
        _prepareForEvaluation();
        RiskAssessment memory a = _baseAssessment(INTENT_ID);
        a.premium = MAX_PREMIUM + 1;

        vm.expectEmit(true, true, true, true, address(arvoMain));
        emit TradeIntentRejected(INTENT_ID, "Premium exceeds maximum");

        _submitTailoredAssessment(a);
        _assertRejected("premium above max");
    }

    function test_Evaluate_AcceptsPremiumEqualToMaximum() public {
        RiskAssessment memory a = _baseAssessment(INTENT_ID);
        a.premium = MAX_PREMIUM;

        _evaluateWithAssessment(a);

        assertEq(uint8(arvoMain.getTradeIntent(INTENT_ID).status), uint8(TradeIntentStatus.APPROVED));
        assertEq(usdc.balanceOf(address(arvoMain)), MAX_PREMIUM);
    }

    function test_Evaluate_RejectsCoverageBelowMinimum() public {
        _prepareForEvaluation();
        RiskAssessment memory a = _baseAssessment(INTENT_ID);
        a.coverage = uint256(MIN_COVERAGE) - 1;

        vm.expectEmit(true, true, true, true, address(arvoMain));
        emit TradeIntentRejected(INTENT_ID, "Coverage is below minimum");

        _submitTailoredAssessment(a);
        _assertRejected("coverage below min");
    }

    function test_Evaluate_AcceptsCoverageEqualToMinimum() public {
        RiskAssessment memory a = _baseAssessment(INTENT_ID);
        a.coverage = uint256(MIN_COVERAGE);

        _evaluateWithAssessment(a);

        assertEq(uint8(arvoMain.getTradeIntent(INTENT_ID).status), uint8(TradeIntentStatus.APPROVED));
        assertEq(arvoMain.getInsurance(_insuranceId(INTENT_ID)).coverage, uint256(MIN_COVERAGE));
    }

    function test_Evaluate_RejectsCoverageDurationBelowMinimum() public {
        _prepareForEvaluation();
        RiskAssessment memory a = _baseAssessment(INTENT_ID);
        a.coverageDuration = MIN_COVERAGE_DURATION - 1;

        vm.expectEmit(true, true, true, true, address(arvoMain));
        emit TradeIntentRejected(INTENT_ID, "Coverage duration is below minimum");

        _submitTailoredAssessment(a);
        _assertRejected("coverage duration below min");
    }

    function test_Evaluate_AcceptsCoverageDurationEqualToMinimum() public {
        RiskAssessment memory a = _baseAssessment(INTENT_ID);
        a.coverageDuration = MIN_COVERAGE_DURATION;

        _evaluateWithAssessment(a);

        assertEq(uint8(arvoMain.getTradeIntent(INTENT_ID).status), uint8(TradeIntentStatus.APPROVED));
    }

    function test_Evaluate_RejectsRiskScoreAboveMaximum() public {
        _prepareForEvaluation();
        RiskAssessment memory a = _baseAssessment(INTENT_ID);
        a.riskScore = MAX_ALLOWED_RISK_SCORE + 1;

        vm.expectEmit(true, true, true, true, address(arvoMain));
        emit TradeIntentRejected(INTENT_ID, "Risk score is too high");

        _submitTailoredAssessment(a);
        _assertRejected("risk score too high");
    }

    function test_Evaluate_AcceptsRiskScoreExactlyAtMaximum() public {
        RiskAssessment memory a = _baseAssessment(INTENT_ID);
        a.riskScore = MAX_ALLOWED_RISK_SCORE;

        _evaluateWithAssessment(a);

        assertEq(uint8(arvoMain.getTradeIntent(INTENT_ID).status), uint8(TradeIntentStatus.APPROVED));
    }

    /// @dev The rejection branches are checked in order; expiry wins over everything else.
    function test_Evaluate_ExpiryTakesPrecedenceOverOtherFailures() public {
        _submitIntent(INTENT_ID);
        _submitConfirmation(INTENT_ID);

        RiskAssessment memory a = _baseAssessment(INTENT_ID);
        a.expiresAt = block.timestamp - 1;
        a.riskScore = 100; // would also fail, but expiry is checked first
        a.signature = _signAssessment(a, riskEnginePk);

        vm.expectEmit(true, true, true, true, address(arvoMain));
        emit TradeIntentRejected(INTENT_ID, "Risk assessment has expired");

        vm.prank(owner);
        arvoMain.submitRiskAssessment(a);
    }

    // Manual evaluation
    function test_EvaluateManually_RevertWhen_IntentMissing() public {
        vm.expectRevert("Trade intent is not evaluatable!");
        arvoMain.evaluateTradeIntent("NO-SUCH-INTENT");
    }

    function test_EvaluateManually_RevertWhen_AssessmentMissing() public {
        _submitIntent(INTENT_ID);
        _submitConfirmation(INTENT_ID);

        vm.expectRevert("Trade intent is not evaluatable!");
        arvoMain.evaluateTradeIntent(INTENT_ID);
    }

    function test_EvaluateManually_RevertWhen_ConfirmationMissing() public {
        _submitIntent(INTENT_ID);
        _submitAssessment(INTENT_ID);

        vm.expectRevert("Trade intent is not evaluatable!");
        arvoMain.evaluateTradeIntent(INTENT_ID);
    }

    function test_EvaluateManually_RevertWhen_InsuranceAlreadyIssued() public {
        _issueInsurance(INTENT_ID);

        vm.expectRevert("Insurance already issued for this trade intent!");
        arvoMain.evaluateTradeIntent(INTENT_ID);

        // No second insurance, no extra lock, no extra premium.
        assertEq(vault.lockedAmount(address(tokenOut)), AMOUNT_OUT);
        assertEq(usdc.balanceOf(address(arvoMain)), PREMIUM);
    }

    function test_EvaluateManually_RevertWhen_IntentAlreadyRejected() public {
        RiskAssessment memory a = _baseAssessment(INTENT_ID);
        a.riskScore = 100;
        _evaluateWithAssessment(a);
        assertEq(uint8(arvoMain.getTradeIntent(INTENT_ID).status), uint8(TradeIntentStatus.REJECTED));

        vm.expectRevert("Trade intent is not in pending status!");
        arvoMain.evaluateTradeIntent(INTENT_ID);
    }

    /// @dev `evaluateTradeIntent` carries no access control in the current
    ///      implementation. Documented here as the behaviour that exists today:
    ///      a non-owner reaches the same require-checks the owner would.
    function test_EvaluateManually_IsCallableByAnyone() public {
        _issueInsurance(INTENT_ID);

        // Not an ownership revert - the attacker gets the same business-rule revert.
        vm.prank(attacker);
        vm.expectRevert("Insurance already issued for this trade intent!");
        arvoMain.evaluateTradeIntent(INTENT_ID);

        vm.prank(attacker);
        vm.expectRevert("Trade intent is not evaluatable!");
        arvoMain.evaluateTradeIntent("UNKNOWN");
    }

    // Invalidation
    function test_InvalidateInsurance_ByOwner() public {
        string memory insuranceId = _issueInsurance(INTENT_ID);
        Insurance memory ins = arvoMain.getInsurance(insuranceId);

        uint256 vaultUsdcBefore = usdc.balanceOf(vaultAddress);

        vm.expectEmit(true, true, true, true, address(arvoMain));
        emit InsuranceInvalidated(insuranceId, INTENT_ID, ins.riskAssessmentId, ins.tradeConfirmationId);

        vm.expectEmit(true, true, true, true, address(arvoMain));
        emit PositionDeactivated(_positionId(INTENT_ID), insuranceId, vaultAddress, address(tokenIn), AMOUNT_IN);

        vm.prank(owner);
        arvoMain.invalidateInsurance(insuranceId);

        assertFalse(arvoMain.getInsurance(insuranceId).valid, "insurance invalid");
        assertFalse(arvoMain.getPosition(insuranceId).isActive, "position inactive");
        assertEq(vault.lockedAmount(address(tokenOut)), 0, "tokenOut unlocked");
        assertEq(vault.availableBalance(address(tokenOut)), tokenOut.balanceOf(vaultAddress), "fully available again");

        // Invalidation does not refund the premium.
        assertEq(usdc.balanceOf(vaultAddress), vaultUsdcBefore, "premium is not refunded on invalidation");
        assertEq(usdc.balanceOf(address(arvoMain)), PREMIUM);

        // The insurance record itself survives, only the flags flip.
        assertTrue(arvoMain.insuranceExists(insuranceId));
        assertEq(arvoMain.tradeIntentToInsurance(INTENT_ID), insuranceId);
        assertEq(uint8(arvoMain.getTradeIntent(INTENT_ID).status), uint8(TradeIntentStatus.APPROVED));
    }

    function test_InvalidateInsurance_ByInsuredUser() public {
        string memory insuranceId = _issueInsurance(INTENT_ID);

        vm.prank(dummyUser); // == tradeIntents[intentId].userAddress
        arvoMain.invalidateInsurance(insuranceId);

        assertFalse(arvoMain.getInsurance(insuranceId).valid);
        assertFalse(arvoMain.getPosition(insuranceId).isActive);
        assertEq(vault.lockedAmount(address(tokenOut)), 0);
    }

    function test_InvalidateInsurance_RevertWhen_CallerIsAttacker() public {
        string memory insuranceId = _issueInsurance(INTENT_ID);

        vm.prank(attacker);
        vm.expectRevert("Caller is not authorized to invalidate the insurance!");
        arvoMain.invalidateInsurance(insuranceId);

        assertTrue(arvoMain.getInsurance(insuranceId).valid);
        assertTrue(arvoMain.getPosition(insuranceId).isActive);
        assertEq(vault.lockedAmount(address(tokenOut)), AMOUNT_OUT);
    }

    function test_InvalidateInsurance_RevertWhen_CallerIsUnrelatedUser() public {
        string memory insuranceId = _issueInsurance(INTENT_ID);

        vm.prank(user); // a real actor, but not the insured user of this intent
        vm.expectRevert("Caller is not authorized to invalidate the insurance!");
        arvoMain.invalidateInsurance(insuranceId);
    }

    function test_InvalidateInsurance_RevertWhen_InsuranceDoesNotExist() public {
        vm.prank(owner);
        vm.expectRevert("Insurance does not exist!");
        arvoMain.invalidateInsurance("INSURANCE-NOPE");
    }

    function test_InvalidateInsurance_RevertWhen_AlreadyInvalid() public {
        string memory insuranceId = _issueInsurance(INTENT_ID);

        vm.prank(owner);
        arvoMain.invalidateInsurance(insuranceId);

        // Second invalidation is rejected by the `valid` guard, so the vault is
        // never double-unlocked.
        vm.prank(owner);
        vm.expectRevert("Insurance is not valid!");
        arvoMain.invalidateInsurance(insuranceId);

        assertEq(vault.lockedAmount(address(tokenOut)), 0);
    }

    function test_InvalidateInsurance_RevertWhen_AlreadyClaimed() public {
        string memory insuranceId = _issueInsurance(INTENT_ID);

        vm.prank(owner);
        arvoMain.claimInsurance(insuranceId);

        vm.prank(dummyUser);
        vm.expectRevert("Insurance is not valid!");
        arvoMain.invalidateInsurance(insuranceId);
    }

    // claimInsurance
    function test_ClaimInsurance_Success() public {
        string memory insuranceId = _issueInsurance(INTENT_ID);
        Insurance memory ins = arvoMain.getInsurance(insuranceId);

        uint256 expectedCoverage = AMOUNT_IN * COVERAGE / 100;
        assertEq(expectedCoverage, 800e18, "sanity: 80% of 1000e18");

        uint256 vaultTokenInBefore = tokenIn.balanceOf(vaultAddress);
        uint256 arvoTokenInBefore = tokenIn.balanceOf(address(arvoMain));
        uint256 vaultUsdcBefore = usdc.balanceOf(vaultAddress);
        uint256 arvoUsdcBefore = usdc.balanceOf(address(arvoMain));

        vm.expectEmit(true, true, true, true, address(arvoMain));
        emit InsuranceInvalidated(insuranceId, INTENT_ID, ins.riskAssessmentId, ins.tradeConfirmationId);

        vm.expectEmit(true, true, true, true, address(arvoMain));
        emit PositionDeactivated(_positionId(INTENT_ID), insuranceId, vaultAddress, address(tokenIn), AMOUNT_IN);

        vm.prank(owner);
        arvoMain.claimInsurance(insuranceId);

        // Coverage payout in tokenIn, straight to the vault.
        assertEq(tokenIn.balanceOf(vaultAddress), vaultTokenInBefore + expectedCoverage, "vault got coverage");
        assertEq(tokenIn.balanceOf(address(arvoMain)), arvoTokenInBefore - expectedCoverage, "arvo paid coverage");

        // Premium refunded in full.
        assertEq(usdc.balanceOf(vaultAddress), vaultUsdcBefore + PREMIUM, "vault got premium back");
        assertEq(usdc.balanceOf(address(arvoMain)), arvoUsdcBefore - PREMIUM, "arvo refunded premium");
        assertEq(usdc.balanceOf(vaultAddress), VAULT_USDC, "vault premium balance restored to pre-issuance level");

        // Position unlocked and both flags flipped.
        assertEq(vault.lockedAmount(address(tokenOut)), 0, "tokenOut unlocked");
        assertFalse(arvoMain.getInsurance(insuranceId).valid);
        assertFalse(arvoMain.getPosition(insuranceId).isActive);
    }

    function test_ClaimInsurance_RevertWhen_InsuranceDoesNotExist() public {
        vm.prank(owner);
        vm.expectRevert("Insurance does not exist!");
        arvoMain.claimInsurance("INSURANCE-NOPE");
    }

    function test_ClaimInsurance_RevertWhen_AlreadyInvalidated() public {
        string memory insuranceId = _issueInsurance(INTENT_ID);

        vm.prank(dummyUser);
        arvoMain.invalidateInsurance(insuranceId);

        vm.prank(owner);
        vm.expectRevert("Insurance is not valid!");
        arvoMain.claimInsurance(insuranceId);
    }

    function test_ClaimInsurance_RevertWhen_ClaimedTwice() public {
        string memory insuranceId = _issueInsurance(INTENT_ID);

        vm.prank(owner);
        arvoMain.claimInsurance(insuranceId);

        uint256 vaultTokenInAfterFirst = tokenIn.balanceOf(vaultAddress);

        vm.prank(owner);
        vm.expectRevert("Insurance is not valid!");
        arvoMain.claimInsurance(insuranceId);

        assertEq(tokenIn.balanceOf(vaultAddress), vaultTokenInAfterFirst, "no second payout");
        assertEq(vault.lockedAmount(address(tokenOut)), 0);
    }

    function test_ClaimInsurance_RevertWhen_CoverageExpired() public {
        string memory insuranceId = _issueInsurance(INTENT_ID);
        uint256 executedAt = arvoMain.getTradeConfirmation(INTENT_ID).executedAt;

        vm.warp(executedAt + COVERAGE_DURATION + 1);

        vm.prank(owner);
        vm.expectRevert("Insurance coverage duration has expired!");
        arvoMain.claimInsurance(insuranceId);

        assertTrue(arvoMain.getInsurance(insuranceId).valid, "still valid after failed claim");
        assertTrue(arvoMain.getPosition(insuranceId).isActive);
        assertEq(vault.lockedAmount(address(tokenOut)), AMOUNT_OUT, "still locked");
    }

    function test_ClaimInsurance_AcceptedExactlyAtExpiryBoundary() public {
        string memory insuranceId = _issueInsurance(INTENT_ID);
        uint256 executedAt = arvoMain.getTradeConfirmation(INTENT_ID).executedAt;

        // block.timestamp == executedAt + coverageDuration, contract uses <=
        vm.warp(executedAt + COVERAGE_DURATION);

        vm.prank(owner);
        arvoMain.claimInsurance(insuranceId);

        assertFalse(arvoMain.getInsurance(insuranceId).valid);
        assertEq(tokenIn.balanceOf(vaultAddress), AMOUNT_IN * COVERAGE / 100);
    }

    function test_ClaimInsurance_RevertWhen_NotOwner() public {
        string memory insuranceId = _issueInsurance(INTENT_ID);

        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, attacker));
        arvoMain.claimInsurance(insuranceId);

        // Even the insured user cannot claim - claiming is owner-only.
        vm.prank(dummyUser);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, dummyUser));
        arvoMain.claimInsurance(insuranceId);

        assertTrue(arvoMain.getInsurance(insuranceId).valid);
    }

    function test_ClaimInsurance_RevertsAtomically_WhenArvoLacksTokenIn() public {
        string memory insuranceId = _issueInsurance(INTENT_ID);

        uint256 coverageAmount = AMOUNT_IN * COVERAGE / 100;
        // Leave ArvoMain one wei short of the payout.
        tokenIn.burn(address(arvoMain), tokenIn.balanceOf(address(arvoMain)) - (coverageAmount - 1));
        uint256 arvoTokenIn = tokenIn.balanceOf(address(arvoMain));

        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(
                IERC20Errors.ERC20InsufficientBalance.selector, address(arvoMain), arvoTokenIn, coverageAmount
            )
        );
        arvoMain.claimInsurance(insuranceId);

        // Nothing moved, nothing flipped.
        assertEq(tokenIn.balanceOf(address(arvoMain)), arvoTokenIn);
        assertEq(tokenIn.balanceOf(vaultAddress), 0);
        assertEq(usdc.balanceOf(address(arvoMain)), PREMIUM);
        assertTrue(arvoMain.getInsurance(insuranceId).valid);
        assertTrue(arvoMain.getPosition(insuranceId).isActive);
        assertEq(vault.lockedAmount(address(tokenOut)), AMOUNT_OUT);
    }

    function test_ClaimInsurance_RevertsAtomically_WhenArvoLacksPremiumToken() public {
        string memory insuranceId = _issueInsurance(INTENT_ID);

        // The coverage leg would succeed, the premium refund leg cannot.
        usdc.burn(address(arvoMain), PREMIUM);
        assertEq(usdc.balanceOf(address(arvoMain)), 0);

        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, address(arvoMain), 0, PREMIUM)
        );
        arvoMain.claimInsurance(insuranceId);

        // The coverage transfer must have been rolled back too.
        assertEq(tokenIn.balanceOf(vaultAddress), 0, "coverage payout rolled back");
        assertEq(tokenIn.balanceOf(address(arvoMain)), ARVO_TOKEN_IN, "arvo tokenIn untouched");
        assertTrue(arvoMain.getInsurance(insuranceId).valid);
        assertTrue(arvoMain.getPosition(insuranceId).isActive);
        assertEq(vault.lockedAmount(address(tokenOut)), AMOUNT_OUT);
    }

    // Valut interaction atomicity
    /// @dev Spins up an extra vault through the factory for a fresh owner.
    function _newVault(string memory label, address arvoProto, uint256 tokenOutAmount, uint256 usdcAmount)
        internal
        returns (address vaultAddr, address vaultOwner)
    {
        vaultOwner = makeAddr(label);
        vm.prank(vaultOwner);
        vaultAddr = factory.createVault(label, arvoProto, executor);
        _fundVault(Vault(vaultAddr), vaultOwner, tokenOutAmount, usdcAmount);
    }

    function _signedIntentForVault(string memory id, address vaultAddr, address vaultOwner)
        internal
        view
        returns (TradeIntent memory intent)
    {
        intent = _baseIntent(id);
        intent.vaultAddress = vaultAddr;
        intent.userAddress = vaultOwner;
        intent.signature = _signIntent(intent, agentPk);
    }

    function test_Issuance_RevertsAtomically_WhenVaultCannotLockTokenOut() public {
        (address poorVault, address poorOwner) = _newVault("poorVault", address(arvoMain), 0, VAULT_USDC);

        TradeIntent memory intent = _signedIntentForVault("INTENT-POOR", poorVault, poorOwner);
        vm.prank(owner);
        arvoMain.submitTradeIntent(intent);

        _submitAssessment("INTENT-POOR");

        TradeConfirmation memory c = _signedConfirmation("INTENT-POOR");
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(VaultErrors.InsufficientBalance.selector, uint256(0)));
        arvoMain.submitTradeConfirmation(c);

        // The whole submission reverted: no confirmation, no insurance, no premium moved.
        assertFalse(arvoMain.tradeConfirmationExists("INTENT-POOR"));
        assertFalse(arvoMain.insuranceExists(_insuranceId("INTENT-POOR")));
        assertEq(arvoMain.tradeIntentToInsurance("INTENT-POOR"), "");
        assertEq(uint8(arvoMain.getTradeIntent("INTENT-POOR").status), uint8(TradeIntentStatus.PENDING));
        assertEq(usdc.balanceOf(poorVault), VAULT_USDC, "premium not deducted");
        assertEq(Vault(poorVault).lockedAmount(address(tokenOut)), 0);
    }

    function test_Issuance_RevertsAtomically_WhenVaultCannotPayPremium() public {
        // Enough tokenOut to lock, but no premium token at all.
        (address noPremiumVault, address vaultOwner) = _newVault("noPremiumVault", address(arvoMain), VAULT_TOKEN_OUT, 0);

        TradeIntent memory intent = _signedIntentForVault("INTENT-NOPREM", noPremiumVault, vaultOwner);
        vm.prank(owner);
        arvoMain.submitTradeIntent(intent);

        _submitAssessment("INTENT-NOPREM");

        TradeConfirmation memory c = _signedConfirmation("INTENT-NOPREM");
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(VaultErrors.InsufficientBalance.selector, uint256(0)));
        arvoMain.submitTradeConfirmation(c);

        // lockAsset succeeded inside the reverted call - it must be rolled back.
        assertEq(Vault(noPremiumVault).lockedAmount(address(tokenOut)), 0, "lock rolled back");
        assertFalse(arvoMain.tradeConfirmationExists("INTENT-NOPREM"));
        assertFalse(arvoMain.insuranceExists(_insuranceId("INTENT-NOPREM")));
        assertEq(uint8(arvoMain.getTradeIntent("INTENT-NOPREM").status), uint8(TradeIntentStatus.PENDING));
    }

    function test_Issuance_RevertsAtomically_WhenArvoLacksArvoRoleOnVault() public {
        // Vault created with a different ARVO address: ArvoMain cannot lock or deduct.
        (address foreignVault, address vaultOwner) =
            _newVault("foreignVault", makeAddr("otherArvo"), VAULT_TOKEN_OUT, VAULT_USDC);

        TradeIntent memory intent = _signedIntentForVault("INTENT-FOREIGN", foreignVault, vaultOwner);
        vm.prank(owner);
        arvoMain.submitTradeIntent(intent);

        _submitAssessment("INTENT-FOREIGN");

        TradeConfirmation memory c = _signedConfirmation("INTENT-FOREIGN");
        vm.prank(owner);
        vm.expectRevert("Caller is not Arvo main contract!");
        arvoMain.submitTradeConfirmation(c);

        assertFalse(arvoMain.insuranceExists(_insuranceId("INTENT-FOREIGN")));
        assertEq(Vault(foreignVault).lockedAmount(address(tokenOut)), 0);
        assertEq(usdc.balanceOf(foreignVault), VAULT_USDC);
    }

    function test_Issuance_ReattemptSucceedsAfterVaultIsFunded() public {
        (address poorVault, address poorOwner) = _newVault("lateVault", address(arvoMain), 0, VAULT_USDC);

        TradeIntent memory intent = _signedIntentForVault("INTENT-LATE", poorVault, poorOwner);
        vm.prank(owner);
        arvoMain.submitTradeIntent(intent);
        _submitAssessment("INTENT-LATE");

        TradeConfirmation memory c = _signedConfirmation("INTENT-LATE");
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(VaultErrors.InsufficientBalance.selector, uint256(0)));
        arvoMain.submitTradeConfirmation(c);

        // Fund the vault, resubmit the very same confirmation: it now goes through.
        _fundVault(Vault(poorVault), poorOwner, VAULT_TOKEN_OUT, 0);

        vm.prank(owner);
        arvoMain.submitTradeConfirmation(c);

        assertTrue(arvoMain.insuranceExists(_insuranceId("INTENT-LATE")));
        assertEq(Vault(poorVault).lockedAmount(address(tokenOut)), AMOUNT_OUT);
    }

    function test_Vault_RejectsUnlockLargerThanLockedAmount() public {
        string memory insuranceId = _issueInsurance(INTENT_ID);

        // Drain the vault's lock bookkeeping through a second ArvoMain-authorised
        // path is not possible, so instead check the guard directly: unlocking more
        // than is locked is rejected by the vault.
        vm.prank(address(arvoMain));
        vm.expectRevert(abi.encodeWithSelector(VaultErrors.InvalidUnlock.selector, AMOUNT_OUT));
        vault.unlockAsset(address(tokenOut), AMOUNT_OUT + 1);

        // The insurance is untouched by the failed vault call.
        assertTrue(arvoMain.getInsurance(insuranceId).valid);
        assertEq(vault.lockedAmount(address(tokenOut)), AMOUNT_OUT);
    }

    // Zero amount edge cases
    /// @dev The vault rejects zero-amount premium deductions, so an assessment
    ///      that prices the coverage at zero makes the whole submission revert
    ///      instead of issuing a free policy. Documented, not asserted as desired.
    function test_Evaluate_RevertsWhenPremiumIsZero() public {
        _submitIntent(INTENT_ID);
        _submitConfirmation(INTENT_ID);

        RiskAssessment memory a = _baseAssessment(INTENT_ID);
        a.premium = 0;
        a.signature = _signAssessment(a, riskEnginePk);

        vm.prank(owner);
        vm.expectRevert(VaultErrors.InvalidAmount.selector);
        arvoMain.submitRiskAssessment(a);

        assertFalse(arvoMain.riskAssessmentExists(INTENT_ID), "assessment not stored");
        assertFalse(arvoMain.insuranceExists(_insuranceId(INTENT_ID)));
        assertEq(vault.lockedAmount(address(tokenOut)), 0);
    }

    /// @dev `submitTradeIntent` now requires `minAmountOut > 0`, and a confirmation
    ///      must satisfy `amountOut >= minAmountOut`. Together those make a
    ///      zero-`amountOut` lock unreachable, so `Vault.lockAsset` can never be
    ///      called with 0. Both halves of that chain are asserted here.
    function test_Evaluate_ZeroAmountOutIsUnreachable() public {
        // Half 1: an intent that would permit a zero amountOut is rejected outright.
        TradeIntent memory zeroFloor = _baseIntent("INTENT-ZERO-OUT");
        zeroFloor.minAmountOut = 0;
        zeroFloor.signature = _signIntent(zeroFloor, agentPk);

        vm.prank(owner);
        vm.expectRevert("Invalid minAmount");
        arvoMain.submitTradeIntent(zeroFloor);

        // Half 2: under a real intent, a zero-amountOut confirmation fails the match
        // check long before the vault is touched.
        _submitIntent(INTENT_ID);
        _submitAssessment(INTENT_ID);

        TradeConfirmation memory c = _baseConfirmation(INTENT_ID);
        c.amountOut = 0;
        c.signature = _signConfirmation(c, executorPk);

        vm.prank(owner);
        vm.expectRevert("Trade confirmation does not match the trade intent!");
        arvoMain.submitTradeConfirmation(c);

        assertFalse(arvoMain.tradeConfirmationExists(INTENT_ID));
        assertFalse(arvoMain.insuranceExists(_insuranceId(INTENT_ID)));
        assertEq(vault.lockedAmount(address(tokenOut)), 0);
    }

    // Signature edge cases
    /// @dev Signs the untouched base intent, then mutates one signed field at a
    ///      time. Every mutation must break recovery.
    function test_IntentSignature_BreaksOnAnyMutatedField() public {
        TradeIntent memory signed = _signedIntent(INTENT_ID);

        TradeIntent memory m;

        m = _copy(signed);
        m.id = "INTENT-OTHER";
        _expectIntentSignatureRejected(m);

        m = _copy(signed);
        m.userAddress = attacker;
        _expectIntentSignatureRejected(m);

        m = _copy(signed);
        m.agentAddress = attacker;
        _expectIntentSignatureRejected(m);

        m = _copy(signed);
        m.vaultAddress = makeAddr("otherVault");
        _expectIntentSignatureRejected(m);

        m = _copy(signed);
        m.tokenIn = address(usdc);
        _expectIntentSignatureRejected(m);

        m = _copy(signed);
        m.tokenOut = address(usdc);
        _expectIntentSignatureRejected(m);

        m = _copy(signed);
        m.amountIn = AMOUNT_IN + 1;
        _expectIntentSignatureRejected(m);

        m = _copy(signed);
        m.minAmountOut = MIN_AMOUNT_OUT + 1;
        _expectIntentSignatureRejected(m);

        m = _copy(signed);
        m.deadline = signed.deadline + 1; // still in the future, so only the signature can fail
        _expectIntentSignatureRejected(m);

        m = _copy(signed);
        m.maxPremium = MAX_PREMIUM + 1;
        _expectIntentSignatureRejected(m);

        m = _copy(signed);
        m.minCoverage = MIN_COVERAGE + 1; // still <= 100
        _expectIntentSignatureRejected(m);

        m = _copy(signed);
        m.minCoverageDuration = MIN_COVERAGE_DURATION + 1; // still non-zero
        _expectIntentSignatureRejected(m);

        // Nothing got through.
        assertFalse(arvoMain.tradeIntentExists(INTENT_ID));
        assertFalse(arvoMain.tradeIntentExists("INTENT-OTHER"));
    }

    function _expectIntentSignatureRejected(TradeIntent memory intent) internal {
        vm.prank(owner);
        vm.expectRevert("Invalid trade intent signature!");
        arvoMain.submitTradeIntent(intent);
    }

    function test_AssessmentSignature_BreaksOnAnyMutatedField() public {
        _submitIntent(INTENT_ID);
        RiskAssessment memory signed = _signedAssessment(INTENT_ID);

        RiskAssessment memory m;

        m = _copy(signed);
        m.id = "RISK-OTHER";
        _expectAssessmentSignatureRejected(m);

        m = _copy(signed);
        m.riskScore = RISK_SCORE + 1;
        _expectAssessmentSignatureRejected(m);

        m = _copy(signed);
        m.premium = PREMIUM + 1;
        _expectAssessmentSignatureRejected(m);

        m = _copy(signed);
        m.coverage = COVERAGE + 1; // still <= 100
        _expectAssessmentSignatureRejected(m);

        m = _copy(signed);
        m.coverageDuration = COVERAGE_DURATION + 1;
        _expectAssessmentSignatureRejected(m);

        m = _copy(signed);
        m.assessedAt = signed.assessedAt + 1;
        _expectAssessmentSignatureRejected(m);

        m = _copy(signed);
        m.expiresAt = signed.expiresAt + 1;
        _expectAssessmentSignatureRejected(m);

        m = _copy(signed);
        m.assessmentHash = "0xtampered";
        _expectAssessmentSignatureRejected(m);

        assertFalse(arvoMain.riskAssessmentExists(INTENT_ID));
    }

    function _expectAssessmentSignatureRejected(RiskAssessment memory a) internal {
        vm.prank(owner);
        vm.expectRevert("Invalid risk assessment signature!");
        arvoMain.submitRiskAssessment(a);
    }

    function test_ConfirmationSignature_BreaksOnAnyMutatedField() public {
        _submitIntent(INTENT_ID);
        TradeConfirmation memory signed = _signedConfirmation(INTENT_ID);

        TradeConfirmation memory m;

        m = _copy(signed);
        m.id = "CONFIRM-OTHER";
        _expectConfirmationSignatureRejected(m);

        m = _copy(signed);
        m.transactionHash = "0xtampered";
        _expectConfirmationSignatureRejected(m);

        m = _copy(signed);
        m.amountOut = AMOUNT_OUT + 1; // still >= minAmountOut, so only the signature can fail
        _expectConfirmationSignatureRejected(m);

        m = _copy(signed);
        m.executedAt = signed.executedAt - 1; // still in the past and before the deadline
        _expectConfirmationSignatureRejected(m);

        assertFalse(arvoMain.tradeConfirmationExists(INTENT_ID));
    }

    function _expectConfirmationSignatureRejected(TradeConfirmation memory c) internal {
        vm.prank(owner);
        vm.expectRevert("Invalid trade confirmation signature!");
        arvoMain.submitTradeConfirmation(c);
    }

    function test_AssessmentSignature_CannotBeReusedOnAnotherIntent() public {
        _submitIntent("INTENT-A");
        _submitIntent("INTENT-B");

        RiskAssessment memory forA = _signedAssessment("INTENT-A");

        // Same signature bytes, retargeted at INTENT-B.
        RiskAssessment memory reused = _copy(forA);
        reused.intentId = "INTENT-B";

        vm.prank(owner);
        vm.expectRevert("Invalid risk assessment signature!");
        arvoMain.submitRiskAssessment(reused);

        assertFalse(arvoMain.riskAssessmentExists("INTENT-B"));
    }

    function test_ConfirmationSignature_CannotBeReusedOnAnotherIntent() public {
        _submitIntent("INTENT-A");
        _submitIntent("INTENT-B");

        TradeConfirmation memory forA = _signedConfirmation("INTENT-A");

        TradeConfirmation memory reused = _copy(forA);
        reused.intentId = "INTENT-B";

        vm.prank(owner);
        vm.expectRevert("Invalid trade confirmation signature!");
        arvoMain.submitTradeConfirmation(reused);

        assertFalse(arvoMain.tradeConfirmationExists("INTENT-B"));
    }

    function test_IntentSignature_IsBoundToTheVerifyingContract() public {
        // A signature produced for a *different* ArvoMain deployment must not work here.
        ArvoMain other = _deployOtherArvoMain();

        TradeIntent memory intent = _baseIntent(INTENT_ID);
        intent.signature = _signForContract(address(other), agentPk, _intentStructHash(intent));

        vm.prank(owner);
        vm.expectRevert("Invalid trade intent signature!");
        arvoMain.submitTradeIntent(intent);

        assertFalse(arvoMain.tradeIntentExists(INTENT_ID));
    }

    function test_IntentSignature_IsBoundToTheChainId() public {
        TradeIntent memory intent = _baseIntent(INTENT_ID);
        intent.signature = _signForChain(block.chainid + 1, agentPk, _intentStructHash(intent));

        vm.prank(owner);
        vm.expectRevert("Invalid trade intent signature!");
        arvoMain.submitTradeIntent(intent);
    }

    function _deployOtherArvoMain() internal returns (ArvoMain other) {
        vm.prank(owner);
        other = new ArvoMain(address(usdc), riskEngine, executor);
    }

    function _signForContract(address verifyingContract, uint256 pk, bytes32 structHash)
        internal
        view
        returns (bytes memory)
    {
        return _signWithDomain(block.chainid, verifyingContract, pk, structHash);
    }

    function _signForChain(uint256 chainId, uint256 pk, bytes32 structHash) internal view returns (bytes memory) {
        return _signWithDomain(chainId, address(arvoMain), pk, structHash);
    }

    function _signWithDomain(uint256 chainId, address verifyingContract, uint256 pk, bytes32 structHash)
        internal
        pure
        returns (bytes memory)
    {
        bytes32 ds = keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                keccak256(bytes("ArvoMain")),
                keccak256(bytes("1")),
                chainId,
                verifyingContract
            )
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, MessageHashUtils.toTypedDataHash(ds, structHash));
        return abi.encodePacked(r, s, v);
    }

    // Replay protection
    function test_Replay_EverySubmissionIsSingleShotPerIntent() public {
        TradeIntent memory intent = _submitIntent(INTENT_ID);
        RiskAssessment memory a = _submitAssessment(INTENT_ID);
        TradeConfirmation memory c = _submitConfirmation(INTENT_ID);

        // The exact same, still perfectly valid, payloads cannot be replayed.
        vm.prank(owner);
        vm.expectRevert("Trade intent already exists!");
        arvoMain.submitTradeIntent(intent);

        vm.prank(owner);
        vm.expectRevert("Risk assessment already submitted for the trade intent");
        arvoMain.submitRiskAssessment(a);

        vm.prank(owner);
        vm.expectRevert("Trade confirmation already submitted for the trade intent");
        arvoMain.submitTradeConfirmation(c);

        // And the insurance itself cannot be re-issued.
        vm.expectRevert("Insurance already issued for this trade intent!");
        arvoMain.evaluateTradeIntent(INTENT_ID);

        assertEq(vault.lockedAmount(address(tokenOut)), AMOUNT_OUT, "locked exactly once");
        assertEq(usdc.balanceOf(address(arvoMain)), PREMIUM, "premium taken exactly once");
    }

    // getters
    function test_Getters_ReturnStoredStructs() public {
        TradeIntent memory intent = _submitIntent(INTENT_ID);
        RiskAssessment memory a = _submitAssessment(INTENT_ID);
        TradeConfirmation memory c = _submitConfirmation(INTENT_ID);
        string memory insuranceId = _insuranceId(INTENT_ID);

        TradeIntent memory gi = arvoMain.getTradeIntent(INTENT_ID);
        assertEq(gi.id, intent.id);
        assertEq(gi.amountIn, intent.amountIn);
        assertEq(gi.deadline, intent.deadline);
        assertEq(gi.signature, intent.signature);

        RiskAssessment memory ga = arvoMain.getRiskAssessment(INTENT_ID);
        assertEq(ga.id, a.id);
        assertEq(ga.assessmentHash, a.assessmentHash);
        assertEq(ga.signature, a.signature);

        TradeConfirmation memory gc = arvoMain.getTradeConfirmation(INTENT_ID);
        assertEq(gc.id, c.id);
        assertEq(gc.transactionHash, c.transactionHash);
        assertEq(gc.signature, c.signature);

        Insurance memory gins = arvoMain.getInsurance(insuranceId);
        Insurance memory ginsByIntent = arvoMain.getInsuranceByTradeIntentId(INTENT_ID);
        assertEq(gins.id, ginsByIntent.id);
        assertEq(gins.premium, ginsByIntent.premium);
        assertEq(gins.coverage, ginsByIntent.coverage);

        Position memory gpos = arvoMain.getPosition(insuranceId);
        Position memory gposByIntent = arvoMain.getPositionByTradeIntentId(INTENT_ID);
        assertEq(gpos.id, gposByIntent.id);
        assertEq(gpos.amountOut, gposByIntent.amountOut);
        assertEq(gpos.vaultAddress, gposByIntent.vaultAddress);
    }

    function test_Getters_ReturnEmptyStructsForUnknownIds() public view {
        TradeIntent memory gi = arvoMain.getTradeIntent("nope");
        assertEq(gi.id, "");
        assertEq(gi.userAddress, address(0));
        assertEq(gi.amountIn, 0);
        assertEq(uint8(gi.status), uint8(TradeIntentStatus.PENDING)); // enum default is PENDING

        assertEq(arvoMain.getRiskAssessment("nope").id, "");
        assertEq(arvoMain.getTradeConfirmation("nope").id, "");

        Insurance memory ins = arvoMain.getInsurance("nope");
        assertEq(ins.id, "");
        assertFalse(ins.valid);

        Position memory pos = arvoMain.getPosition("nope");
        assertEq(pos.id, "");
        assertFalse(pos.isActive);

        // Unknown intent id -> empty insurance id -> empty structs.
        assertEq(arvoMain.getPositionByTradeIntentId("nope").id, "");
        assertEq(arvoMain.getInsuranceByTradeIntentId("nope").id, "");
    }

    // fuzzing
    function testFuzz_SubmitTradeIntent_EnforcesBounds(
        uint256 deadlineOffset,
        uint32 minCoverage,
        uint256 minCoverageDuration,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 maxPremium
    ) public {
        deadlineOffset = bound(deadlineOffset, 0, 365 days);
        minCoverage = uint32(bound(uint256(minCoverage), 0, 200));
        minCoverageDuration = bound(minCoverageDuration, 0, 365 days);
        amountIn = bound(amountIn, 0, type(uint128).max);
        minAmountOut = bound(minAmountOut, 0, type(uint128).max);
        maxPremium = bound(maxPremium, 0, type(uint128).max);

        TradeIntent memory intent = _baseIntent("FUZZ-INTENT");
        intent.deadline = block.timestamp + deadlineOffset;
        intent.minCoverage = minCoverage;
        intent.minCoverageDuration = minCoverageDuration;
        intent.amountIn = amountIn;
        intent.minAmountOut = minAmountOut;
        intent.maxPremium = maxPremium;
        intent.signature = _signIntent(intent, agentPk);

        bool valid =
            deadlineOffset > 0 && minCoverage <= 100 && minCoverageDuration > 0 && amountIn > 0 && minAmountOut > 0;

        vm.prank(owner);
        if (!valid) {
            vm.expectRevert();
            arvoMain.submitTradeIntent(intent);
            assertFalse(arvoMain.tradeIntentExists("FUZZ-INTENT"));
        } else {
            arvoMain.submitTradeIntent(intent);
            assertTrue(arvoMain.tradeIntentExists("FUZZ-INTENT"));
            TradeIntent memory stored = arvoMain.getTradeIntent("FUZZ-INTENT");
            assertEq(stored.amountIn, amountIn);
            assertEq(stored.minAmountOut, minAmountOut);
            assertEq(stored.maxPremium, maxPremium);
            assertEq(uint256(stored.minCoverage), uint256(minCoverage));
        }
    }

    function testFuzz_SubmitTradeConfirmation_EnforcesAmountOutFloor(uint256 amountOut) public {
        amountOut = bound(amountOut, 0, AMOUNT_IN * 2);

        _submitIntent(INTENT_ID);

        TradeConfirmation memory c = _baseConfirmation(INTENT_ID);
        c.amountOut = amountOut;
        c.signature = _signConfirmation(c, executorPk);

        vm.prank(owner);
        if (amountOut < MIN_AMOUNT_OUT) {
            vm.expectRevert("Trade confirmation does not match the trade intent!");
            arvoMain.submitTradeConfirmation(c);
            assertFalse(arvoMain.tradeConfirmationExists(INTENT_ID));
        } else {
            arvoMain.submitTradeConfirmation(c);
            assertEq(arvoMain.getTradeConfirmation(INTENT_ID).amountOut, amountOut);
        }
    }

    function testFuzz_Evaluate_ApprovesExactlyWhenEveryConditionHolds(
        uint256 premium,
        uint256 coverage,
        uint256 coverageDuration,
        uint256 riskScore
    ) public {
        // premium is kept non-zero: the vault rejects zero-amount premium
        // deductions, which is covered separately by
        // test_Evaluate_RevertsWhenPremiumIsZero
        premium = bound(premium, 1, MAX_PREMIUM * 2);
        coverage = bound(coverage, 0, 100);
        coverageDuration = bound(coverageDuration, 0, 30 days);
        riskScore = bound(riskScore, 0, 100);

        _submitIntent(INTENT_ID);
        _submitConfirmation(INTENT_ID);

        RiskAssessment memory a = _baseAssessment(INTENT_ID);
        a.premium = premium;
        a.coverage = coverage;
        a.coverageDuration = coverageDuration;
        a.riskScore = riskScore;
        a.signature = _signAssessment(a, riskEnginePk);

        vm.prank(owner);
        arvoMain.submitRiskAssessment(a);

        bool shouldApprove = coverageDuration != 0 && premium <= MAX_PREMIUM && coverage >= uint256(MIN_COVERAGE)
            && coverageDuration >= MIN_COVERAGE_DURATION && riskScore <= MAX_ALLOWED_RISK_SCORE;

        string memory insuranceId = _insuranceId(INTENT_ID);

        if (shouldApprove) {
            assertEq(uint8(arvoMain.getTradeIntent(INTENT_ID).status), uint8(TradeIntentStatus.APPROVED));
            assertTrue(arvoMain.insuranceExists(insuranceId));
            assertTrue(arvoMain.getInsurance(insuranceId).valid);
            assertTrue(arvoMain.getPosition(insuranceId).isActive);
            assertEq(vault.lockedAmount(address(tokenOut)), AMOUNT_OUT);
            assertEq(usdc.balanceOf(address(arvoMain)), premium);
            assertEq(usdc.balanceOf(vaultAddress), VAULT_USDC - premium);
        } else {
            assertEq(uint8(arvoMain.getTradeIntent(INTENT_ID).status), uint8(TradeIntentStatus.REJECTED));
            assertFalse(arvoMain.insuranceExists(insuranceId));
            assertFalse(arvoMain.getPosition(insuranceId).isActive);
            assertEq(vault.lockedAmount(address(tokenOut)), 0);
            assertEq(usdc.balanceOf(address(arvoMain)), 0);
            assertEq(usdc.balanceOf(vaultAddress), VAULT_USDC);
        }

        // Invariants that hold either way.
        RiskAssessment memory stored = arvoMain.getRiskAssessment(INTENT_ID);
        assertLe(stored.coverage, 100);
        assertLe(stored.riskScore, 100);
    }

    function testFuzz_Claim_PaysExactCoverageShare(uint256 coverage, uint256 premium) public {
        coverage = bound(coverage, uint256(MIN_COVERAGE), 100);
        premium = bound(premium, 1, MAX_PREMIUM);

        _submitIntent(INTENT_ID);
        _submitConfirmation(INTENT_ID);

        RiskAssessment memory a = _baseAssessment(INTENT_ID);
        a.coverage = coverage;
        a.premium = premium;
        a.signature = _signAssessment(a, riskEnginePk);
        vm.prank(owner);
        arvoMain.submitRiskAssessment(a);

        string memory insuranceId = _insuranceId(INTENT_ID);
        assertTrue(arvoMain.insuranceExists(insuranceId));

        uint256 expectedCoverage = AMOUNT_IN * coverage / 100;

        vm.prank(owner);
        arvoMain.claimInsurance(insuranceId);

        assertEq(tokenIn.balanceOf(vaultAddress), expectedCoverage, "exact coverage payout");
        assertEq(tokenIn.balanceOf(address(arvoMain)), ARVO_TOKEN_IN - expectedCoverage);
        assertEq(usdc.balanceOf(vaultAddress), VAULT_USDC, "premium fully refunded");
        assertEq(usdc.balanceOf(address(arvoMain)), 0);
        assertEq(vault.lockedAmount(address(tokenOut)), 0);
        assertFalse(arvoMain.getInsurance(insuranceId).valid);
        assertFalse(arvoMain.getPosition(insuranceId).isActive);
    }

    function testFuzz_Claim_RespectsCoverageWindow(uint256 elapsed) public {
        elapsed = bound(elapsed, 0, COVERAGE_DURATION * 2);

        string memory insuranceId = _issueInsurance(INTENT_ID);
        uint256 executedAt = arvoMain.getTradeConfirmation(INTENT_ID).executedAt;

        vm.warp(executedAt + elapsed);

        vm.prank(owner);
        if (elapsed <= COVERAGE_DURATION) {
            arvoMain.claimInsurance(insuranceId);
            assertFalse(arvoMain.getInsurance(insuranceId).valid);
        } else {
            vm.expectRevert("Insurance coverage duration has expired!");
            arvoMain.claimInsurance(insuranceId);
            assertTrue(arvoMain.getInsurance(insuranceId).valid);
            assertEq(vault.lockedAmount(address(tokenOut)), AMOUNT_OUT);
        }
    }
}
