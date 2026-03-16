/**
 * Simple admin password protection.
 * Checks the Authorization header for a Bearer token matching ADMIN_PASSWORD.
 */
export function verifyAdmin(request: Request): boolean {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return true; // No password configured = no auth required

  const authHeader = request.headers.get("authorization");
  if (!authHeader) return false;

  const token = authHeader.replace("Bearer ", "");
  return token === password;
}

/**
 * Verify Vimeo webhook signature.
 */
export async function verifyVimeoSignature(
  rawBody: string,
  signature: string | null
): Promise<boolean> {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return true; // No secret configured = skip verification

  if (!signature) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(rawBody)
  );

  const expectedSig = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time comparison
  if (expectedSig.length !== signature.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expectedSig.length; i++) {
    mismatch |= expectedSig.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return mismatch === 0;
}
