import crypto from "crypto";
import { prisma } from "../bot.js";

// ======================================================
// BUNNY HELPERS
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

function buildWebVideoUrl(
  libraryId,
  bunnyVideoId
) {
  return (
    "https://player.mediadelivery.net/embed/" +
    `${libraryId}/${bunnyVideoId}`
  );
}

function buildTusUpload(
  libraryId,
  apiKey,
  bunnyVideoId
) {
  const expirationTime =
    Math.floor(Date.now() / 1000) +
    6 * 60 * 60;

  const signatureString =
    `${libraryId}` +
    `${apiKey}` +
    `${expirationTime}` +
    `${bunnyVideoId}`;

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
      String(bunnyVideoId),

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
  const bunnyResponse =
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

  const bunnyData =
    await bunnyResponse
      .json()
      .catch(() => null);

  if (
    !bunnyResponse.ok ||
    !bunnyData?.guid
  ) {
    const error =
      new Error(
        "An kasa kirkirar video a Bunny Stream."
      );

    error.statusCode =
      bunnyResponse.status;

    error.bunnyData =
      bunnyData;

    throw error;
  }

  return String(
    bunnyData.guid
  ).trim();
}

async function getBunnyVideo(
  libraryId,
  apiKey,
  bunnyVideoId
) {
  const response =
    await fetch(
      `https://video.bunnycdn.com/library/${libraryId}/videos/${bunnyVideoId}`,
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
  bunnyVideoId
) {
  const response =
    await fetch(
      `https://video.bunnycdn.com/library/${libraryId}/videos/${bunnyVideoId}`,
      {
        method: "DELETE",

        headers: {
          AccessKey: apiKey,
        },
      }
    );

  return response;
}

function getBunnyStatusInfo(video) {
  const statusMap = {
    0: {
      status: "queued",
      label: "Queued",
    },

    1: {
      status: "processing",
      label: "Processing",
    },

    2: {
      status: "encoding",
      label: "Transcoding",
    },

    3: {
      status: "finished",
      label: "Ready",
    },

    4: {
      status:
        "resolution_finished",
      label: "Playable",
    },

    5: {
      status: "failed",
      label: "Failed",
    },

    6: {
      status:
        "upload_started",
      label: "Upload Started",
    },

    7: {
      status:
        "upload_finished",
      label: "Upload Finished",
    },

    8: {
      status:
        "upload_failed",
      label: "Upload Failed",
    },
  };

  const statusCode =
    Number(video?.status);

  const statusInfo =
    statusMap[statusCode] || {
      status: "unknown",
      label:
        `Status ${statusCode}`,
    };

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

  return {
    statusCode,
    status:
      statusInfo.status,
    label:
      statusInfo.label,
    progress,
    playable,
    ready,
    failed,
    resolutions,

    hasMP4Fallback:
      Boolean(
        video?.hasMP4Fallback
      ),

    hasOriginal:
      Boolean(
        video?.hasOriginal
      ),

    length:
      Number(
        video?.length || 0
      ),

    width:
      Number(
        video?.width || 0
      ),

    height:
      Number(
        video?.height || 0
      ),
  };
}

// ======================================================
// REGISTER BUNNY UPLOAD HANDLERS
// ======================================================

export default function registerBunnyUploadHandlers(
  app,
  {
    requireAdmin,
  }
) {
  // ====================================================
  // BUNNY STREAM - CREATE VIDEO
  // ====================================================

  app.post(
    "/api/admin/bunny/create-video",
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
          });

        if (!film) {
          return res.status(404).json({
            success: false,
            message:
              "Ba a samu wannan film ba.",
          });
        }

        if (film.bunnyVideoId) {
          return res.status(200).json({
            success: true,
            alreadyExists: true,

            message:
              "Wannan film yana da Bunny video tuni.",

            filmId:
              film.id,

            bunnyVideoId:
              film.bunnyVideoId,

            webVideoUrl:
              film.webVideoUrl,
          });
        }

        const bunnyVideoId =
          await createBunnyVideo(
            libraryId,
            apiKey,
            film.title
          );

        const webVideoUrl =
          buildWebVideoUrl(
            libraryId,
            bunnyVideoId
          );

        try {
          await prisma.film.update({
            where: {
              id: film.id,
            },

            data: {
              bunnyVideoId,
              webVideoUrl,
            },
          });
        } catch (databaseError) {
          console.error(
            "❌ DATABASE UPDATE FAILED AFTER BUNNY CREATE:",
            databaseError
          );

          return res.status(500).json({
            success: false,

            message:
              "An kirkiri video a Bunny amma an kasa sabunta database.",

            bunnyVideoId,
          });
        }

        console.log(
          "✅ BUNNY VIDEO CREATED:",
          {
            filmId:
              film.id,

            bunnyVideoId,
          }
        );

        return res.status(201).json({
          success: true,

          message:
            "An kirkiri Bunny video cikin nasara.",

          filmId:
            film.id,

          bunnyVideoId,

          webVideoUrl,
        });
      } catch (error) {
        console.error(
          "❌ BUNNY CREATE VIDEO ERROR:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            "An samu matsala wajen kirkirar Bunny video.",
        });
      }
    }
  );

  // ====================================================
  // ADMIN - PREPARE NORMAL BUNNY UPLOAD
  // ====================================================

  app.post(
    "/api/admin/bunny/prepare-upload",
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
              "Bunny config bai cika ba.",
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
          });

        if (!film) {
          return res.status(404).json({
            success: false,
            message:
              "Ba a samu wannan film ba.",
          });
        }

        let bunnyVideoId =
          film.bunnyVideoId;

        let webVideoUrl =
          film.webVideoUrl;

        // ================================================
        // CREATE VIDEO IF NEEDED
        // ================================================

        if (!bunnyVideoId) {
          bunnyVideoId =
            await createBunnyVideo(
              libraryId,
              apiKey,
              film.title
            );

          webVideoUrl =
            buildWebVideoUrl(
              libraryId,
              bunnyVideoId
            );

          try {
            await prisma.film.update({
              where: {
                id: filmId,
              },

              data: {
                bunnyVideoId,
                webVideoUrl,
              },
            });
          } catch (databaseError) {
            console.error(
              "❌ DATABASE UPDATE FAILED AFTER PREPARE UPLOAD:",
              databaseError
            );

            return res.status(500).json({
              success: false,

              message:
                "An kirkiri Bunny video amma an kasa sabunta database.",

              bunnyVideoId,
            });
          }
        }

        const upload =
          buildTusUpload(
            libraryId,
            apiKey,
            bunnyVideoId
          );

        console.log(
          "✅ BUNNY UPLOAD PREPARED:",
          {
            filmId,
            bunnyVideoId,
          }
        );

        return res.status(200).json({
          success: true,

          film: {
            id:
              film.id,

            title:
              film.title,

            bunnyVideoId,

            webVideoUrl,
          },

          upload,
        });
      } catch (error) {
        console.error(
          "❌ PREPARE BUNNY UPLOAD ERROR:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            "An samu matsala wajen shirya upload.",
        });
      }
    }
  );

  // ====================================================
  // ADMIN - PREPARE SAFE BUNNY VIDEO REPLACEMENT
  //
  // IMPORTANT:
  // Old Bunny video remains connected to the film.
  // A fresh Bunny video is created only for replacement.
  // Database is NOT switched here.
  // ====================================================

  app.post(
    "/api/admin/bunny/prepare-replace",
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
              bunnyVideoId: true,
              webVideoUrl: true,
            },
          });

        if (!film) {
          return res.status(404).json({
            success: false,
            message:
              "Ba a samu wannan film ba.",
          });
        }

        if (!film.bunnyVideoId) {
          return res.status(409).json({
            success: false,
            message:
              "Wannan film bai da Bunny Video ID. Ka fara Upload to Bunny kafin Replace.",
          });
        }

        // ================================================
        // CONFIRM OLD VIDEO STILL EXISTS
        // ================================================

        const oldVideoCheck =
          await getBunnyVideo(
            libraryId,
            apiKey,
            film.bunnyVideoId
          );

        if (
          !oldVideoCheck
            .response.ok
        ) {
          console.error(
            "❌ OLD BUNNY VIDEO CHECK FAILED:",
            oldVideoCheck
              .response.status
          );

          return res.status(502).json({
            success: false,
            message:
              "An kasa tabbatar da existing Bunny video.",
          });
        }

        // ================================================
        // CREATE FRESH REPLACEMENT VIDEO
        // ================================================

        const replacementVideoId =
          await createBunnyVideo(
            libraryId,
            apiKey,
            `${film.title} - Replacement`
          );

        const replacementWebVideoUrl =
          buildWebVideoUrl(
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
          "♻️ SAFE BUNNY REPLACE PREPARED:",
          {
            filmId:
              film.id,

            oldVideoId:
              film.bunnyVideoId,

            replacementVideoId,
          }
        );

        return res.status(200).json({
          success: true,

          message:
            "Sabon replacement video an shirya. Tsohon video yana nan yana aiki.",

          film: {
            id:
              film.id,

            title:
              film.title,

            currentBunnyVideoId:
              film.bunnyVideoId,

            currentWebVideoUrl:
              film.webVideoUrl,
          },

          replacement: {
            videoId:
              replacementVideoId,

            webVideoUrl:
              replacementWebVideoUrl,
          },

          upload,
        });
      } catch (error) {
        console.error(
          "❌ PREPARE SAFE BUNNY REPLACE ERROR:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            "An samu matsala wajen shirya Replace Video.",
        });
      }
    }
  );

  // ====================================================
  // ADMIN - CHECK REPLACEMENT VIDEO STATUS
  //
  // This checks the temporary replacement video directly.
  // It does NOT change the film database.
  // ====================================================

  app.get(
    "/api/admin/bunny/replacement-status/:videoId",
    requireAdmin,
    async (req, res) => {
      try {
        const replacementVideoId =
          String(
            req.params.videoId ||
              ""
          ).trim();

        if (!replacementVideoId) {
          return res.status(400).json({
            success: false,
            message:
              "Replacement Bunny Video ID bai samu ba.",
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
            replacementVideoId
          );

        if (
          !bunnyResult
            .response.ok ||
          !bunnyResult.data
        ) {
          return res.status(502).json({
            success: false,
            message:
              "An kasa samun replacement Bunny video status.",
          });
        }

        const status =
          getBunnyStatusInfo(
            bunnyResult.data
          );

        return res.status(200).json({
          success: true,

          bunny: {
            connected: true,

            videoId:
              replacementVideoId,

            ...status,
          },
        });
      } catch (error) {
        console.error(
          "❌ REPLACEMENT STATUS ERROR:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            "An samu matsala wajen duba replacement status.",
        });
      }
    }
  );

  // ====================================================
  // ADMIN - COMPLETE SAFE REPLACEMENT
  //
  // 1. Confirm DB still points to expected old video.
  // 2. Confirm new video exists.
  // 3. Confirm new video is READY.
  // 4. Switch database to new video.
  // 5. Confirm database switch.
  // 6. Only then attempt to delete old Bunny video.
  // ====================================================

  app.post(
    "/api/admin/bunny/complete-replace",
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
              "Replacement request bai cika ba.",
          });
        }

        if (
          oldVideoId ===
          replacementVideoId
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Old video da replacement video ba za su zama ID daya ba.",
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
              bunnyVideoId: true,
              webVideoUrl: true,
            },
          });

        if (!film) {
          return res.status(404).json({
            success: false,
            message:
              "Ba a samu wannan film ba.",
          });
        }

        // ================================================
        // PROTECT AGAINST STALE / WRONG REPLACE REQUEST
        // ================================================

        if (
          film.bunnyVideoId !==
          oldVideoId
        ) {
          return res.status(409).json({
            success: false,

            message:
              "Film Bunny Video ID ya canza tun bayan fara replacement. Ba za a yi switch ba.",

            currentBunnyVideoId:
              film.bunnyVideoId,
          });
        }

        // ================================================
        // CONFIRM NEW VIDEO EXISTS AND IS READY
        // ================================================

        const replacementCheck =
          await getBunnyVideo(
            libraryId,
            apiKey,
            replacementVideoId
          );

        if (
          !replacementCheck
            .response.ok ||
          !replacementCheck.data
        ) {
          return res.status(502).json({
            success: false,
            message:
              "An kasa tabbatar da sabon replacement video a Bunny.",
          });
        }

        const replacementStatus =
          getBunnyStatusInfo(
            replacementCheck.data
          );

        if (
          replacementStatus.failed
        ) {
          return res.status(409).json({
            success: false,

            message:
              "Replacement video ya failed a Bunny. Tsohon video bai canza ba.",

            bunny:
              replacementStatus,
          });
        }

        if (
          !replacementStatus.ready
        ) {
          return res.status(409).json({
            success: false,

            message:
              "Replacement video bai gama processing ba tukuna. Tsohon video yana nan yana aiki.",

            bunny:
              replacementStatus,
          });
        }

        // ================================================
        // BUILD NEW PLAYER URL
        // ================================================

        const replacementWebVideoUrl =
          buildWebVideoUrl(
            libraryId,
            replacementVideoId
          );

        // ================================================
        // SWITCH DATABASE FIRST
        // ================================================

        const updatedFilm =
          await prisma.film.update({
            where: {
              id: filmId,
            },

            data: {
              bunnyVideoId:
                replacementVideoId,

              webVideoUrl:
                replacementWebVideoUrl,
            },

            select: {
              id: true,
              title: true,
              bunnyVideoId: true,
              webVideoUrl: true,
            },
          });

        // ================================================
        // VERIFY DATABASE SWITCH
        // ================================================

        if (
          updatedFilm.bunnyVideoId !==
          replacementVideoId
        ) {
          console.error(
            "❌ DATABASE SWITCH VERIFICATION FAILED:",
            {
              filmId,
              expected:
                replacementVideoId,

              actual:
                updatedFilm
                  .bunnyVideoId,
            }
          );

          return res.status(500).json({
            success: false,

            message:
              "Database switch verification ya kasa. Ba a goge tsohon Bunny video ba.",
          });
        }

        // ================================================
        // DELETE OLD VIDEO ONLY AFTER SUCCESSFUL SWITCH
        // ================================================

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
            const deleteErrorText =
              await deleteResponse
                .text()
                .catch(() => "");

            console.error(
              "⚠️ OLD BUNNY VIDEO DELETE FAILED:",
              {
                oldVideoId,
                status:
                  deleteResponse.status,

                response:
                  deleteErrorText,
              }
            );
          }
        } catch (
          deleteError
        ) {
          console.error(
            "⚠️ OLD BUNNY VIDEO DELETE ERROR:",
            deleteError
          );
        }

        console.log(
          "✅ SAFE BUNNY REPLACEMENT COMPLETE:",
          {
            filmId,

            oldVideoId,

            replacementVideoId,

            oldVideoDeleted,
          }
        );

        return res.status(200).json({
          success: true,

          message:
            oldVideoDeleted
              ? "Replacement ya gama. An sabunta film kuma an goge tsohon Bunny video."
              : "Replacement ya gama kuma film yana amfani da sabon video. Amma goge tsohon Bunny video bai yi nasara ba.",

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
          "❌ COMPLETE SAFE BUNNY REPLACE ERROR:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            "An samu matsala wajen kammala Bunny replacement.",
        });
      }
    }
  );

  // ====================================================
  // ADMIN - GET CURRENT FILM BUNNY VIDEO STATUS
  // ====================================================

  app.get(
    "/api/admin/bunny/status/:filmId",
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
              bunnyVideoId: true,
              webVideoUrl: true,
            },
          });

        if (!film) {
          return res.status(404).json({
            success: false,
            message:
              "Ba a samu wannan film ba.",
          });
        }

        // ================================================
        // NOT CONNECTED
        // ================================================

        if (!film.bunnyVideoId) {
          return res.status(200).json({
            success: true,

            film: {
              id:
                film.id,

              title:
                film.title,
            },

            bunny: {
              connected: false,
              statusCode: null,
              status:
                "not_connected",
              label:
                "Not Connected",
              progress: 0,
              playable: false,
              ready: false,
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

        const {
          libraryId,
          apiKey,
        } = config;

        const bunnyResult =
          await getBunnyVideo(
            libraryId,
            apiKey,
            film.bunnyVideoId
          );

        if (
          !bunnyResult
            .response.ok ||
          !bunnyResult.data
        ) {
          const errorText =
            bunnyResult.data
              ? JSON.stringify(
                  bunnyResult.data
                )
              : "";

          console.error(
            "❌ BUNNY STATUS API ERROR:",
            bunnyResult
              .response.status,
            errorText
          );

          return res.status(502).json({
            success: false,
            message:
              "An kasa samun Bunny video status.",
          });
        }

        const status =
          getBunnyStatusInfo(
            bunnyResult.data
          );

        console.log(
          "🎬 BUNNY STATUS:",
          {
            filmId,

            bunnyVideoId:
              film.bunnyVideoId,

            status:
              status.label,

            progress:
              status.progress,
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

          bunny: {
            connected: true,

            videoId:
              film.bunnyVideoId,

            ...status,
          },
        });
      } catch (error) {
        console.error(
          "❌ ADMIN BUNNY STATUS ERROR:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            "An samu matsala wajen duba Bunny status.",
        });
      }
    }
  );
}