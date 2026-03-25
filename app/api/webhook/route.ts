import { NextResponse } from "next/server";
import { verifyVimeoSignature } from "@/lib/auth";
import { handleWebhookEvent } from "@/lib/webhook-handler";

export const maxDuration = 60;

export async function POST(request: Request) {
  const receivedAt = new Date().toISOString();
  const rawBody = await request.text();
  const signature = request.headers.get("x-vimeo-signature");

  console.log(`[webhook ${receivedAt}] Incoming POST, body length: ${rawBody.length}, has signature: ${!!signature}`);

  // Verify webhook signature
  const isValid = await verifyVimeoSignature(rawBody, signature);
  if (!isValid) {
    console.warn(`[webhook ${receivedAt}] Signature verification FAILED`);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    const payload = JSON.parse(rawBody);

    // Vimeo webhook validation request — just return 200
    if (payload.challenge) {
      console.log(`[webhook ${receivedAt}] Challenge request received, responding`);
      return NextResponse.json({ challenge: payload.challenge });
    }

    // App webhooks use webhook_type + video object;
    // legacy webhooks use event + resource_uri
    const event =
      payload.webhook_type || payload.event || (payload.type as string);
    const resourceUri =
      payload.video?.uri ||
      payload.resource_uri ||
      payload.clip?.uri ||
      "";

    if (!event) {
      console.warn(`[webhook ${receivedAt}] No event type in payload:`, JSON.stringify(payload).slice(0, 500));
      return NextResponse.json(
        { error: "Missing event type" },
        { status: 400 }
      );
    }

    console.log(`[webhook ${receivedAt}] Event: ${event}, Resource: ${resourceUri}`);
    const result = await handleWebhookEvent(event, resourceUri);
    console.log(`[webhook ${receivedAt}] Result: ${result.action}, success: ${result.success}`);
    return NextResponse.json(result);
  } catch (err) {
    console.error(`[webhook ${receivedAt}] Unhandled error:`, err instanceof Error ? err.stack : String(err));
    return NextResponse.json(
      {
        error: "Webhook processing failed",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

// Vimeo may send a GET request to verify the webhook URL
export async function GET() {
  return NextResponse.json({ status: "Webhook endpoint active" });
}
