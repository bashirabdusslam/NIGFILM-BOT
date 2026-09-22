import crypto from "crypto";
import { Readable } from "node:stream";
import { prisma } from "../bot.js";

// ======================================================
// HELPERS
// ======================================================

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ======================================================
// TELEGRAM WEB ROUTES
// ======================================================

export default function registerTelegramWebHandlers(app) {

  // ====================================================
  // TELEGRAM PURCHASE DOWNLOAD
  // ====================================================

  app.get(
    "/api/telegram/movies/:filmId/download",
    async (req, res) => {
      try {
        const filmId =
          Number(req.params.filmId);

        const telegramId =
          String(
            req.query.telegramId || ""
          ).trim();

        if (
          !Number.isInteger(filmId) ||
          filmId <= 0 ||
          !telegramId
        ) {
          return res
            .status(400)
            .send("Invalid request.");
        }

        const purchase =
          await prisma.purchase.findFirst({
            where: {
              telegramId,
              filmId,
            },

            include: {
              film: true,
            },
          });

        if (!purchase) {
          return res
            .status(403)
            .send(
              "Ba ka sayi wannan film ba."
            );
        }

        const film =
          purchase.film;

        if (!film?.bunnyVideoId) {
          return res
            .status(404)
            .send(
              "Ba a samu video ɗin wannan film ba."
            );
        }

        const hostname =
          process.env
            .BUNNY_STREAM_CDN_HOSTNAME;

        const tokenKey =
          process.env
            .BUNNY_STREAM_TOKEN_KEY;

        if (
          !hostname ||
          !tokenKey
        ) {
          console.error(
            "BUNNY DOWNLOAD CONFIG MISSING"
          );

          return res
            .status(500)
            .send(
              "Download config bai cika ba."
            );
        }

        const cleanHostname =
          hostname
            .replace(
              /^https?:\/\//,
              ""
            )
            .replace(
              /\/+$/,
              ""
            );

        const filePath =
          `/${film.bunnyVideoId}/play_720p.mp4`;

        // Signed URL expires in 1 hour.
        const expires =
          Math.floor(
            Date.now() / 1000
          ) +
          60 * 60;

        const tokenBase =
          tokenKey +
          filePath +
          expires;

        const token =
          crypto
            .createHash("sha256")
            .update(tokenBase)
            .digest("base64")
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=/g, "");

        const bunnyUrl =
          `https://${cleanHostname}${filePath}` +
          `?token=${token}` +
          `&expires=${expires}`;

        // ===============================================
        // SUPPORT RESUME / RANGE
        // ===============================================

        const requestHeaders = {};

        const range =
          req.headers.range;

        if (range) {
          requestHeaders.Range =
            range;
        }

        const bunnyResponse =
          await fetch(
            bunnyUrl,
            {
              headers:
                requestHeaders,
            }
          );

        if (
          !bunnyResponse.ok &&
          bunnyResponse.status !== 206
        ) {
          console.error(
            "BUNNY DOWNLOAD FETCH ERROR:",
            bunnyResponse.status
          );

          return res
            .status(
              bunnyResponse.status
            )
            .send(
              "An kasa ɗauko film daga server."
            );
        }

        const safeTitle =
          String(
            film.title ||
            `NIGFILM-${film.id}`
          )
            .replace(
              /[<>:"/\\|?*\x00-\x1F]/g,
              ""
            )
            .trim() ||
          `NIGFILM-${film.id}`;

        res.status(
          bunnyResponse.status
        );

        res.setHeader(
          "Content-Type",
          bunnyResponse.headers.get(
            "content-type"
          ) ||
            "video/mp4"
        );

        res.setHeader(
          "Access-Control-Allow-Origin",
          "https://web.telegram.org"
        );

        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${safeTitle}.mp4"`
        );

        const contentLength =
          bunnyResponse.headers.get(
            "content-length"
          );

        if (contentLength) {
          res.setHeader(
            "Content-Length",
            contentLength
          );
        }

        const contentRange =
          bunnyResponse.headers.get(
            "content-range"
          );

        if (contentRange) {
          res.setHeader(
            "Content-Range",
            contentRange
          );
        }

        const acceptRanges =
          bunnyResponse.headers.get(
            "accept-ranges"
          );

        if (acceptRanges) {
          res.setHeader(
            "Accept-Ranges",
            acceptRanges
          );
        } else {
          res.setHeader(
            "Accept-Ranges",
            "bytes"
          );
        }

        res.setHeader(
          "Cache-Control",
          "private, no-store"
        );

        if (!bunnyResponse.body) {
          return res
            .status(502)
            .end();
        }

        // Stream directly — no full movie buffering.
        const stream =
          Readable.fromWeb(
            bunnyResponse.body
          );

        stream.on(
          "error",
          (error) => {
            console.error(
              "DOWNLOAD STREAM ERROR:",
              error
            );

            if (!res.headersSent) {
              res.sendStatus(500);
            } else {
              res.destroy(
                error
              );
            }
          }
        );

        stream.pipe(res);
      } catch (error) {
        console.error(
          "TELEGRAM DOWNLOAD ERROR:",
          error
        );

        if (!res.headersSent) {
          return res
            .status(500)
            .send(
              "An samu matsala wajen sauke film."
            );
        }

        return res.end();
      }
    }
  );

  // ====================================================
  // TELEGRAM WATCH PAGE
  // ====================================================

  app.get(
    "/telegram/watch/:filmId",
    async (req, res) => {
      try {
        const filmId =
          Number(req.params.filmId);

        const telegramId =
          String(
            req.query.telegramId || ""
          ).trim();

        if (
          !Number.isInteger(filmId) ||
          filmId <= 0 ||
          !telegramId
        ) {
          return res
            .status(400)
            .send("Invalid request.");
        }

        const purchase =
          await prisma.purchase.findFirst({
            where: {
              telegramId,
              filmId,
            },

            include: {
              film: true,
            },
          });

        if (!purchase) {
          return res
            .status(403)
            .send(
              "Ba ka sayi wannan film ba."
            );
        }

        const film =
          purchase.film;

        if (!film?.webVideoUrl) {
          return res
            .status(404)
            .send(
              "Film player bai samu ba."
            );
        }

        return res.status(200).send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  />

  <title>${escapeHtml(film.title)}</title>

  <style>
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;

      background: #000;
      color: white;

      font-family:
        Arial,
        sans-serif;
    }

    .page {
      min-height: 100vh;

      display: flex;
      flex-direction: column;
    }

    .header {
      padding: 16px;

      background: #0b0b0b;

      border-bottom:
        1px solid #222;
    }

    .brand {
      color: #d4af37;

      font-size: 20px;
      font-weight: 900;
    }

    .title {
      margin-top: 8px;

      font-size: 16px;
      color: #ddd;
    }

    .player {
      flex: 1;

      min-height: 70vh;
    }

    iframe {
      width: 100%;
      height: 100%;

      min-height: 70vh;

      border: 0;

      background: #000;
    }
  </style>
</head>

<body>

  <div class="page">

    <div class="header">
      <div class="brand">
        NIGFILM
      </div>

      <div class="title">
        🎬 ${escapeHtml(film.title)}
      </div>
    </div>

    <div class="player">
      <iframe
        src="${escapeHtml(film.webVideoUrl)}"
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
        allowfullscreen
      ></iframe>
    </div>

  </div>

</body>
</html>
        `);
      } catch (error) {
        console.error(
          "TELEGRAM WATCH PAGE ERROR:",
          error
        );

        return res
          .status(500)
          .send(
            "An samu matsala wajen buɗe film."
          );
      }
    }
  );

  // ====================================================
  // TELEGRAM DOWNLOAD MINI APP
  // ====================================================

  app.get(
    "/telegram/download/:filmId",
    async (req, res) => {
      try {
        const filmId =
          Number(
            req.params.filmId
          );

        const telegramId =
          String(
            req.query.telegramId || ""
          ).trim();

        if (
          !Number.isInteger(filmId) ||
          filmId <= 0 ||
          !telegramId
        ) {
          return res
            .status(400)
            .send("Invalid request.");
        }

        const purchase =
          await prisma.purchase.findFirst({
            where: {
              telegramId,
              filmId,
            },

            include: {
              film: true,
            },
          });

        if (!purchase?.film) {
          return res
            .status(403)
            .send(
              "Ba ka mallaki wannan film ba."
            );
        }

        const film =
          purchase.film;

        if (!film.bunnyVideoId) {
          return res
            .status(404)
            .send(
              "Download bai samu ba."
            );
        }

        const baseUrl =
          process.env.PUBLIC_BASE_URL ||
          "https://nigfilm-bot.onrender.com";

        const downloadUrl =
          `${baseUrl}/api/telegram/movies/${film.id}/download?telegramId=${encodeURIComponent(
            telegramId
          )}`;

        const safeTitle =
          String(
            film.title ||
            `NIGFILM-${film.id}`
          )
            .replace(
              /[<>:"/\\|?*]/g,
              ""
            )
            .trim();

        return res.status(200).send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  >

  <title>Download Movie</title>

  <script src="https://telegram.org/js/telegram-web-app.js"></script>

  <style>
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;

      display: flex;
      align-items: center;
      justify-content: center;

      padding: 20px;

      background: #080808;
      color: #fff;

      font-family:
        Arial,
        sans-serif;
    }

    .card {
      width: 100%;
      max-width: 480px;

      padding: 28px;

      text-align: center;

      background: #121212;

      border:
        1px solid #292929;

      border-radius: 22px;
    }

    h1 {
      color: #d4af37;
    }

    p {
      color: #bbb;

      line-height: 1.6;
    }

    button {
      width: 100%;

      padding: 15px;

      margin-top: 15px;

      border: 0;
      border-radius: 12px;

      background: #d4af37;
      color: #080808;

      font-size: 16px;
      font-weight: 800;

      cursor: pointer;
    }

    #status {
      margin-top: 15px;

      color: #aaa;
    }
  </style>
</head>

<body>

  <div class="card">

    <h1>
      🎬 NIGFILM
    </h1>

    <h2>
      ${escapeHtml(film.title)}
    </h2>

    <p>
      Danna maballin da ke ƙasa domin
      sauke film ɗin zuwa na'urarka.
    </p>

    <button
      id="downloadButton"
      type="button"
    >
      ⬇️ Download Movie
    </button>

    <div id="status"></div>

  </div>

<script>
  const tg =
    window.Telegram?.WebApp;

  if (tg) {
    tg.ready();
    tg.expand();
  }

  const button =
    document.getElementById(
      "downloadButton"
    );

  const status =
    document.getElementById(
      "status"
    );

  button.addEventListener(
    "click",
    () => {
      if (
        !tg ||
        typeof tg.downloadFile !==
          "function"
      ) {
        status.textContent =
          "Telegram ɗinka bai goyi bayan native download ba.";

        return;
      }

      status.textContent =
        "Ana shirya download...";

      tg.downloadFile(
        {
          url: ${JSON.stringify(downloadUrl)},
          file_name: ${JSON.stringify(
            `${safeTitle}.mp4`
          )},
        },

        (accepted) => {
          status.textContent =
            accepted
              ? "✅ Download ya fara."
              : "An soke download.";
        }
      );
    }
  );
</script>

</body>
</html>
        `);
      } catch (error) {
        console.error(
          "TELEGRAM DOWNLOAD PAGE ERROR:",
          error
        );

        return res
          .status(500)
          .send(
            "An samu matsala wajen buɗe download."
          );
      }
    }
  );
}