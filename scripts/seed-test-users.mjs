import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const accounts = [
  ["member", process.env.SEED_MEMBER_EMAIL, process.env.SEED_MEMBER_PASSWORD, "Test Member"],
  ["admin", process.env.SEED_ADMIN_EMAIL, process.env.SEED_ADMIN_PASSWORD, "Test Admin"],
  ["super_admin", process.env.SEED_SUPER_ADMIN_EMAIL, process.env.SEED_SUPER_ADMIN_PASSWORD, "Test Super Admin"],
];

if (!url || !serviceKey) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.");
  process.exit(1);
}

for (const [, email, password] of accounts) {
  if (!email || !password) {
    console.error("Set SEED_MEMBER_*, SEED_ADMIN_*, and SEED_SUPER_ADMIN_* in .env.local.");
    process.exit(1);
  }
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: listed, error: listError } = await admin.auth.admin.listUsers({
  page: 1,
  perPage: 200,
});

if (listError) {
  console.error(listError.message);
  process.exit(1);
}

for (const [role, email, password, fullName] of accounts) {
  let user = listed.users.find((entry) => entry.email?.toLowerCase() === email.toLowerCase());
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error || !data.user) {
      console.error(error?.message ?? "Could not create user.");
      process.exit(1);
    }
    user = data.user;
  }

  const { data: existing, error: readError } = await admin
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (readError) {
    console.error(readError.message);
    process.exit(1);
  }

  const write = existing
    ? admin.from("profiles").update({ role, full_name: fullName }).eq("user_id", user.id)
    : admin.from("profiles").insert({
        user_id: user.id,
        full_name: fullName,
        email,
        role,
      });

  const { error } = await write;

  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  console.log(`${email} -> ${role}`);
}
