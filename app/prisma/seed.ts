import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient, TradeIntentStatus } from "@prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const userAddress = "0x742d35Cc6634C0532925a3b844Bc454e4604e";
  const agentAddress = "0xA1C2B3D4E5F6789012345678901234567890ABCD";
  const vaultAddress = "0x8d7d5E1E7ad990485d8E1b1A66D3A4FD5C9f0733";

  const user = await prisma.user.upsert({
    where: { address: userAddress },
    update: {},
    create: {
      id: "user-demo-1",
      address: userAddress,
    },
  });

  await prisma.agent.upsert({
    where: { address: agentAddress },
    update: {},
    create: {
      id: "agent-demo-1",
      userId: user.id,
      vaultAddress,
      address: agentAddress,
      privateKey:
        "0x1111111111111111111111111111111111111111111111111111111111111111",
    },
  });

  const now = new Date();

  await prisma.tradeIntent.createMany({
    data: [
      {
        userAddress,
        agentAddress,
        vaultAddress,
        chainId: 11155111,
        tokenIn: "0x0000000000000000000000000000000000000000",
        tokenOut: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
        amountIn: BigInt("2000000000000000000"),
        minAmountOut: BigInt("1800000000"),
        deadline: new Date(Date.now() + 1000 * 60 * 60 * 24),
        maxPremium: BigInt("20000000000000000"),
        minCoverage: new Prisma.Decimal("12.5"),
        minCoverageDuration: BigInt("86400"),
        signature: "0x" + "aa".repeat(65),
        status: TradeIntentStatus.PENDING,
        createdAt: now,
        updatedAt: now,
      },
      {
        userAddress,
        agentAddress,
        vaultAddress,
        chainId: 11155111,
        tokenIn: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
        tokenOut: "0x0000000000000000000000000000000000000000",
        amountIn: BigInt("1500000000"),
        minAmountOut: BigInt("1200000000000000000"),
        deadline: new Date(Date.now() + 1000 * 60 * 60 * 48),
        maxPremium: BigInt("15000000000000000"),
        minCoverage: new Prisma.Decimal("9.5"),
        minCoverageDuration: BigInt("172800"),
        signature: "0x" + "bb".repeat(65),
        status: TradeIntentStatus.APPROVED,
        createdAt: new Date(Date.now() - 1000 * 60 * 30),
        updatedAt: new Date(Date.now() - 1000 * 60 * 30),
      },
      {
        userAddress,
        agentAddress,
        vaultAddress,
        chainId: 11155111,
        tokenIn: "0x0000000000000000000000000000000000000000",
        tokenOut: "0xCbb7C0000dB88B473b1fC8f7f5Ac3Eb2f7db7E0F",
        amountIn: BigInt("5000000000000000000"),
        minAmountOut: BigInt("900000000000000000"),
        deadline: new Date(Date.now() + 1000 * 60 * 60 * 72),
        maxPremium: BigInt("30000000000000000"),
        minCoverage: new Prisma.Decimal("15.25"),
        minCoverageDuration: BigInt("259200"),
        signature: "0x" + "cc".repeat(65),
        status: TradeIntentStatus.REJECTED,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
        updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
      },
    ],
    skipDuplicates: true,
  });

  console.log("Seed data inserted successfully.");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
