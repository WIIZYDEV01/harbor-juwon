import { NextResponse } from "next/server";
import { PROFILE_BUCKET } from "@/lib/profile/images";
import { ERRORS } from "@/lib/profile/messages";
import { imageContentType, isUuid, sniffImage } from "@/lib/profile/validate";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const privateHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

function denied() {
  return new NextResponse(ERRORS.permission, {
    status: 403,
    headers: {
      ...privateHeaders,
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!isUuid(id)) return denied();

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return denied();

  const { data, error } = await supabase
    .from("profiles")
    .select("avatar_url")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return denied();
  if (!data.avatar_url) {
    return new NextResponse("No profile image.", {
      status: 404,
      headers: {
        ...privateHeaders,
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  const { data: file, error: downloadError } = await supabase.storage
    .from(PROFILE_BUCKET)
    .download(data.avatar_url);

  if (downloadError || !file) return denied();

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffImage(bytes);
  if (!kind) return denied();

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      ...privateHeaders,
      // Image URLs carry ?v=updated_at, so a changed photo gets a new URL.
      "Cache-Control": "private, max-age=600",
      "Content-Type": imageContentType(kind),
    },
  });
}
