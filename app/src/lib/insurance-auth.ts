import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";

// Checks that the request is authenticated and that the user owns the trade intent. Returns a NextResponse if not, or null if the user is authorized
export async function requireIntentOwner(
  req: Request,
  tradeIntentId: string,
  chainId: number,
): Promise<NextResponse | null> {
  const decoded = verifyToken(
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "",
  );

  if (!decoded) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [user, intent] = await Promise.all([
    prisma.user.findUnique({ where: { id: decoded.userId } }),
    prisma.tradeIntent.findUnique({ where: { id: tradeIntentId } }),
  ]);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!intent || intent.chainId !== chainId) {
    return NextResponse.json(
      { error: "Trade intent not found" },
      { status: 404 },
    );
  }

  // Check if the user is the owner of the trade intent or an agent associated with it
  const agent =
    intent.userAddress.toLowerCase() === user.address.toLowerCase()
      ? null
      : await prisma.agent.findUnique({
          where: { address: intent.agentAddress },
          select: { userId: true },
        });

  if (
    intent.userAddress.toLowerCase() !== user.address.toLowerCase() &&
    agent?.userId !== user.id
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return null;
}
