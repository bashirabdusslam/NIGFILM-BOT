import crypto from "crypto";
import { bot, prisma } from "../bot.js";

export default function registerWebMovieHandlers(
  app,
  { hasActivePremium }
) {
  // ======================================================
  // WEB MY MOVIES API
  // ======================================================

  app.get(
    "/api/web/users/:webUserId/movies",
    async (req, res) => {
      try {
        const webUserId =
          Number(req.params.webUserId);

        if (
          !Number.isInteger(webUserId) ||
          webUserId <= 0
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Web User ID bai dace ba.",
          });
        }

        const purchases =
          await prisma.webPurchase.findMany({
            where: {
              webUserId,
            },

            orderBy: {
              createdAt: "desc",
            },

            include: {
              film: {
                select: {
                  id: true,
                  title: true,
                  description: true,
                  category: true,
                  price: true,
                  bunnyVideoId: true,
                  webVideoUrl: true,
                  createdAt: true,
                },
              },
            },
          });

        const movies =
          purchases.map(
            (purchase) => ({
              purchaseId:
                purchase.id,

              purchasedAt:
                purchase.createdAt,

              ...purchase.film,

              posterUrl:
                `/api/films/${purchase.film.id}/poster`,
            })
          );

        return res.status(200).json({
          success: true,
          count: movies.length,
          movies,
        });
      } catch (error) {
        console.error(
          "❌ WEB MY MOVIES ERROR:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            "An samu matsala wajen dauko My Movies.",
        });
      }
    }
  );

  // ======================================================
  // WEB MOVIE VIDEO STREAM
  // ======================================================

  app.get(
    "/api/web/movies/:filmId/video",
    async (req, res) => {
      try {
        const filmId =
          Number(req.params.filmId);

        const webUserId =
          Number(req.query.webUserId);

        // ================================================
        // VALIDATE IDs
        // ================================================

        if (
          !Number.isInteger(filmId) ||
          filmId <= 0 ||
          !Number.isInteger(webUserId) ||
          webUserId <= 0
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Film ID ko Web User ID bai dace ba.",
          });
        }

        // ================================================
        // VERIFY USER EXISTS
        // ================================================

        const webUser =
          await prisma.webUser.findUnique({
            where: {
              id: webUserId,
            },

            select: {
              id: true,
            },
          });

        if (!webUser) {
          return res.status(404).json({
            success: false,
            message:
              "Ba a samu wannan user ba.",
          });
        }

        // ================================================
        // VERIFY MOVIE ACCESS
        // PURCHASE OR ACTIVE PREMIUM
        // ================================================

        const purchase =
          await prisma.webPurchase.findUnique({
            where: {
              webUserId_filmId: {
                webUserId,
                filmId,
              },
            },
          });

        const activePremium =
          await hasActivePremium(
            webUserId
          );

        if (
          !purchase &&
          !activePremium
        ) {
          return res.status(403).json({
            success: false,
            message:
              "Sai ka sayi wannan film ko ka kunna Premium.",
          });
        }

        // ================================================
        // GET FILM
        // ================================================

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

        // ================================================
        // BUNNY STREAM
        // DIRECT CDN REDIRECT
        // ================================================

        if (film.bunnyVideoId) {
          const libraryId =
            process.env
              .BUNNY_STREAM_LIBRARY_ID;

          const apiKey =
            process.env
              .BUNNY_STREAM_API_KEY;

          const tokenKey =
            process.env
              .BUNNY_STREAM_TOKEN_KEY;

          const cdnHostname =
            process.env
              .BUNNY_STREAM_CDN_HOSTNAME;

          if (
            !libraryId ||
            !apiKey ||
            !tokenKey ||
            !cdnHostname
          ) {
            console.error(
              "BUNNY STREAM CONFIG MISSING",
              {
                libraryId:
                  Boolean(libraryId),
                apiKey:
                  Boolean(apiKey),
                tokenKey:
                  Boolean(tokenKey),
                cdnHostname:
                  Boolean(cdnHostname),
              }
            );

            return res.status(500).json({
              success: false,
              message:
                "Bunny video config bai cika ba.",
            });
          }

          // ==============================================
          // GET VIDEO INFORMATION FROM BUNNY
          // ==============================================

          const infoResponse =
            await fetch(
              `https://video.bunnycdn.com/library/${libraryId}/videos/${film.bunnyVideoId}`,
              {
                headers: {
                  AccessKey:
                    apiKey,

                  Accept:
                    "application/json",
                },
              }
            );

          if (!infoResponse.ok) {
            const bunnyError =
              await infoResponse
                .text()
                .catch(() => "");

            console.error(
              "BUNNY VIDEO INFO ERROR:",
              infoResponse.status,
              bunnyError
            );

            return res.status(502).json({
              success: false,
              message:
                "An kasa samun bayanin video daga Bunny.",
            });
          }

          const bunnyVideo =
            await infoResponse.json();

          // ==============================================
          // AVAILABLE RESOLUTIONS
          // ==============================================

          const available =
            String(
              bunnyVideo
                .availableResolutions ||
                ""
            )
              .split(",")
              .map(
                (item) =>
                  item.trim()
              )
              .filter(Boolean);

          const preferred =
            [
              "1080p",
              "720p",
              "480p",
              "360p",
              "240p",
            ].find(
              (resolution) =>
                available.includes(
                  resolution
                )
            );

          if (!preferred) {
            return res.status(409).json({
              success: false,
              message:
                "Film bai gama processing ba tukuna.",
            });
          }

          // ==============================================
          // CLEAN CDN HOSTNAME
          // ==============================================

          const hostname =
            cdnHostname
              .replace(
                /^https?:\/\//,
                ""
              )
              .replace(
                /\/+$/,
                ""
              );

          // ==============================================
          // BUILD BUNNY MP4 PATH
          // ==============================================

          const bunnyPath =
            `/${film.bunnyVideoId}/play_${preferred}.mp4`;

          // Token valid for 15 minutes
          const expires =
            Math.floor(
              Date.now() / 1000
            ) +
            15 * 60;

          const signaturePayload =
            `${bunnyPath}${expires}`;

          const signature =
            crypto
              .createHmac(
                "sha256",
                tokenKey
              )
              .update(
                signaturePayload
              )
              .digest("base64")
              .replace(/\+/g, "-")
              .replace(/\//g, "_")
              .replace(/=+$/g, "");

          const token =
            `HS256-${signature}`;

          const bunnyVideoUrl =
            `https://${hostname}${bunnyPath}` +
            `?token=${encodeURIComponent(token)}` +
            `&expires=${expires}`;

          console.log(
            "▶️ WEB VIDEO REDIRECT TO BUNNY:",
            {
              webUserId,
              filmId,
              resolution:
                preferred,
            }
          );

          return res.redirect(
            302,
            bunnyVideoUrl
          );
        }

        // ================================================
        // FALLBACK TO TELEGRAM VIDEO
        // ================================================

        if (!film.videoFileId) {
          return res.status(404).json({
            success: false,
            message:
              "Ba a samu video file na wannan film ba.",
          });
        }

        const fileLink =
          await bot.telegram.getFileLink(
            film.videoFileId
          );

        const telegramResponse =
          await fetch(
            fileLink.href
          );

        if (
          !telegramResponse.ok
        ) {
          console.error(
            "❌ TELEGRAM VIDEO FETCH FAILED:",
            telegramResponse.status
          );

          return res.status(502).json({
            success: false,
            message:
              "An kasa dauko video daga Telegram.",
          });
        }

        const contentType =
          telegramResponse.headers.get(
            "content-type"
          ) ||
          "video/mp4";

        const contentLength =
          telegramResponse.headers.get(
            "content-length"
          );

        res.setHeader(
          "Content-Type",
          contentType
        );

        if (contentLength) {
          res.setHeader(
            "Content-Length",
            contentLength
          );
        }

        res.setHeader(
          "Cache-Control",
          "private, no-store"
        );

        const buffer =
          Buffer.from(
            await telegramResponse
              .arrayBuffer()
          );

        return res.send(buffer);
      } catch (error) {
        console.error(
          "❌ WEB VIDEO STREAM ERROR:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            "An samu matsala wajen kunna film.",
        });
      }
    }
  );
}