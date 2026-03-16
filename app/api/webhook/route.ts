import { NextResponse } from "next/server";
import { verifyVimeoSignature } from "@/lib/auth";
import { handleWebhookEvent } from "@/lib/webhook-handler";

export const maxDuration = 60;

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-vimeo-signature");

  // Verify webhook signature
  const isValid = await verifyVimeoSignature(rawBody, signature);
  if (!isValid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    const payload = JSON.parse(rawBody);

    // Vimeo webhook validation request — just return 200
    if (payload.challenge) {
      return NextResponse.json({ challenge: payload.challenge });
    }

    const event = payload.event as string;
    const resourceUri = payload.resource_uri || payload.clip?.uri || "";

    if (!event) {
      return NextResponse.json(
        { error: "Missing event type" },
        { status: 400 }
      );
    }

    const result = await handleWebhookEvent(event, resourceUri);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Webhook error:", err);
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
