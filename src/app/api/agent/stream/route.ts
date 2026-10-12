import { handleQuerySocket } from "@/app/services/querySocket";
import { isSameHostOrigin } from "@/app/services/requestOrigin";
import { MAX_REQUEST_PAYLOAD_BYTES } from "@/app/types/queryProtocol";
import { experimental_upgradeWebSocket } from "@vercel/functions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const origin = request.headers.get("origin");
  if (
    !origin ||
    !isSameHostOrigin(origin, request.headers.get("host") ?? undefined)
  ) {
    return new Response("Cross-site requests are not allowed.", {
      status: 403,
    });
  }
  if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
    return new Response("A WebSocket connection is required.", { status: 426 });
  }
  return experimental_upgradeWebSocket(handleQuerySocket, {
    maxPayload: MAX_REQUEST_PAYLOAD_BYTES,
  });
}
