import { bot, prisma } from "../bot.js";

export default function registerWebFilmHandlers(app) {

  // ======================================================
  // GET ALL FILMS
  // ======================================================

  app.get("/api/films", async (req, res) => {
    try {
      const films = await prisma.film.findMany({
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
              logoUrl: true,
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
        },
      });

      const result = films.map((film) => ({
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
        "❌ GET FILMS API ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "An samu matsala wajen ɗauko fina-finai.",
      });
    }
  });


  // ======================================================
  // GET SINGLE FILM
  // ======================================================

  app.get("/api/films/:id", async (req, res) => {
    try {
      const filmId = Number(req.params.id);

      if (
        !Number.isInteger(filmId) ||
        filmId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Film ID bai dace ba.",
        });
      }

      const film = await prisma.film.findUnique({
        where: {
          id: filmId,
        },

        select: {
          id: true,
          title: true,
          description: true,
          category: true,
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
        },
      });

      if (!film) {
        return res.status(404).json({
          success: false,
          message: "Ba a samu wannan film ba.",
        });
      }

      return res.status(200).json({
        success: true,

        film: {
          ...film,

          posterUrl:
            film.posterUrl ||
            `/api/films/${film.id}/poster`,
        },
      });
    } catch (error) {
      console.error(
        "❌ GET SINGLE FILM API ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "An samu matsala wajen ɗauko film.",
      });
    }
  });


  // ======================================================
  // GET CATEGORIES
  // ======================================================

  app.get("/api/categories", async (req, res) => {
    try {
      const films = await prisma.film.findMany({
        select: {
          category: true,
        },
      });

      const categories = [
        ...new Set(
          films
            .map((film) => film.category)
            .filter(Boolean)
        ),
      ].sort();

      return res.status(200).json({
        success: true,
        count: categories.length,
        categories,
      });
    } catch (error) {
      console.error(
        "❌ GET CATEGORIES API ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "An samu matsala wajen ɗauko categories.",
      });
    }
  });


  // ======================================================
  // SEARCH FILMS
  // ======================================================

  app.get("/api/search", async (req, res) => {
    try {
      const query = String(
        req.query.q || ""
      ).trim();

      if (!query) {
        return res.status(200).json({
          success: true,
          count: 0,
          films: [],
        });
      }

      const films = await prisma.film.findMany({
        where: {
          OR: [
            {
              title: {
                contains: query,
                mode: "insensitive",
              },
            },
            {
              description: {
                contains: query,
                mode: "insensitive",
              },
            },
            {
              category: {
                contains: query,
                mode: "insensitive",
              },
            },
          ],
        },

        orderBy: {
          createdAt: "desc",
        },

        select: {
          id: true,
          title: true,
          description: true,
          category: true,
          price: true,
          posterFileId: true,

          bunnyVideoId: true,
          webVideoUrl: true,

          createdAt: true,
        },
      });

      const result = films.map((film) => ({
        ...film,

        posterUrl:
          `/api/films/${film.id}/poster`,
      }));

      return res.status(200).json({
        success: true,
        count: result.length,
        films: result,
      });
    } catch (error) {
      console.error(
        "❌ SEARCH FILMS API ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "An samu matsala wajen neman film.",
      });
    }
  });


  // ======================================================
  // FILM POSTER PROXY
  // ======================================================

  app.get("/api/films/:id/poster", async (req, res) => {
    try {
      const filmId = Number(req.params.id);

      if (
        !Number.isInteger(filmId) ||
        filmId <= 0
      ) {
        return res.sendStatus(400);
      }

      const film = await prisma.film.findUnique({
        where: {
          id: filmId,
        },

        select: {
          posterFileId: true,
        },
      });

      if (
        !film ||
        !film.posterFileId
      ) {
        return res.sendStatus(404);
      }

      const fileLink =
        await bot.telegram.getFileLink(
          film.posterFileId
        );

      const response =
        await fetch(fileLink.href);

      if (!response.ok) {
        console.error(
          "❌ TELEGRAM POSTER FETCH FAILED:",
          response.status
        );

        return res.sendStatus(502);
      }

      const contentType =
        response.headers.get("content-type") ||
        "image/jpeg";

      res.setHeader(
        "Content-Type",
        contentType
      );

      res.setHeader(
        "Cache-Control",
        "public, max-age=3600"
      );

      const imageBuffer =
        Buffer.from(
          await response.arrayBuffer()
        );

      return res.send(imageBuffer);
    } catch (error) {
      console.error(
        "❌ POSTER API ERROR:",
        error
      );

      return res.sendStatus(500);
    }
  });
}