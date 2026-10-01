import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const stamp = Date.now();
const password = randomBytes(18).toString("base64url");
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

function client() {
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function account(label) {
  const supabase = client();
  const email = `harbor.qa.${label}.${stamp}@example.com`;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: `QA Test ${label}` } },
  });
  if (error || !data.session) throw new Error(`signup ${label}: ${error?.message ?? "no session"}`);
  return { supabase, id: data.user.id, email };
}

const a = await account("memberA");
const b = await account("memberB");
console.log(`Test accounts: ${a.email}, ${b.email}`);

const own = await a.supabase.from("profiles").select("id, full_name, role").eq("user_id", a.id).maybeSingle();
check("signup creates a member profile", own.data?.role === "member", own.error?.message);

const list = await a.supabase.from("profiles").select("user_id, role");
check("member list loads", !list.error, list.error?.message);
check("member sees only member rows", (list.data ?? []).every((row) => row.role === "member"));
check("member sees another member", (list.data ?? []).some((row) => row.user_id === b.id));

const email = await a.supabase.from("profiles").select("email").eq("user_id", a.id);
check("email column is not readable", Boolean(email.error), email.error?.code);

const rename = await a.supabase.from("profiles").update({ full_name: "QA Test memberA Renamed" }).eq("user_id", a.id).select("id");
check("member updates own name", !rename.error && rename.data?.length === 1, rename.error?.message);

const role = await a.supabase.from("profiles").update({ role: "admin" }).eq("user_id", a.id).select("id");
check("member cannot change own role", Boolean(role.error) || !role.data?.length, role.error?.code);

const other = await a.supabase.from("profiles").update({ full_name: "hacked" }).eq("user_id", b.id).select("id");
check("member cannot rename another member", !other.data?.length, other.error?.code);

const otherDelete = await a.supabase.from("profiles").delete().eq("user_id", b.id).select("id");
check("member cannot delete another member", !otherDelete.data?.length, otherDelete.error?.code);

const rpc = await a.supabase.rpc("set_profile_role", { target_user_id: b.id, new_role: "admin" });
check("member cannot call role change", Boolean(rpc.error), rpc.error?.message);

const activity = await a.supabase.from("profile_activity").select("id");
check("member reads no activity", !activity.error && activity.data?.length === 0, activity.error?.message);

const forged = await a.supabase.from("profile_activity").insert({
  actor_user_id: a.id,
  action: "profile_updated",
  target_user_id: a.id,
  target_role: "member",
});
check("member cannot write activity", Boolean(forged.error), forged.error?.code);

const upload = await a.supabase.storage.from("profile-images").upload(`${a.id}/avatar.png`, png, {
  contentType: "image/png",
  upsert: true,
});
check("member uploads own photo", !upload.error, upload.error?.message);

const avatar = await a.supabase.from("profiles").update({ avatar_url: `${a.id}/avatar.png` }).eq("user_id", a.id).select("id");
check("member saves own photo path", !avatar.error && avatar.data?.length === 1, avatar.error?.message);

const replace = await a.supabase.storage.from("profile-images").upload(`${a.id}/avatar.png`, png, {
  contentType: "image/png",
  upsert: true,
});
check("member replaces own photo", !replace.error, replace.error?.message);

const foreign = await a.supabase.storage.from("profile-images").upload(`${b.id}/avatar.png`, png, {
  contentType: "image/png",
  upsert: true,
});
check("member cannot upload into another folder", Boolean(foreign.error), foreign.error?.message);

const view = await b.supabase.storage.from("profile-images").download(`${a.id}/avatar.png`);
check("member can view another member photo", !view.error && Boolean(view.data), view.error?.message);

const foreignRemove = await b.supabase.storage.from("profile-images").remove([`${a.id}/avatar.png`]);
const stillThere = await a.supabase.storage.from("profile-images").download(`${a.id}/avatar.png`);
check(
  "member cannot delete another member photo",
  !stillThere.error && Boolean(stillThere.data),
  foreignRemove.error?.message,
);

const anon = await client().from("profiles").select("id");
check("signed-out request is refused", Boolean(anon.error), anon.error?.code);

const anonImage = await client().storage.from("profile-images").download(`${a.id}/avatar.png`);
check("signed-out photo download is refused", Boolean(anonImage.error));

const remove = await a.supabase.storage.from("profile-images").remove([`${a.id}/avatar.png`]);
const cleared = await a.supabase.from("profiles").update({ avatar_url: null }).eq("user_id", a.id).select("id");
check("member deletes own photo", !remove.error && !cleared.error, remove.error?.message ?? cleared.error?.message);

const feed = await a.supabase.from("profiles").select("full_name").eq("user_id", a.id).maybeSingle();
check("name change persisted", feed.data?.full_name === "QA Test memberA Renamed");

const delB = await b.supabase.from("profiles").delete().eq("user_id", b.id).select("id");
check("member deletes own profile", !delB.error && delB.data?.length === 1, delB.error?.message);

const recreate = await b.supabase.from("profiles").insert({ user_id: b.id, full_name: "QA Test memberB" }).select("role");
check("member recreates own profile as member", recreate.data?.[0]?.role === "member", recreate.error?.message);

const failed = results.filter((item) => !item.ok).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
