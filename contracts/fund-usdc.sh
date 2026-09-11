#!/bin/bash

set -e

RPC="http://127.0.0.1:8545"

USDC="0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
POOL="0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640"
USER="0x90F79bf6EB2c4f870365E785982E1f101E93b906"

# 1,000 USDC = 1,000,000,000 (USDC has 6 decimals)
AMOUNT="1000000000"

echo "======================================"
echo " Funding local Anvil account with USDC"
echo "======================================"

echo ""
echo "Checking USDC balance of source account..."

BALANCE=$(cast call "$USDC" \
    "balanceOf(address)(uint256)" \
    "$POOL" \
    --rpc-url "$RPC")

echo "Pool USDC balance: $BALANCE"

if [ "$BALANCE" -lt "$AMOUNT" ]; then
    echo "ERROR: Pool does not have enough USDC"
    exit 1
fi

echo ""
echo "Giving source account 1 ETH for gas..."

cast rpc anvil_setBalance \
    "$POOL" \
    0xDE0B6B3A7640000 \
    --rpc-url "$RPC"

echo "Done."

echo ""
echo "Impersonating source account..."

cast rpc anvil_impersonateAccount \
    "$POOL" \
    --rpc-url "$RPC"

echo ""
echo "Transferring 1,000 USDC..."

cast send "$USDC" \
    "transfer(address,uint256)" \
    "$USER" \
    "$AMOUNT" \
    --from "$POOL" \
    --unlocked \
    --rpc-url "$RPC"

echo ""
echo "Verifying user USDC balance..."

USER_BALANCE=$(cast call "$USDC" \
    "balanceOf(address)(uint256)" \
    "$USER" \
    --rpc-url "$RPC")

echo ""
echo "======================================"
echo " User USDC balance: $USER_BALANCE"
echo "======================================"

if [ "$USER_BALANCE" -ge "$AMOUNT" ]; then
    echo ""
    echo "SUCCESS: User now has at least 1,000 USDC"
else
    echo ""
    echo "ERROR: USDC transfer did not succeed"
    exit 1
fi

echo ""
echo "Stopping impersonation..."

cast rpc anvil_stopImpersonatingAccount \
    "$POOL" \
    --rpc-url "$RPC"

echo ""
echo "Done."