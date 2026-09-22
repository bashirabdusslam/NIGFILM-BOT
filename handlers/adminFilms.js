import { prisma } from "../bot.js";

export default function registerAdminFilmHandlers(
  app,
  { requireAdmin }
) {
  // ======================================================
  // ADMIN - GET ALL FILMS FOR MANAGEMENT
  // ======================================================

  app.get(
    "/api/admin/films",
    requireAdmin,
    async (req, res) => {
      try {
        const films =
          await prisma.film.findMany({
            orderBy: {
              createdAt: "desc",
            },

            select: {
              id: true,
              title: true,
              description: true,
              category: true,
              price: true,

              studioId: true,

              studio: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },

              posterFileId: true,
              posterUrl: true,

              bunnyVideoId: true,
              webVideoUrl: true,

              featured: true,

              trailerEnabled: true,
              trailerUrl: true,
              trailerBunnyVideoId: true,

              createdAt: true,
              updatedAt: true,
            },
          });

        const result =
          films.map((film) => ({
            ...film,

            posterUrl:
              film.posterUrl ||
              `/api/films/${film.id}/poster`,
          }));

        return res.status(200).json({
          success: true,
          count: result.length,
          films: result,
        });
      } catch (error) {
        console.error(
          "❌ ADMIN GET FILMS ERROR:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            "An samu matsala wajen dauko fina-finai na Admin.",
        });
      }
    }
  );

  // ======================================================
  // ADMIN - UPDATE FILM METADATA
  // ======================================================

  app.patch(
    "/api/admin/films/:filmId",
    requireAdmin,
    async (req, res) => {
      try {
        const filmId =
          Number(req.params.filmId);

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

        // ================================================
        // CHECK FILM EXISTS
        // ================================================

        const existingFilm =
          await prisma.film.findUnique({
            where: {
              id: filmId,
            },

            select: {
              id: true,
            },
          });

        if (!existingFilm) {
          return res.status(404).json({
            success: false,
            message:
              "Ba a samu wannan film ba.",
          });
        }

        // ================================================
        // TITLE
        // ================================================

        const title =
          req.body?.title !== undefined
            ? String(
                req.body.title
              ).trim()
            : undefined;

        if (
          title !== undefined &&
          !title
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Title ba zai zama empty ba.",
          });
        }

        // ================================================
        // DESCRIPTION
        // ================================================

        const description =
          req.body?.description !==
          undefined
            ? String(
                req.body.description
              ).trim()
            : undefined;

        if (
          description !== undefined &&
          !description
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Description ba zai zama empty ba.",
          });
        }

        // ================================================
        // CATEGORY
        // ================================================

        const category =
          req.body?.category !== undefined
            ? String(
                req.body.category
              ).trim()
            : undefined;

        if (
          category !== undefined &&
          !category
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Category ba zai zama empty ba.",
          });
        }

        // ================================================
        // PRICE
        // ================================================

        let price;

        if (
          req.body?.price !== undefined
        ) {
          price =
            Number(req.body.price);

          if (
            !Number.isInteger(price) ||
            price < 0
          ) {
            return res.status(400).json({
              success: false,
              message:
                "Price bai dace ba.",
            });
          }
        }

        // ================================================
        // STUDIO
        // ================================================

        let studioId;

        if (
          req.body?.studioId !== undefined
        ) {
          if (
            req.body.studioId === null ||
            req.body.studioId === ""
          ) {
            studioId = null;
          } else {
            studioId =
              Number(
                req.body.studioId
              );

            if (
              !Number.isInteger(
                studioId
              ) ||
              studioId <= 0
            ) {
              return res.status(400).json({
                success: false,
                message:
                  "Studio ID bai dace ba.",
              });
            }

            const studio =
              await prisma.studio.findUnique({
                where: {
                  id: studioId,
                },

                select: {
                  id: true,
                  active: true,
                },
              });

            if (!studio) {
              return res.status(404).json({
                success: false,
                message:
                  "Ba a samu wannan studio/company ba.",
              });
            }

            if (!studio.active) {
              return res.status(400).json({
                success: false,
                message:
                  "Wannan studio/company ba ya aiki yanzu.",
              });
            }
          }
        }

        // ================================================
        // FEATURED
        // ================================================

        let featured;

        if (
          req.body?.featured !== undefined
        ) {
          if (
            typeof req.body.featured !==
            "boolean"
          ) {
            return res.status(400).json({
              success: false,
              message:
                "Featured ya zama true ko false.",
            });
          }

          featured =
            req.body.featured;
        }

        // ================================================
        // BUILD SAFE UPDATE DATA
        // ================================================

        const data = {};

        if (title !== undefined) {
          data.title = title;
        }

        if (
          description !== undefined
        ) {
          data.description =
            description;
        }

        if (category !== undefined) {
          data.category =
            category;
        }

        if (price !== undefined) {
          data.price = price;
        }

        if (studioId !== undefined) {
          data.studioId =
            studioId;
        }

        if (featured !== undefined) {
          data.featured =
            featured;
        }

        // IMPORTANT:
        // Wannan normal edit route ba zai taba
        // Bunny video ko trailer IDs/URLs ba.
        //
        // bunnyVideoId
        // webVideoUrl
        // trailerBunnyVideoId
        // trailerUrl

        if (
          Object.keys(data).length === 0
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Babu wani bayani da aka turo domin update.",
          });
        }

        // ================================================
        // UPDATE FILM
        // ================================================

        const updatedFilm =
          await prisma.film.update({
            where: {
              id: filmId,
            },

            data,

            select: {
              id: true,
              title: true,
              description: true,
              category: true,
              price: true,

              studioId: true,

              studio: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },

              posterFileId: true,
              posterUrl: true,

              bunnyVideoId: true,
              webVideoUrl: true,

              featured: true,

              trailerEnabled: true,
              trailerUrl: true,
              trailerBunnyVideoId: true,

              createdAt: true,
              updatedAt: true,
            },
          });

        return res.status(200).json({
          success: true,

          message:
            "An gyara film cikin nasara.",

          film: {
            ...updatedFilm,

            posterUrl:
              updatedFilm.posterUrl ||
              `/api/films/${updatedFilm.id}/poster`,
          },
        });
      } catch (error) {
        console.error(
          "❌ ADMIN UPDATE FILM ERROR:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            "An samu matsala wajen gyara film.",
        });
      }
    }
  );

  // ======================================================
  // ADMIN - FEATURED ON / OFF
  // ======================================================

  app.patch(
    "/api/admin/films/:filmId/featured",
    requireAdmin,
    async (req, res) => {
      try {
        const filmId =
          Number(req.params.filmId);

        const featured =
          req.body?.featured;

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

        if (
          typeof featured !==
          "boolean"
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Featured ya zama true ko false.",
          });
        }

        const existingFilm =
          await prisma.film.findUnique({
            where: {
              id: filmId,
            },

            select: {
              id: true,
            },
          });

        if (!existingFilm) {
          return res.status(404).json({
            success: false,
            message:
              "Ba a samu wannan film ba.",
          });
        }

        const film =
          await prisma.film.update({
            where: {
              id: filmId,
            },

            data: {
              featured,
            },

            select: {
              id: true,
              title: true,
              featured: true,
            },
          });

        return res.status(200).json({
          success: true,

          message:
            featured
              ? "An saka film a Featured."
              : "An cire film daga Featured.",

          film,
        });
      } catch (error) {
        console.error(
          "❌ ADMIN FEATURED ERROR:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            "An samu matsala wajen canza Featured.",
        });
      }
    }
  );

  // ======================================================
  // ADMIN - ADD NEW FILM
  // ======================================================

  app.post(
    "/api/admin/films",
    requireAdmin,
    async (req, res) => {
      try {
        const title =
          String(
            req.body?.title || ""
          ).trim();

        const description =
          String(
            req.body?.description || ""
          ).trim();

        const category =
          String(
            req.body?.category || ""
          ).trim();

        const price =
          Number(req.body?.price);

        // Featured must actually be boolean.
        let featured = false;

        if (
          req.body?.featured !== undefined
        ) {
          if (
            typeof req.body.featured !==
            "boolean"
          ) {
            return res.status(400).json({
              success: false,
              message:
                "Featured ya zama true ko false.",
            });
          }

          featured =
            req.body.featured;
        }

        // ================================================
        // STUDIO / COMPANY
        // ================================================

        const rawStudioId =
          req.body?.studioId;

        let studioId = null;

        if (
          rawStudioId !== undefined &&
          rawStudioId !== null &&
          rawStudioId !== ""
        ) {
          studioId =
            Number(rawStudioId);

          if (
            !Number.isInteger(studioId) ||
            studioId <= 0
          ) {
            return res.status(400).json({
              success: false,
              message:
                "Studio ID bai dace ba.",
            });
          }

          const studio =
            await prisma.studio.findUnique({
              where: {
                id: studioId,
              },

              select: {
                id: true,
                active: true,
              },
            });

          if (!studio) {
            return res.status(404).json({
              success: false,
              message:
                "Ba a samu wannan studio/company ba.",
            });
          }

          if (!studio.active) {
            return res.status(400).json({
              success: false,
              message:
                "Wannan studio/company ba ya aiki a yanzu.",
            });
          }
        }

        // ================================================
        // VALIDATION
        // ================================================

        if (!title) {
          return res.status(400).json({
            success: false,
            message:
              "Ka saka sunan film.",
          });
        }

        if (!description) {
          return res.status(400).json({
            success: false,
            message:
              "Ka saka description.",
          });
        }

        if (!category) {
          return res.status(400).json({
            success: false,
            message:
              "Ka saka category.",
          });
        }

        if (
          !Number.isInteger(price) ||
          price < 0
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Ka saka price mai kyau.",
          });
        }

        // ================================================
        // CREATE FILM
        // ================================================

        const film =
          await prisma.film.create({
            data: {
              title,
              description,
              category,
              studioId,
              price,
              featured,

              posterFileId: null,
              posterUrl: null,

              // Ba za mu hada Bunny video
              // a wannan route ba.
              bunnyVideoId: null,
              webVideoUrl: null,

              // Trailer ma zai bi
              // dedicated trailer handler.
              trailerEnabled: false,
              trailerUrl: null,
              trailerBunnyVideoId: null,
            },

            select: {
              id: true,
              title: true,
              description: true,
              category: true,

              studioId: true,

              studio: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  logoUrl: true,
                },
              },

              price: true,

              posterFileId: true,
              posterUrl: true,

              bunnyVideoId: true,
              webVideoUrl: true,

              featured: true,

              trailerEnabled: true,
              trailerUrl: true,
              trailerBunnyVideoId: true,

              createdAt: true,
              updatedAt: true,
            },
          });

        console.log(
          "✅ ADMIN FILM CREATED:",
          film.id,
          film.title,
          film.studio?.name ||
            "No studio"
        );

        return res.status(201).json({
          success: true,

          message:
            "An ƙirƙiri sabon film cikin nasara.",

          film: {
            ...film,

            posterUrl:
              film.posterUrl ||
              `/api/films/${film.id}/poster`,
          },
        });
      } catch (error) {
        console.error(
          "❌ ADMIN CREATE FILM ERROR:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            "An samu matsala wajen ƙirƙirar sabon film.",
        });
      }
    }
  );
}