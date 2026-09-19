#!/usr/bin/env node
// Set (or reset) the web administrator's password.
//
//   pnpm admin:password <email>
//
// Run it in your own terminal: it prompts for the password twice, and nothing
// it reads is ever printed. It needs the project's secret key, which it gets
// from the logged-in Supabase CLI (`supabase login`), or from
// SUPABASE_SECRET_KEY, or by asking for it (hidden input).
//
// It only changes the password. Whether the account may enter /admin is
// `profiles.is_admin`, granted separately through SQL (docs/shared-database.md).
import { execFileSync } from "node:child_process"
import { createClient } from "@supabase/supabase-js"
import { askHidden } from "./hidden-input.mjs"

const PROJECT_REF = "zgnmajovyqibgxlcomvb"
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`
const MIN_LENGTH = 12

function fail(message) {
  console.error(`✗ ${message}`)
  process.exit(1)
}

async function ask(label) {
  try {
    return await askHidden(label)
  } catch (error) {
    fail(error.message)
  }
}

/** A usable secret key from the logged-in CLI, or null. Never printed. */
function secretKeyFromCli() {
  let keys
  try {
    const out = execFileSync(
      "supabase",
      ["projects", "api-keys", "--project-ref", PROJECT_REF, "-o", "json"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    )
    keys = JSON.parse(out)
  } catch {
    return null
  }
  if (!Array.isArray(keys)) return null
  const values = keys.map((k) => ({ name: String(k?.name ?? ""), value: String(k?.api_key ?? "") }))
  // A masked key (the CLI may hide secrets) is useless; require the full value.
  const unmasked = (v) => /^[\w.-]+$/.test(v) && v.length > 40
  const secret = values.find((k) => k.value.startsWith("sb_secret_") && unmasked(k.value))
  if (secret) return secret.value
  const legacy = values.find((k) => k.name === "service_role" && unmasked(k.value))
  return legacy ? legacy.value : null
}

const email = (process.argv[2] ?? "").trim().toLowerCase()
if (!email || email.startsWith("-")) fail("Usage: pnpm admin:password <email>")

let secretKey = process.env.SUPABASE_SECRET_KEY || secretKeyFromCli()
if (secretKey) {
  console.log("• Secret key: found (not shown)")
} else {
  console.log("• No secret key from the Supabase CLI. Copy it from the dashboard:")
  console.log("  Project Settings → API Keys → Secret keys.")
  secretKey = (await ask("  Secret key: ")).trim()
  if (!secretKey) fail("No secret key.")
}

const admin = createClient(SUPABASE_URL, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

console.log("• Looking up the account…")

// 46 users today; one page of 1000 is plenty for a club.
const { data: list, error: listError } = await admin.auth.admin.listUsers({
  page: 1,
  perPage: 1000,
})
if (listError) fail(`Could not list users: ${listError.message}`)
const user = list.users.find((u) => (u.email ?? "").toLowerCase() === email)
if (!user) fail(`No account with the email ${email}.`)

const { data: profile } = await admin
  .from("profiles")
  .select("display_name, is_admin")
  .eq("user_id", user.id)
  .maybeSingle()
console.log(`• Account: ${profile?.display_name ?? "(no profile)"} <${email}> (${user.id})`)
if (profile?.is_admin !== true) {
  console.log("  Note: this account is not an admin yet, so /admin will refuse it until")
  console.log("  profiles.is_admin is granted.")
}

console.log("")
const passwordLabel = `New password (at least ${MIN_LENGTH} characters): `
const password = await ask(passwordLabel)
if (password.length < MIN_LENGTH) {
  fail(
    `Too short (${password.length} characters): use at least ${MIN_LENGTH}. Nothing was changed.`
  )
}
const again = await ask("Repeat it: ".padEnd(passwordLabel.length))
if (again !== password) fail("The two entries differ. Nothing was changed.")

const { error: updateError } = await admin.auth.admin.updateUserById(user.id, { password })
if (updateError) fail(`Could not set the password: ${updateError.message}`)
console.log(`✓ Password set for ${email}. Sign in at /admin/login.`)
