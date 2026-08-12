import "dotenv/config";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import * as tus from "tus-js-client";

// =================================
// CONFIG
// =================================

const LIBRARY_ID =
  process.env.BUNNY_STREAM_LIBRARY_ID;

const API_KEY =
  process.env.BUNNY_STREAM_API_KEY;

const TUS_ENDPOINT =
  "https://video.bunnycdn.com/tusupload";

// =================================
// ARGUMENTS
// =================================
//
// Usage:
//
// node bunny-upload.js 30 "C:\Movies\film.mp4"
//
// 30 = Film ID na Prisma
//

const filmId = Number(
  process.argv[2]
);

const filePath =
  process.argv[3];

// =================================
// VALIDATION
// =================================

if (!LIBRARY_ID) {
  console.error(
    "❌ BUNNY_STREAM_LIBRARY_ID babu."
  );

  process.exit(1);
}

if (!API_KEY) {
  console.error(
    "❌ BUNNY_STREAM_API_KEY babu."
  );

  process.exit(1);
}

if (
  !Number.isInteger(filmId) ||
  filmId <= 0
) {
  console.error(
    "❌ Film ID bai dace ba."
  );

  console.log(
    'Misali: node bunny-upload.js 30 "C:\\Movies\\film.mp4"'
  );

  process.exit(1);
}

if (!filePath) {
  console.error(
    "❌ Ba ka saka hanyar film ba."
  );

  console.log(
    'Misali: node bunny-upload.js 30 "C:\\Movies\\film.mp4"'
  );

  process.exit(1);
}

const absolutePath =
  path.resolve(filePath);

if (
  !fs.existsSync(
    absolutePath
  )
) {
  console.error(
    "❌ Ba a samu wannan file ba:"
  );

  console.error(
    absolutePath
  );

  process.exit(1);
}

const stats =
  fs.statSync(
    absolutePath
  );

if (!stats.isFile()) {
  console.error(
    "❌ Wannan ba file ba ne."
  );

  process.exit(1);
}

// =================================
// GET FILM + BUNNY VIDEO ID
// =================================

async function getFilm() {
  const response =
    await fetch(
      `http://localhost:3000/api/films/${filmId}`
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.message ||
        "An kasa samun film."
    );
  }

  return data.film;
}

// =================================
// GET BUNNY VIDEO ID
// =================================
//
// Wannan endpoint ɗin da muka ƙirƙira
// zai dawo da existing bunnyVideoId
// idan film ɗin ya riga ya samu.
//

async function getOrCreateBunnyVideo() {
  const response =
    await fetch(
      "http://localhost:3000/api/admin/bunny/create-video",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          filmId,
        }),
      }
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.message ||
        "An kasa ƙirƙirar Bunny video."
    );
  }

  if (!data.bunnyVideoId) {
    throw new Error(
      "Bunny Video ID bai samu ba."
    );
  }

  return data;
}

// =================================
// SIGNATURE
// =================================

function createTusSignature(
  videoId
) {
  // Signature zai yi aiki na awa 6.
  const expirationTime =
    Math.floor(
      Date.now() / 1000
    ) +
    6 * 60 * 60;

  const signatureString =
    `${LIBRARY_ID}${API_KEY}${expirationTime}${videoId}`;

  const signature =
    crypto
      .createHash("sha256")
      .update(signatureString)
      .digest("hex");

  return {
    expirationTime,
    signature,
  };
}

// =================================
// FORMAT SIZE
// =================================

function formatBytes(bytes) {
  if (!bytes) {
    return "0 B";
  }

  const units = [
    "B",
    "KB",
    "MB",
    "GB",
    "TB",
  ];

  const index =
    Math.floor(
      Math.log(bytes) /
        Math.log(1024)
    );

  return `${(
    bytes /
    Math.pow(1024, index)
  ).toFixed(2)} ${units[index]}`;
}

// =================================
// START UPLOAD
// =================================

async function start() {
  try {
    console.log("");
    console.log(
      "🎬 NIGFILM Bunny Upload"
    );
    console.log(
      "========================"
    );

    console.log(
      "📁 File:",
      path.basename(
        absolutePath
      )
    );

    console.log(
      "💾 Size:",
      formatBytes(
        stats.size
      )
    );

    console.log(
      "🎞️ Film ID:",
      filmId
    );

    console.log("");
    console.log(
      "🔎 Ana duba Bunny Video ID..."
    );

    const bunny =
      await getOrCreateBunnyVideo();

    const videoId =
      bunny.bunnyVideoId;

    console.log(
      "✅ Bunny Video ID:",
      videoId
    );

    const {
      expirationTime,
      signature,
    } =
      createTusSignature(
        videoId
      );

    // =================================
    // FILE STREAM
    // =================================

    const file =
      fs.createReadStream(
        absolutePath
      );

    // =================================
    // TUS UPLOAD
    // =================================

    const upload =
      new tus.Upload(
        file,
        {
          endpoint:
            TUS_ENDPOINT,

          retryDelays: [
            0,
            1000,
            3000,
            5000,
            10000,
            20000,
          ],

          metadata: {
            filetype:
              "video/mp4",

            title:
              path.basename(
                absolutePath
              ),
          },

          headers: {
            AuthorizationSignature:
              signature,

            AuthorizationExpire:
              String(
                expirationTime
              ),

            VideoId:
              String(
                videoId
              ),

            LibraryId:
              String(
                LIBRARY_ID
              ),
          },

          uploadSize:
            stats.size,

          removeFingerprintOnSuccess:
            true,

          onError(error) {
            console.error("");
            console.error(
              "❌ UPLOAD ERROR:"
            );

            console.error(
              error
            );

            console.log("");
            console.log(
              "ℹ️ Kada ka goge file ɗin."
            );

            console.log(
              "Ka sake run command ɗin domin TUS ya ci gaba idan resume data yana nan."
            );
          },

          onProgress(
            bytesUploaded,
            bytesTotal
          ) {
            const percentage =
              (
                (bytesUploaded /
                  bytesTotal) *
                100
              ).toFixed(2);

            process.stdout.write(
              `\r⬆️ ${percentage}%  ${formatBytes(
                bytesUploaded
              )} / ${formatBytes(
                bytesTotal
              )}`
            );
          },

          onSuccess() {
            console.log("");
            console.log("");
            console.log(
              "✅ FILM UPLOAD YA GAMA!"
            );

            console.log(
              "🎬 Film ID:",
              filmId
            );

            console.log(
              "🐰 Bunny Video ID:",
              videoId
            );

            console.log("");
            console.log(
              "⏳ Bunny zai fara encoding film ɗin."
            );

            console.log(
              "Bayan encoding ya gama, Web App zai iya kunna shi."
            );
          },
        }
      );

    // =================================
    // RESUME PREVIOUS UPLOAD
    // =================================

    const previousUploads =
      await upload.findPreviousUploads();

    if (
      previousUploads.length >
      0
    ) {
      console.log(
        "♻️ An samu tsohon upload. Ana ƙoƙarin ci gaba daga inda ya tsaya..."
      );

      upload.resumeFromPreviousUpload(
        previousUploads[0]
      );
    } else {
      console.log(
        "🚀 Ana fara sabon upload..."
      );
    }

    upload.start();
  } catch (error) {
    console.error(
      "❌ BUNNY UPLOAD START ERROR:",
      error
    );

    process.exit(1);
  }
}

start();