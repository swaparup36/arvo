import { prisma } from "@/lib/prisma";


// GET (fetch) agent by id
export async function GET(request: Request) {
    try {
        // get userId from the request headers
        const userAddress = request.headers.get("userAddress");
        const agentId = request.headers.get("agentId");

        if (!userAddress) {
            return new Response(JSON.stringify({ error: "Missing userId in request headers" }), { status: 400 });
        }

        if (!agentId) {
            return new Response(JSON.stringify({ error: "Missing agentId in request headers" }), { status: 400 });
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

        // fetch the agent for the given userId and agentId from the database
        const agent = await prisma.agent.findFirst({
            where: {
                id: agentId,
                userId: userId,
            },
        });

        if (!agent) {
            return new Response(JSON.stringify({ error: "Agent not found" }), { status: 404 });
        }

        return new Response(JSON.stringify(agent), { status: 200 });
    } catch (error) {
        console.error("Error fetching agents:", error);
        return new Response(JSON.stringify({ error: "Failed to fetch agents" }), { status: 500 });
    }
}