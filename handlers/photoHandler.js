import { bot, prisma, ADMIN_ID } from "../bot.js";

export default function registerPhotoHandlers() {
  bot.on("photo", async (ctx) => {
    try {
      const telegramId = String(ctx.from.id).trim();

      if (telegramId !== String(ADMIN_ID)) {
        return;
      }

      const session = await prisma.adminSession.findUnique({
        where: {
          telegramId,
        },
      });

      if (!session) {
        return;
      }

      if (
        session.step !== "poster" &&
        session.step !== "change_poster"
      ) {
        return;
      }

      let filmData = {};

      try {
        filmData = JSON.parse(
          session.filmData || "{}"
        );
      } catch {
        filmData = {};
      }

      const photos = ctx.message?.photo;

      if (!Array.isArray(photos) || photos.length === 0) {
        return ctx.reply(
          "❌ Ba a samu poster ɗin da ka aika ba."
        );
      }

      const poster = photos[photos.length - 1];

      // =================================
      // CHANGE EXISTING POSTER
      // =================================

      if (session.step === "change_poster") {
        const filmId = Number(filmData.filmId);

        if (!Number.isInteger(filmId)) {
          await deleteAdminSession(telegramId);

          return ctx.reply(
            "❌ Film ID bai dace ba. Ka sake buɗe Manage Films."
          );
        }

        const film = await prisma.film.findUnique({
          where: {
            id: filmId,
          },
        });

        if (!film) {
          await deleteAdminSession(telegramId);

          return ctx.reply(
            "❌ Ba a samu wannan film ba."
          );
        }

        await prisma.film.update({
          where: {
            id: filmId,
          },
          data: {
            posterFileId: poster.file_id,
          },
        });

        await deleteAdminSession(telegramId);

        return ctx.reply(
          `✅ An canza poster na "${film.title}" cikin nasara.`
        );
      }

      // =================================
      // POSTER FOR NEW FILM
      // =================================

      if (
        !filmData.title ||
        !filmData.description ||
        !filmData.category ||
        filmData.price === undefined
      ) {
        await deleteAdminSession(telegramId);

        return ctx.reply(
          "❌ Bayanan film ba su cika ba.\n\nKa sake fara Add Film."
        );
      }

      filmData.posterFileId = poster.file_id;

      await prisma.adminSession.update({
        where: {
          telegramId,
        },
        data: {
          step: "video",
          filmData: JSON.stringify(filmData),
        },
      });

      return ctx.reply(
        "✅ An karɓi poster ɗin film.\n\n" +
          "Mataki na 6/6\n\n" +
          "🎥 Yanzu aika VIDEO ɗin film ɗin."
      );
    } catch (error) {
      console.error(
        "PHOTO HANDLER ERROR:",
        error
      );

      return ctx.reply(
        "❌ An samu kuskure wajen karɓar poster."
      );
    }
  });
}

// =================================
// DELETE ADMIN SESSION
// =================================

async function deleteAdminSession(telegramId) {
  await prisma.adminSession.deleteMany({
    where: {
      telegramId,
    },
  });
}