import { NextResponse, type NextRequest } from "next/server";
import { adminClient, eligibleStaff, type StaffIdentity } from "@/lib/admin/server";
import { beginRecovery, clearRecovery, recoverySession } from "@/lib/admin/recovery";

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  if (tokenHash && tokenHash.length < 2000 && type === "recovery") {
    const client = await adminClient();
    try {
      await clearRecovery();
      const { error } = await client.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
      if (!error) {
        const { data: { user }, error: userError } = await client.auth.getUser();
        const membership = await client.rpc("admin_identity");
        if (!userError && user && !membership.error && eligibleStaff(membership.data as StaffIdentity | null)) {
          const session = await recoverySession(client);
          if (session.recovery && session.userId === user.id) {
            await beginRecovery(user.id, session.sessionId);
            return new NextResponse(null, { status: 303, headers: { Location: "/admin/setup" } });
          }
        }
      }
    } catch { /* Never log tokens, session contents, or applicant information. */ }
    await client.auth.signOut({ scope: "local" });
  }
  return new NextResponse(null, { status: 303, headers: { Location: "/admin/forgot-password?reason=recovery" } });
}
