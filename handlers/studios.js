import { prisma } from "../bot.js";

export default function registerStudioHandlers(
  app,
  { requireAdmin }
) {
  // ======================================================
  // ADMIN - CREATE STUDIO
  // ======================================================

  app.post(
    "/api/admin/studios",
    requireAdmin,
    async (req, res) => {
      try {
        const name = String(
          req.body?.name || ""
        ).trim();

        const description = String(
          req.body?.description || ""
        ).trim();

        const logoUrl = String(
          req.body?.logoUrl || ""
        ).trim();

        if (!name) {
          return res.status(400).json({
            success: false,
            message:
              "Studio/company name is required.",
          });
        }

        // Create clean URL slug
        const slug = name
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");

        if (!slug) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid studio name.",
          });
        }

        // Prevent duplicate studio
        const existing =
          await prisma.studio.findFirst({
            where: {
              OR: [
                {
                  name: {
                    equals: name,
                    mode: "insensitive",
                  },
                },
                {
                  slug,
                },
              ],
            },
          });

        if (existing) {
          return res.status(409).json({
            success: false,
            message:
              "Wannan studio/company yana nan tuni.",
          });
        }

        const studio =
          await prisma.studio.create({
            data: {
              name,
              slug,
              description:
                description || null,
              logoUrl:
                logoUrl || null,
            },
          });

        return res.status(201).json({
          success: true,
          message:
            "An kara studio cikin nasara.",
          studio,
        });
      } catch (error) {
        console.error(
          "CREATE STUDIO ERROR:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            "An samu matsala wajen kara studio.",
        });
      }
    }
  );

  // ======================================================
  // PUBLIC - LIST STUDIOS
  // ======================================================

  app.get(
    "/api/studios",
    async (req, res) => {
      try {
        const studios =
          await prisma.studio.findMany({
            where: {
              active: true,
            },

            orderBy: {
              name: "asc",
            },

            include: {
              _count: {
                select: {
                  films: true,
                },
              },
            },
          });

        return res.status(200).json({
          success: true,
          count: studios.length,
          studios,
        });
      } catch (error) {
        console.error(
          "LIST STUDIOS ERROR:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            "An samu matsala wajen dauko studios.",
        });
      }
    }
  );

  // ======================================================
  // PUBLIC - GET ONE STUDIO + FILMS
  // ======================================================

  app.get(
    "/api/studios/:slug",
    async (req, res) => {
      try {
        const slug = String(
          req.params.slug || ""
        )
          .trim()
          .toLowerCase();

        if (!slug) {
          return res.status(400).json({
            success: false,
            message:
              "Studio slug bai dace ba.",
          });
        }

        const studio =
          await prisma.studio.findUnique({
            where: {
              slug,
            },

            include: {
              films: {
                orderBy: {
                  createdAt: "desc",
                },
              },
            },
          });

        if (
          !studio ||
          !studio.active
        ) {
          return res.status(404).json({
            success: false,
            message:
              "Studio bai samu ba.",
          });
        }

        return res.status(200).json({
          success: true,
          studio,
        });
      } catch (error) {
        console.error(
          "GET STUDIO ERROR:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            "An samu matsala wajen dauko studio.",
        });
      }
    }
  );
}