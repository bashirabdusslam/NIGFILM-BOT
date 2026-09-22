import crypto from "crypto";
import { prisma } from "../bot.js";

// ======================================================
// ESCAPE HTML
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
// LEGACY BUNNY UPLOAD HANDLERS
// ======================================================

export default function registerLegacyBunnyUploadHandlers(app) {

  // ====================================================
  // ADMIN UPLOAD PAGE
  // ====================================================

  app.get(
    "/admin/upload-film/:filmId",
    async (req, res) => {
      try {
        const filmId =
          Number(req.params.filmId);

        const token =
          String(req.query.token || "");

        if (
          !Number.isInteger(filmId) ||
          filmId <= 0
        ) {
          return res
            .status(400)
            .send("Invalid Film ID");
        }

        if (
          !process.env.ADMIN_UPLOAD_SECRET ||
          token !==
            process.env.ADMIN_UPLOAD_SECRET
        ) {
          return res
            .status(403)
            .send("Unauthorized");
        }

        const film =
          await prisma.film.findUnique({
            where: {
              id: filmId,
            },
          });

        if (!film) {
          return res
            .status(404)
            .send("Film not found");
        }

        if (!film.bunnyVideoId) {
          return res
            .status(400)
            .send(
              "Bunny Video ID bai samu ba tukuna."
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

  <title>NIGFILM Upload</title>

  <script src="https://cdn.jsdelivr.net/npm/tus-js-client@4/dist/tus.min.js"></script>

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

      background: #070707;
      color: white;

      font-family: Arial, sans-serif;
    }

    .card {
      width: 100%;
      max-width: 600px;

      padding: 28px;

      background: #111111;

      border: 1px solid #2a2a2a;
      border-radius: 22px;
    }

    h1 {
      margin-top: 0;
      color: #d4af37;
    }

    .film {
      padding: 14px;
      margin-bottom: 20px;

      background: #181818;

      border-radius: 12px;
    }

    input {
      width: 100%;
      padding: 14px;

      color: white;
      background: #181818;

      border: 1px solid #333;
      border-radius: 11px;
    }

    button {
      width: 100%;

      margin-top: 15px;
      padding: 14px;

      border: none;
      border-radius: 11px;

      background: #d4af37;
      color: #080808;

      font-weight: 900;
      cursor: pointer;
    }

    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .progress-wrap {
      width: 100%;
      height: 18px;

      margin-top: 22px;
      overflow: hidden;

      background: #282828;
      border-radius: 30px;
    }

    .progress {
      width: 0%;
      height: 100%;

      background: #d4af37;

      transition: width 0.2s ease;
    }

    .status {
      margin-top: 12px;

      color: #aaa;
      line-height: 1.5;
    }

    .success {
      color: #4ade80;
    }

    .error {
      color: #f87171;
    }
  </style>
</head>

<body>

  <div class="card">

    <h1>
      🎬 NIGFILM Upload
    </h1>

    <div class="film">
      <strong>${escapeHtml(film.title)}</strong>
      <br />
      Film ID: ${film.id}
    </div>

    <input
      id="videoFile"
      type="file"
      accept="video/*"
    />

    <button
      id="uploadButton"
      type="button"
    >
      ⬆️ Upload Film
    </button>

    <div class="progress-wrap">
      <div
        id="progress"
        class="progress"
      ></div>
    </div>

    <div
      id="status"
      class="status"
    >
      Zaɓi video sannan ka danna Upload Film.
    </div>

  </div>

<script>

const filmId = ${film.id};
const token = ${JSON.stringify(token)};

const fileInput =
  document.getElementById("videoFile");

const button =
  document.getElementById("uploadButton");

const progress =
  document.getElementById("progress");

const status =
  document.getElementById("status");

button.addEventListener(
  "click",
  async () => {
    const file =
      fileInput.files[0];

    if (!file) {
      status.className =
        "status error";

      status.textContent =
        "❌ Ka zaɓi film tukuna.";

      return;
    }

    try {
      button.disabled = true;

      status.className =
        "status";

      status.textContent =
        "🔐 Ana karɓar upload credentials...";

      const credentialsResponse =
        await fetch(
          "/api/admin/bunny/upload-credentials",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              filmId,
              token,
            }),
          }
        );

      const credentials =
        await credentialsResponse.json();

      if (!credentialsResponse.ok) {
        throw new Error(
          credentials.message ||
          "An kasa samun upload credentials."
        );
      }

      const upload =
        new tus.Upload(
          file,
          {
            endpoint:
              "https://video.bunnycdn.com/tusupload",

            retryDelays: [
              0,
              3000,
              5000,
              10000,
              20000,
              60000,
            ],

            headers: {
              AuthorizationSignature:
                credentials.signature,

              AuthorizationExpire:
                String(
                  credentials.expirationTime
                ),

              VideoId:
                credentials.videoId,

              LibraryId:
                String(
                  credentials.libraryId
                ),
            },

            metadata: {
              filetype:
                file.type ||
                "video/mp4",

              title:
                file.name,
            },

            removeFingerprintOnSuccess:
              true,

            onError(error) {
              console.error(error);

              button.disabled = false;

              status.className =
                "status error";

              status.textContent =
                "❌ Upload ya samu matsala: " +
                error.message;
            },

            onProgress(
              bytesUploaded,
              bytesTotal
            ) {
              const percent =
                (
                  bytesUploaded /
                  bytesTotal *
                  100
                ).toFixed(2);

              progress.style.width =
                percent + "%";

              status.className =
                "status";

              status.textContent =
                "⬆️ Uploading: " +
                percent +
                "%";
            },

            async onSuccess() {
              progress.style.width =
                "100%";

              status.className =
                "status success";

              status.textContent =
                "✅ Upload ya gama. Bunny yana encoding film ɗin.";

              try {
                await fetch(
                  "/api/admin/bunny/upload-complete",
                  {
                    method: "POST",

                    headers: {
                      "Content-Type":
                        "application/json",
                    },

                    body: JSON.stringify({
                      filmId,
                      token,
                    }),
                  }
                );
              } catch (error) {
                console.error(
                  "Upload complete notification failed:",
                  error
                );
              }
            },
          }
        );

      const previousUploads =
        await upload.findPreviousUploads();

      if (
        previousUploads.length
      ) {
        status.textContent =
          "♻️ An samu upload na baya. Ana ci gaba daga inda ya tsaya...";

        upload.resumeFromPreviousUpload(
          previousUploads[0]
        );
      }

      upload.start();

    } catch (error) {
      button.disabled = false;

      status.className =
        "status error";

      status.textContent =
        "❌ " + error.message;
    }
  }
);

</script>

</body>
</html>
        `);
      } catch (error) {
        console.error(
          "ADMIN UPLOAD PAGE ERROR:",
          error
        );

        return res
          .status(500)
          .send(
            "Upload page error"
          );
      }
    }
  );

  // ====================================================
  // BUNNY TUS UPLOAD CREDENTIALS
  // ====================================================

  app.post(
    "/api/admin/bunny/upload-credentials",
    async (req, res) => {
      try {
        const filmId =
          Number(req.body?.filmId);

        const token =
          String(
            req.body?.token || ""
          );

        if (
          !process.env.ADMIN_UPLOAD_SECRET ||
          token !==
            process.env.ADMIN_UPLOAD_SECRET
        ) {
          return res
            .status(403)
            .json({
              success: false,
              message:
                "Ba ka da izinin upload.",
            });
        }

        if (
          !Number.isInteger(filmId) ||
          filmId <= 0
        ) {
          return res
            .status(400)
            .json({
              success: false,
              message:
                "Film ID bai dace ba.",
            });
        }

        const film =
          await prisma.film.findUnique({
            where: {
              id: filmId,
            },
          });

        if (
          !film ||
          !film.bunnyVideoId
        ) {
          return res
            .status(404)
            .json({
              success: false,
              message:
                "Film ko Bunny Video ID bai samu ba.",
            });
        }

        const libraryId =
          process.env
            .BUNNY_STREAM_LIBRARY_ID;

        const apiKey =
          process.env
            .BUNNY_STREAM_API_KEY;

        if (
          !libraryId ||
          !apiKey
        ) {
          return res
            .status(500)
            .json({
              success: false,
              message:
                "Bunny config bai cika ba.",
            });
        }

        // 24 hours domin manyan films.
        const expirationTime =
          Math.floor(
            Date.now() / 1000
          ) +
          24 * 60 * 60;

        const signature =
          crypto
            .createHash("sha256")
            .update(
              `${libraryId}${apiKey}${expirationTime}${film.bunnyVideoId}`
            )
            .digest("hex");

        return res
          .status(200)
          .json({
            success: true,

            videoId:
              film.bunnyVideoId,

            libraryId,

            expirationTime,

            signature,
          });
      } catch (error) {
        console.error(
          "BUNNY UPLOAD CREDENTIALS ERROR:",
          error
        );

        return res
          .status(500)
          .json({
            success: false,
            message:
              "An samu matsala wajen upload credentials.",
          });
      }
    }
  );

  // ====================================================
  // LEGACY UPLOAD COMPLETE
  // ====================================================
  //
  // Wannan route bai kasance defined a tsohon index.js ba,
  // amma upload page yana kiransa bayan TUS upload ya gama.
  //
  // MUHIMMI:
  // Ba ya sauya bunnyVideoId.
  // Ba ya goge wani Bunny video.
  // Ba ya kunna replacement.
  // Amsa/verification kawai yake yi.
  // ====================================================

  app.post(
    "/api/admin/bunny/upload-complete",
    async (req, res) => {
      try {
        const filmId =
          Number(req.body?.filmId);

        const token =
          String(
            req.body?.token || ""
          );

        if (
          !process.env.ADMIN_UPLOAD_SECRET ||
          token !==
            process.env.ADMIN_UPLOAD_SECRET
        ) {
          return res
            .status(403)
            .json({
              success: false,
              message:
                "Ba ka da izinin upload.",
            });
        }

        if (
          !Number.isInteger(filmId) ||
          filmId <= 0
        ) {
          return res
            .status(400)
            .json({
              success: false,
              message:
                "Film ID bai dace ba.",
            });
        }

        const film =
          await prisma.film.findUnique({
            where: {
              id: filmId,
            },

            select: {
              id: true,
              title: true,
              bunnyVideoId: true,
              webVideoUrl: true,
            },
          });

        if (!film) {
          return res
            .status(404)
            .json({
              success: false,
              message:
                "Ba a samu wannan film ba.",
            });
        }

        if (!film.bunnyVideoId) {
          return res
            .status(409)
            .json({
              success: false,
              message:
                "Bunny Video ID bai samu ba.",
            });
        }

        console.log(
          "✅ LEGACY BUNNY UPLOAD COMPLETE:",
          film.id,
          film.bunnyVideoId
        );

        return res
          .status(200)
          .json({
            success: true,

            message:
              "Upload ya gama. Bunny yana processing film ɗin.",

            film: {
              id: film.id,
              title: film.title,
              bunnyVideoId:
                film.bunnyVideoId,
              webVideoUrl:
                film.webVideoUrl,
            },
          });
      } catch (error) {
        console.error(
          "LEGACY BUNNY UPLOAD COMPLETE ERROR:",
          error
        );

        return res
          .status(500)
          .json({
            success: false,
            message:
              "An samu matsala wajen tabbatar da upload.",
          });
      }
    }
  );
}