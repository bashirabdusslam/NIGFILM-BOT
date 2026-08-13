import { bot, prisma, ADMIN_ID } from "../bot.js";
import { Markup } from "telegraf";

export default function registerBunnyFilmHandler() {
  // =================================
  // ADMIN: CREATE FILM RECORD FOR BUNNY
  // =================================

  bot.action("admin_create_bunny_film", async (ctx) => {
    try {
      const telegramId = String(ctx.from.id).trim();

      if (telegramId !== String(ADMIN_ID)) {
        return ctx.answerCbQuery("Ba ka da izini.");
      }

      const session = await prisma.adminSession.findUnique({
        where: {
          telegramId,
        },
      });

      if (!session) {
        return ctx.reply(
          "❌ Babu admin session. Ka sake fara Add Film."
        );
      }

      let filmData = {};

      try {
        filmData = JSON.parse(
          session.filmData || "{}"
        );
      } catch {
        filmData = {};
      }

      if (
        !filmData.title ||
        !filmData.description ||
        !filmData.category ||
        filmData.price === undefined ||
        !filmData.posterFileId
      ) {
        return ctx.reply(
          "❌ Bayanan film ba su cika ba. Ka sake fara Add Film."
        );
      }

      const price = Number(filmData.price);

      if (
        !Number.isInteger(price) ||
        price < 0
      ) {
        return ctx.reply(
          "❌ Farashin film bai dace ba."
        );
      }

      const film = await prisma.film.create({
        data: {
          title: filmData.title,
          description: filmData.description,
          category: filmData.category,
          price,
          posterFileId: filmData.posterFileId,

          // babu Telegram video yanzu
          videoFileId: null,

          bunnyVideoId: null,
          webVideoUrl: null,
        },
      });

      await prisma.adminSession.deleteMany({
        where: {
          telegramId,
        },
      });

      await ctx.answerCbQuery();

      return ctx.reply(
        `✅ FILM RECORD AN ƘIRƘIRA!\n\n` +
          `🎬 ${film.title}\n` +
          `🆔 Film ID: ${film.id}\n` +
          `💰 ₦${Number(
            film.price
          ).toLocaleString()}\n\n` +
          `Mataki na gaba: upload actual video zuwa Bunny Stream.`,
        {
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback(
                "🐰 Create Bunny Video",
                `create_bunny_${film.id}`
              ),
            ],
          ]),
        }
      );
    } catch (error) {
      console.error(
        "CREATE BUNNY FILM ERROR:",
        error
      );

      return ctx.reply(
        "❌ An samu matsala wajen ƙirƙirar Film record."
      );
    }
  });

  // =================================
  // ADMIN: CREATE BUNNY VIDEO
  // =================================

  bot.action(
    /^create_bunny_(\d+)$/,
    async (ctx) => {
      try {
        const telegramId = String(
          ctx.from.id
        ).trim();

        if (
          telegramId !== String(ADMIN_ID)
        ) {
          return ctx.answerCbQuery(
            "Ba ka da izini."
          );
        }

        const filmId = Number(
          ctx.match[1]
        );

        if (
          !Number.isInteger(filmId) ||
          filmId <= 0
        ) {
          return ctx.reply(
            "❌ Film ID bai dace ba."
          );
        }

        const film =
          await prisma.film.findUnique({
            where: {
              id: filmId,
            },
          });

        if (!film) {
          return ctx.reply(
            "❌ Ba a samu wannan film ba."
          );
        }

        // Idan ya riga ya samu Bunny ID
        if (film.bunnyVideoId) {
          await ctx.answerCbQuery();

          return ctx.reply(
            `ℹ️ Wannan film ya riga ya samu Bunny Video.\n\n` +
              `🎬 ${film.title}\n` +
              `🆔 Film ID: ${film.id}\n` +
              `🐰 Bunny ID: ${film.bunnyVideoId}`
          );
        }

        const libraryId =
          process.env
            .BUNNY_STREAM_LIBRARY_ID;

        const apiKey =
          process.env
            .BUNNY_STREAM_API_KEY;

        if (!libraryId || !apiKey) {
          return ctx.reply(
            "❌ Bunny Stream config bai cika ba."
          );
        }

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
                title: film.title,
              }),
            }
          );

        const data =
          await response.json();

        if (
          !response.ok ||
          !data?.guid
        ) {
          console.error(
            "BUNNY CREATE VIDEO ERROR:",
            data
          );

          return ctx.reply(
            "❌ An kasa ƙirƙirar video a Bunny."
          );
        }

        const bunnyVideoId =
          data.guid;

        const webVideoUrl =
          `https://player.mediadelivery.net/embed/${libraryId}/${bunnyVideoId}`;

        await prisma.film.update({
          where: {
            id: film.id,
          },

          data: {
            bunnyVideoId,
            webVideoUrl,
          },
        });

        await ctx.answerCbQuery();

        return ctx.reply(
          `✅ BUNNY VIDEO AN ƘIRƘIRA!\n\n` +
            `🎬 ${film.title}\n` +
            `🆔 Film ID: ${film.id}\n` +
            `🐰 Bunny ID: ${bunnyVideoId}\n\n` +
            `Yanzu actual video zai iya upload zuwa Bunny Stream.`,
          {
            ...Markup.inlineKeyboard([
  [
    Markup.button.url(
      "⬆️ Upload Film",
      `${
        process.env.PUBLIC_BASE_URL ||
        "https://nigfilm-bot.onrender.com"
      }/admin/upload-film/${film.id}?token=${encodeURIComponent(
        process.env.ADMIN_UPLOAD_SECRET || ""
      )}`
    ),
  ],
  [
    Markup.button.callback(
      "📢 Publish zuwa Channel",
      `admin_publish_film_${film.id}`
    ),
  ],
  [
    Markup.button.callback(
      "⬅️ Admin Panel",
      "admin_panel"
    ),
  ],
]),
          }
        );
      } catch (error) {
        console.error(
          "CREATE BUNNY VIDEO ACTION ERROR:",
          error
        );

        return ctx.reply(
          "❌ An samu matsala wajen ƙirƙirar Bunny video."
        );
      }
    }
  );
  }