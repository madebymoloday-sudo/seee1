// Загружаем back/.env — тогда можно не передавать API_URL и SUPPORT_KEY вручную
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const email = process.argv[2];
if (!email || !email.includes("@")) {
  console.error("Usage: node scripts/support-password-reset-link.js <email>");
  console.error("Env (или в back/.env): API_URL, SUPPORT_KEY или TELEGRAM_LOGIN_BOT_TOKEN");
  process.exit(1);
}
const API_URL = (process.env.API_URL || "").replace(/\/+$/, "");
const SUPPORT_KEY = process.env.SUPPORT_KEY || process.env.TELEGRAM_LOGIN_BOT_TOKEN;
if (!API_URL || !SUPPORT_KEY) {
  console.error("Нужны API_URL и SUPPORT_KEY (или TELEGRAM_LOGIN_BOT_TOKEN). Добавь их в back/.env");
  process.exit(1);
}
const url = API_URL + "/api/v1/auth/support/password-reset-link";
fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-support-key": SUPPORT_KEY },
  body: JSON.stringify({ email: email.trim().toLowerCase(), expiresInMinutes: 60 }),
})
  .then(function (r) {
    if (!r.ok) return r.text().then(function (t) { throw new Error(r.status + " " + t); });
    return r.json();
  })
  .then(function (d) {
    console.log(d.resetLink);
    console.error("Expires:", d.expiresAt);
  })
  .catch(function (e) {
    console.error(e.message);
    process.exit(1);
  });
