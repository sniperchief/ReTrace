import { getAuth } from "@/server/auth";
import { wakeInference } from "@/server/inference";

/** Pings the inference host so a sleeping free Space starts loading. Signed-in users only. */
export async function POST(request: Request) {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  await wakeInference();
  return new Response(null, { status: 204 });
}
