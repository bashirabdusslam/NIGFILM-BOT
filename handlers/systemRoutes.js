import { bot } from "../bot.js";

// ======================================================
// SYSTEM / SERVICE ROUTES
// ======================================================

export default function registerSystemRoutes(app) {

  // ====================================================
  // TELEGRAM WEBHOOK
  // ====================================================

  app.post(
    "/telegram-webhook",
    async (req, res) => {
      try {
        await bot.handleUpdate(
          req.body
        );

        return res.sendStatus(200);
      } catch (error) {
        console.error(
          "❌ TELEGRAM WEBHOOK ERROR:",
          error
        );

        return res.sendStatus(500);
      }
    }
  );

  // ====================================================
  // ROOT HEALTH CHECK
  // ====================================================

  app.get(
    "/",
    (req, res) => {
      return res
        .status(200)
        .json({
          success: true,
          service: "NIGFILM",

          message:
            "✅ NIGFILM BOT & WEB API suna aiki!",
        });
    }
  );

  // ====================================================
  // API HEALTH CHECK
  // ====================================================

  app.get(
    "/api/health",
    (req, res) => {
      return res
        .status(200)
        .json({
          success: true,

          service:
            "NIGFILM API",

          database:
            "PostgreSQL",

          status:
            "online",
        });
    }
  );

  // ====================================================
  // TELEGRAM PAYMENT SUCCESS PAGE
  // ====================================================

  app.get(
    "/payment-success",
    (req, res) => {
      return res
        .status(200)
        .send(`
<!DOCTYPE html>

<html lang="en">

<head>

<meta charset="UTF-8" />

<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0"
/>

<title>
Payment Successful
</title>

<style>

body {
  margin: 0;
  min-height: 100vh;

  display: flex;
  align-items: center;
  justify-content: center;

  background: #0b0b0d;
  color: white;

  font-family:
    Arial,
    sans-serif;
}

.card {
  width: 90%;
  max-width: 450px;

  padding: 32px;

  border-radius: 20px;

  background: #18181b;

  text-align: center;

  box-shadow:
    0 20px 50px
    rgba(0, 0, 0, 0.35);
}

.icon {
  font-size: 58px;
}

h1 {
  color: #22c55e;
}

p {
  color: #d4d4d8;
  line-height: 1.7;
}

a {
  display: inline-block;

  margin-top: 16px;

  padding: 13px 24px;

  border-radius: 12px;

  background: #d4af37;

  color: #080808;

  text-decoration: none;

  font-weight: bold;
}

</style>

</head>

<body>

<div class="card">

<div class="icon">
✅
</div>

<h1>
Payment Successful
</h1>

<p>
An karɓi biyan kuɗinka cikin nasara.
Ka koma Telegram domin karɓar film ɗinka.
</p>

<a href="https://t.me/Nigfilm_bot">
Buɗe NIGFILM BOT
</a>

</div>

</body>

</html>
        `);
    }
  );
}