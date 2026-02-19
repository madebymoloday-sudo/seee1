const email = process.argv[2];
if (!email || !email.includes("@")) {
  console.error("Usage: API_URL=<url> SUPPORT_KEY=<key> node scripts/support-password-reset-link.js <email>");
  process.exit(1);
}
const API_URL = (process.env.API_URL || "").replace(/\/+$/, "");
const SUPPORT_KEY = process.env.SUPPORT_KEY || process.env.TELEGRAM_LOGIN_BOT_TOKEN;
if (!API_URL || !SUPPORT_KEY) {
  console.error("Set API_URL and SUPPORT_KEY");
  process.exit(1);
}
const url = API_URL + "/api/v1/auth/support/password-reset-link";
fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-support-key": SUPPORT_KEY },
  body: JSON.stringify({ email: email.trim(), expiresInMinutes: 60 }),
}).then(function (r) {
  if (!r.ok) return r.text().then(function (t) { throw new Error(r.status + " " + t); });
  return r.json();
}).then(function (d) {
  console.log("Reset link:", d.resetLink);
  console.log("Expires:", d.expiresAt);
}).catch(function (e) {
  console.error(e.message);
  process.exit(1);
});
