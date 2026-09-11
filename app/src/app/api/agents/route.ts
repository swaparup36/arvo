import { prisma } from "@/lib/prisma";


// GET (fetch) all agents
export async function GET(request: Request) {
    try {
        // get userId from the request headers
        const userAddress = request.headers.get("userAddress");

        if (!userAddress) {
            return new Response(JSON.stringify({ error: "Missing userId in request headers" }), { status: 400 });
        }

        const user = await prisma.user.findUnique({
            where: {
                address: userAddress,
            },
        });

        if (!user) {
            return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });
        }

        const userId = user.id;
        
        // fetch all agents for the given userId from the database
        const agents = await prisma.agent.findMany({
            where: {
                userId: userId,
            },
        });

        return new Response(JSON.stringify(agents), { status: 200 });
    } catch (error) {
        console.error("Error fetching agents:", error);
        return new Response(JSON.stringify({ error: "Failed to fetch agents" }), { status: 500 });
    }
}