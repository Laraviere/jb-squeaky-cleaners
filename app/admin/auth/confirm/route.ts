import { NextResponse, type NextRequest } from "next/server";
import {
  adminClient,
  eligibleStaff,
  type StaffIdentity,
} from "@/lib/admin/server";
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  if (tokenHash && tokenHash.length < 2000 && type === "invite") {
    const client = await adminClient();
    const { error } = await client.auth.verifyOtp({
      token_hash: tokenHash,
      type: "invite",
    });
    if (!error) {
      // Authorize using the same verified session. Redirects stay on the browser's origin.
      const {
        data: { user },
        error: userError,
      } = await client.auth.getUser();
      const membership = await client.rpc("admin_identity");
      if (
        !userError &&
        user &&
        !membership.error &&
        eligibleStaff(membership.data as StaffIdentity | null)
      )
        return new NextResponse(null, {
          status: 303,
          headers: { Location: "/admin/setup" },
        });
      await client.auth.signOut({ scope: "local" });
    }
  }
  return new NextResponse(null, {
    status: 303,
    headers: { Location: "/admin/login?reason=invite" },
  });
}
