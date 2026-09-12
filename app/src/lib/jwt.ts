import jwt from "jsonwebtoken";
import { env } from "./env";

const JWT_SECRET = env.JWT_SECRET!;

export function createToken(userId: string, agentId?: string) {
  return jwt.sign(
    { userId, agentId },
    JWT_SECRET,
    { expiresIn: "1h" }
  );
}

export function verifyToken(token: string) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    if (typeof decoded === "string") {
      return null;
    }

    return decoded as { userId: string; agentId?: string };
  } catch {
    return null;
  }
}