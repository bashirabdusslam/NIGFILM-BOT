import crypto from "crypto";
import { prisma } from "../bot.js";

// ======================================================
// TRAILER HELPERS
// ======================================================

function getBunnyConfig() {
  const libraryId =
    process.env.BUNNY_STREAM_LIBRARY_ID;

  const apiKey =
    process.env.BUNNY_STREAM_API_KEY;

  if (!libraryId || !apiKey) {
    return null;
  }

  return {
    libraryId: String(libraryId),
    apiKey: String(apiKey),
  };
}

function buildTrailerUrl(
  libraryId,
  videoId
) {
  return (
    "https://player.mediadelivery.net/embed/" +
    `${libraryId}/${videoId}`
  );
}

function buildTusUpload(
  libraryId,
  apiKey,
  videoId
) {
  const expirationTime =
    Math.floor(Date.now() / 1000) +
    6 * 60 * 60;

  const signatureString =
    `${libraryId}` +
    `${apiKey}` +
    `${expirationTime}` +
    `${videoId}`;

  const signature =
    crypto
      .createHash("sha256")
      .update(signatureString)
      .digest("hex");

  return {
    endpoint:
      "https://video.bunnycdn.com/tusupload",

    libraryId:
      String(libraryId),

    videoId:
      String(videoId),

    authorizationSignature:
      signature,

    authorizationExpire:
      String(expirationTime),
  };
}

async function createBunnyVideo(
  libraryId,
  apiKey,
  title
) {
  const response =
    await fetch(
      `https://video.bunnycdn.com/library/${libraryId}/videos`,
      {
        method: "POST",

        headers: {
          AccessKey: apiKey,
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          title,
        }),
      }
    );

  const data =
    await response
      .json()
      .catch(() => null);

  if (
    !response.ok ||
    !data?.guid
  ) {
    const error =
      new Error(
        "An kasa kirkirar Bunny trailer."
      );

    error.statusCode =
      response.status;

    error.bunnyData =
      data;

    throw error;
  }

  return String(
    data.guid
  ).trim();
}

async function getBunnyVideo(
  libraryId,
  apiKey,
  videoId
) {
  const response =
    await fetch(
      `https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}`,
      {
        method: "GET",

        headers: {
          AccessKey: apiKey,
          Accept:
            "application/json",
        },
      }
    );

  const data =
    await response
      .json()
      .catch(() => null);

  return {
    response,
    data,
  };
}

async function deleteBunnyVideo(
  libraryId,
  apiKey,
  videoId
) {
  return fetch(
    `https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}`,
    {
      method: "DELETE",

      headers: {
        AccessKey: apiKey,
      },
    }
  );
}

function getTrailerStatus(video) {
  const statusCode =
    Number(video?.status);

  const labels = {
    0: "Created",
    1: "Uploaded",
    2: "Processing",
    3: "Ready",
    4: "Playable",
    5: "Failed",
    6: "Uploading",
    7: "Queued",
    8: "Failed",
  };

  const ready =
    statusCode === 3;

  const playable =
    statusCode === 3 ||
    statusCode === 4;

  const failed =
    statusCode === 5 ||
    statusCode === 8;

  const progress =
    Number.isFinite(
      Number(
        video?.encodeProgress
      )
    )
      ? Math.max(
          0,
          Math.min(
            100,
            Number(
              video.encodeProgress
            )
          )
        )
      : ready
        ? 100
        : 0;

  const resolutions =
    String(
      video?.availableResolutions ||
        ""
    )
      .split(",")
      .map((item) =>
        item.trim()
      )
      .filter(Boolean);

  return {
    statusCode,

    label:
      labels[statusCode] ||
      `Status ${statusCode}`,

    progress,
    ready,
    playable,
    failed,
    resolutions,
  };
}

// ======================================================
// REGISTER TRAILER HANDLERS
// ======================================================

export default function registerTrailerHandlers(
  app,
  {
    requireAdmin,
  }
) {
  // ====================================================
  // ADMIN - PREPARE TRAILER UPLOAD
  // ====================================================

  app.post(
    "/api/admin/bunny/prepare-trailer-upload",
    requireAdmin,
    async (req, res) => {
      try {
        const filmId =
          Number(
            req.body?.filmId
          );

        if (
          !Number.isInteger(filmId) ||
          filmId <= 0
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Film ID bai dace ba.",
          });
        }

        const config =
          getBunnyConfig();

        if (!config) {
          return res.status(500).json({
            success: false,
            message:
              "Bunny Stream config bai cika ba.",
          });
        }

        const {
          libraryId,
          apiKey,
        } = config;

        const film =
          await prisma.film.findUnique({
            where: {
              id: filmId,
            },

            select: {
              id: true,
              title: true,
              trailerBunnyVideoId: true,
              trailerUrl: true,
              trailerEnabled: true,
            },
          });

        if (!film) {
          return res.status(404).json({
            success: false,
            message:
              "Ba a samu wannan film ba.",
          });
        }

        if (
          film.trailerBunnyVideoId
        ) {
          return res.status(409).json({
            success: false,
            alreadyExists: true,

            message:
              "Wannan film yana da trailer. Yi amfani da Replace Trailer.",
          });
        }

        const trailerBunnyVideoId =
          await createBunnyVideo(
            libraryId,
            apiKey,
            `${film.title} - TRAILER`
          );

        const trailerUrl =
          buildTrailerUrl(
            libraryId,
            trailerBunnyVideoId
          );

        // Save the new trailer ID,
        // but do not publish it yet.
        try {
          await prisma.film.update({
            where: {
              id: filmId,
            },

            data: {
              trailerBunnyVideoId,
              trailerUrl,
              trailerEnabled: false,
            },
          });
        } catch (databaseError) {
          console.error(
            "❌ TRAILER DATABASE UPDATE ERROR:",
            databaseError
          );

          return res.status(500).json({
            success: false,

            message:
              "An kirkiri trailer a Bunny amma an kasa sabunta database.",

            trailerBunnyVideoId,
          });
        }

        const upload =
          buildTusUpload(
            libraryId,
            apiKey,
            trailerBunnyVideoId
          );

        console.log(
          "✅ TRAILER UPLOAD PREPARED:",
          {
            filmId,
            trailerBunnyVideoId,
          }
        );

        return res.status(200).json({
          success: true,

          film: {
            id:
              film.id,

            title:
              film.title,
          },

          upload,
        });
      } catch (error) {
        console.error(
          "❌ PREPARE TRAILER UPLOAD ERROR:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            "An samu matsala wajen shirya trailer upload.",
        });
      }
    }
  );

  // ====================================================
  // ADMIN - TRAILER UPLOAD COMPLETE
  //
  // Unlike old code, verify Bunny is READY first.
  // ====================================================

  app.post(
    "/api/admin/bunny/trailer-upload-complete",
    requireAdmin,
    async (req, res) => {
      try {
        const filmId =
          Number(
            req.body?.filmId
          );

        if (
          !Number.isInteger(filmId) ||
          filmId <= 0
        ) {
          return res.status(400).json({
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
              trailerBunnyVideoId: true,
              trailerUrl: true,
            },
          });

        if (!film) {
          return res.status(404).json({
            success: false,
            message:
              "Ba a samu wannan film ba.",
          });
        }

        if (
          !film.trailerBunnyVideoId
        ) {
          return res.status(409).json({
            success: false,
            message:
              "Trailer Bunny Video ID bai samu ba.",
          });
        }

        const config =
          getBunnyConfig();

        if (!config) {
          return res.status(500).json({
            success: false,
            message:
              "Bunny Stream config bai cika ba.",
          });
        }

        const {
          libraryId,
          apiKey,
        } = config;

        const bunnyResult =
          await getBunnyVideo(
            libraryId,
            apiKey,
            film.trailerBunnyVideoId
          );

        if (
          !bunnyResult.response.ok ||
          !bunnyResult.data
        ) {
          return res.status(502).json({
            success: false,
            message:
              "An kasa tabbatar da trailer a Bunny.",
          });
        }

        const status =
          getTrailerStatus(
            bunnyResult.data
          );

        if (status.failed) {
          return res.status(409).json({
            success: false,

            message:
              "Trailer upload ya failed a Bunny.",

            trailer:
              status,
          });
        }

        if (!status.ready) {
          return res.status(409).json({
            success: false,

            message:
              "Trailer bai gama processing ba tukuna.",

            trailer:
              status,
          });
        }

        const updatedFilm =
          await prisma.film.update({
            where: {
              id: filmId,
            },

            data: {
              trailerEnabled: true,
            },

            select: {
              id: true,
              title: true,
              trailerBunnyVideoId: true,
              trailerUrl: true,
              trailerEnabled: true,
            },
          });

        console.log(
          "✅ TRAILER ENABLED:",
          filmId
        );

        return res.status(200).json({
          success: true,

          message:
            "Trailer upload ya gama kuma an kunna shi.",

          film:
            updatedFilm,
        });
      } catch (error) {
        console.error(
          "❌ TRAILER COMPLETE ERROR:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            "An samu matsala wajen kammala trailer.",
        });
      }
    }
  );

  // ====================================================
  // ADMIN - PREPARE SAFE TRAILER REPLACE
  //
  // Old trailer remains live.
  // New Bunny video is created separately.
  // ====================================================

  app.post(
    "/api/admin/bunny/prepare-trailer-replace",
    requireAdmin,
    async (req, res) => {
      try {
        const filmId =
          Number(
            req.body?.filmId
          );

        if (
          !Number.isInteger(filmId) ||
          filmId <= 0
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Film ID bai dace ba.",
          });
        }

        const config =
          getBunnyConfig();

        if (!config) {
          return res.status(500).json({
            success: false,
            message:
              "Bunny Stream config bai cika ba.",
          });
        }

        const {
          libraryId,
          apiKey,
        } = config;

        const film =
          await prisma.film.findUnique({
            where: {
              id: filmId,
            },

            select: {
              id: true,
              title: true,
              trailerBunnyVideoId: true,
              trailerUrl: true,
              trailerEnabled: true,
            },
          });

        if (!film) {
          return res.status(404).json({
            success: false,
            message:
              "Ba a samu wannan film ba.",
          });
        }

        if (
          !film.trailerBunnyVideoId
        ) {
          return res.status(409).json({
            success: false,
            message:
              "Wannan film bai da trailer. Ka fara Upload Trailer.",
          });
        }

        // Confirm old trailer still exists.
        const oldCheck =
          await getBunnyVideo(
            libraryId,
            apiKey,
            film.trailerBunnyVideoId
          );

        if (!oldCheck.response.ok) {
          return res.status(502).json({
            success: false,
            message:
              "An kasa tabbatar da existing trailer a Bunny.",
          });
        }

        // Create a completely fresh Bunny video.
        const replacementVideoId =
          await createBunnyVideo(
            libraryId,
            apiKey,
            `${film.title} - TRAILER REPLACEMENT`
          );

        const replacementTrailerUrl =
          buildTrailerUrl(
            libraryId,
            replacementVideoId
          );

        const upload =
          buildTusUpload(
            libraryId,
            apiKey,
            replacementVideoId
          );

        console.log(
          "♻️ SAFE TRAILER REPLACE PREPARED:",
          {
            filmId,

            oldVideoId:
              film.trailerBunnyVideoId,

            replacementVideoId,
          }
        );

        return res.status(200).json({
          success: true,

          message:
            "Sabon trailer replacement an shirya. Tsohon trailer yana nan yana aiki.",

          film: {
            id:
              film.id,

            title:
              film.title,

            currentTrailerVideoId:
              film.trailerBunnyVideoId,

            currentTrailerUrl:
              film.trailerUrl,

            trailerEnabled:
              film.trailerEnabled,
          },

          replacement: {
            videoId:
              replacementVideoId,

            trailerUrl:
              replacementTrailerUrl,
          },

          upload,
        });
      } catch (error) {
        console.error(
          "❌ PREPARE SAFE TRAILER REPLACE ERROR:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            "An samu matsala wajen shirya Replace Trailer.",
        });
      }
    }
  );

  // ====================================================
  // ADMIN - REPLACEMENT TRAILER STATUS
  // ====================================================

  app.get(
    "/api/admin/bunny/trailer-replacement-status/:videoId",
    requireAdmin,
    async (req, res) => {
      try {
        const videoId =
          String(
            req.params.videoId ||
              ""
          ).trim();

        if (!videoId) {
          return res.status(400).json({
            success: false,
            message:
              "Replacement trailer Video ID bai samu ba.",
          });
        }

        const config =
          getBunnyConfig();

        if (!config) {
          return res.status(500).json({
            success: false,
            message:
              "Bunny Stream config bai cika ba.",
          });
        }

        const bunnyResult =
          await getBunnyVideo(
            config.libraryId,
            config.apiKey,
            videoId
          );

        if (
          !bunnyResult.response.ok ||
          !bunnyResult.data
        ) {
          return res.status(502).json({
            success: false,
            message:
              "An kasa duba replacement trailer a Bunny.",
          });
        }

        const status =
          getTrailerStatus(
            bunnyResult.data
          );

        return res.status(200).json({
          success: true,

          trailer: {
            connected: true,
            videoId,
            ...status,
          },
        });
      } catch (error) {
        console.error(
          "❌ TRAILER REPLACEMENT STATUS ERROR:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            "An samu matsala wajen duba replacement trailer.",
        });
      }
    }
  );

  // ====================================================
  // ADMIN - COMPLETE SAFE TRAILER REPLACE
  //
  // Verify new trailer -> switch DB -> verify switch
  // -> only then delete old Bunny trailer.
  // ====================================================

  app.post(
    "/api/admin/bunny/complete-trailer-replace",
    requireAdmin,
    async (req, res) => {
      try {
        const filmId =
          Number(
            req.body?.filmId
          );

        const oldVideoId =
          String(
            req.body?.oldVideoId ||
              ""
          ).trim();

        const replacementVideoId =
          String(
            req.body
              ?.replacementVideoId ||
              ""
          ).trim();

        if (
          !Number.isInteger(filmId) ||
          filmId <= 0 ||
          !oldVideoId ||
          !replacementVideoId
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Trailer replacement request bai cika ba.",
          });
        }

        if (
          oldVideoId ===
          replacementVideoId
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Old trailer da replacement trailer ba za su zama ID daya ba.",
          });
        }

        const config =
          getBunnyConfig();

        if (!config) {
          return res.status(500).json({
            success: false,
            message:
              "Bunny Stream config bai cika ba.",
          });
        }

        const {
          libraryId,
          apiKey,
        } = config;

        const film =
          await prisma.film.findUnique({
            where: {
              id: filmId,
            },

            select: {
              id: true,
              title: true,
              trailerBunnyVideoId: true,
              trailerUrl: true,
              trailerEnabled: true,
            },
          });

        if (!film) {
          return res.status(404).json({
            success: false,
            message:
              "Ba a samu wannan film ba.",
          });
        }

        // Protect against stale replacement request.
        if (
          film.trailerBunnyVideoId !==
          oldVideoId
        ) {
          return res.status(409).json({
            success: false,

            message:
              "Trailer ID ya canza tun bayan fara replacement. Ba za a yi switch ba.",

            currentTrailerVideoId:
              film.trailerBunnyVideoId,
          });
        }

        const replacementCheck =
          await getBunnyVideo(
            libraryId,
            apiKey,
            replacementVideoId
          );

        if (
          !replacementCheck.response.ok ||
          !replacementCheck.data
        ) {
          return res.status(502).json({
            success: false,
            message:
              "An kasa tabbatar da sabon replacement trailer a Bunny.",
          });
        }

        const status =
          getTrailerStatus(
            replacementCheck.data
          );

        if (status.failed) {
          return res.status(409).json({
            success: false,

            message:
              "Replacement trailer ya failed. Tsohon trailer bai canza ba.",

            trailer:
              status,
          });
        }

        if (!status.ready) {
          return res.status(409).json({
            success: false,

            message:
              "Replacement trailer bai gama processing ba tukuna. Tsohon trailer yana nan yana aiki.",

            trailer:
              status,
          });
        }

        const replacementTrailerUrl =
          buildTrailerUrl(
            libraryId,
            replacementVideoId
          );

        // Switch database only after new trailer is ready.
        const updatedFilm =
          await prisma.film.update({
            where: {
              id: filmId,
            },

            data: {
              trailerBunnyVideoId:
                replacementVideoId,

              trailerUrl:
                replacementTrailerUrl,

              trailerEnabled: true,
            },

            select: {
              id: true,
              title: true,
              trailerBunnyVideoId: true,
              trailerUrl: true,
              trailerEnabled: true,
            },
          });

        // Verify database switch before deleting old video.
        if (
          updatedFilm
            .trailerBunnyVideoId !==
          replacementVideoId
        ) {
          return res.status(500).json({
            success: false,

            message:
              "Trailer database switch verification ya kasa. Ba a goge tsohon trailer ba.",
          });
        }

        let oldVideoDeleted =
          false;

        let oldVideoDeleteStatus =
          null;

        try {
          const deleteResponse =
            await deleteBunnyVideo(
              libraryId,
              apiKey,
              oldVideoId
            );

          oldVideoDeleteStatus =
            deleteResponse.status;

          oldVideoDeleted =
            deleteResponse.ok;

          if (
            !deleteResponse.ok
          ) {
            const errorText =
              await deleteResponse
                .text()
                .catch(() => "");

            console.error(
              "⚠️ OLD TRAILER DELETE FAILED:",
              {
                oldVideoId,

                status:
                  deleteResponse.status,

                response:
                  errorText,
              }
            );
          }
        } catch (deleteError) {
          console.error(
            "⚠️ OLD TRAILER DELETE ERROR:",
            deleteError
          );
        }

        return res.status(200).json({
          success: true,

          message:
            oldVideoDeleted
              ? "Trailer replacement ya gama kuma an goge tsohon trailer."
              : "Trailer replacement ya gama. Sabon trailer yana aiki, amma goge tsohon trailer bai yi nasara ba.",

          film:
            updatedFilm,

          replacement: {
            oldVideoId,

            newVideoId:
              replacementVideoId,

            oldVideoDeleted,

            oldVideoDeleteStatus,
          },
        });
      } catch (error) {
        console.error(
          "❌ COMPLETE TRAILER REPLACE ERROR:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            "An samu matsala wajen kammala trailer replacement.",
        });
      }
    }
  );

  // ====================================================
  // ADMIN - TRAILER STATUS
  // ====================================================

  app.get(
    "/api/admin/bunny/trailer-status/:filmId",
    requireAdmin,
    async (req, res) => {
      try {
        const filmId =
          Number(
            req.params.filmId
          );

        if (
          !Number.isInteger(filmId) ||
          filmId <= 0
        ) {
          return res.status(400).json({
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
              trailerBunnyVideoId: true,
              trailerUrl: true,
              trailerEnabled: true,
            },
          });

        if (!film) {
          return res.status(404).json({
            success: false,
            message:
              "Ba a samu wannan film ba.",
          });
        }

        if (
          !film.trailerBunnyVideoId
        ) {
          return res.status(200).json({
            success: true,

            trailer: {
              connected: false,
              enabled: false,
              videoId: null,
              statusCode: null,
              label:
                "No Trailer",
              progress: 0,
              ready: false,
              playable: false,
              failed: false,
              resolutions: [],
            },
          });
        }

        const config =
          getBunnyConfig();

        if (!config) {
          return res.status(500).json({
            success: false,
            message:
              "Bunny Stream config bai cika ba.",
          });
        }

        const bunnyResult =
          await getBunnyVideo(
            config.libraryId,
            config.apiKey,
            film.trailerBunnyVideoId
          );

        if (
          !bunnyResult.response.ok ||
          !bunnyResult.data
        ) {
          return res.status(502).json({
            success: false,
            message:
              "An kasa duba trailer a Bunny Stream.",
          });
        }

        const status =
          getTrailerStatus(
            bunnyResult.data
          );

        return res.status(200).json({
          success: true,

          trailer: {
            connected: true,

            enabled:
              Boolean(
                film.trailerEnabled
              ),

            videoId:
              film.trailerBunnyVideoId,

            trailerUrl:
              film.trailerUrl,

            ...status,
          },
        });
      } catch (error) {
        console.error(
          "❌ TRAILER STATUS ERROR:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            "An samu matsala wajen duba trailer status.",
        });
      }
    }
  );

  // ====================================================
  // ADMIN - ENABLE / DISABLE TRAILER
  // ====================================================

  app.patch(
    "/api/admin/films/:filmId/trailer-enabled",
    requireAdmin,
    async (req, res) => {
      try {
        const filmId =
          Number(
            req.params.filmId
          );

        const enabled =
          req.body?.enabled ===
          true;

        if (
          !Number.isInteger(filmId) ||
          filmId <= 0
        ) {
          return res.status(400).json({
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
              trailerBunnyVideoId: true,
            },
          });

        if (!film) {
          return res.status(404).json({
            success: false,
            message:
              "Ba a samu wannan film ba.",
          });
        }

        if (
          enabled &&
          !film.trailerBunnyVideoId
        ) {
          return res.status(409).json({
            success: false,
            message:
              "Ba za a kunna trailer ba saboda babu trailer da aka upload.",
          });
        }

        const updated =
          await prisma.film.update({
            where: {
              id: filmId,
            },

            data: {
              trailerEnabled:
                enabled,
            },

            select: {
              id: true,
              title: true,
              trailerEnabled: true,
              trailerBunnyVideoId: true,
              trailerUrl: true,
            },
          });

        return res.status(200).json({
          success: true,

          message:
            enabled
              ? "An kunna trailer."
              : "An kashe trailer.",

          film:
            updated,
        });
      } catch (error) {
        console.error(
          "❌ TRAILER ENABLE/DISABLE ERROR:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            "An samu matsala wajen canza trailer status.",
        });
      }
    }
  );
}