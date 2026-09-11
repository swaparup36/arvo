import { NextResponse } from "next/server";

// GET (fetch vaults by user address)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userAddress = searchParams.get("userAddress");

    if (!userAddress) {
      return NextResponse.json(
        { error: "Missing userAddress parameter" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        vaults: [],
        userAddress,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error fetching vaults:", error);
    return NextResponse.json(
      { error: "Failed to fetch vaults" },
      { status: 500 },
    );
  }
}
