import { bot, prisma, ADMIN_ID } from "../bot.js";
import { Markup } from "telegraf";

export default function registerPhotoHandlers() {
  bot.on("photo", async (ctx) => {
    try {
      const telegramId = String(ctx.from.id).trim();

      if (telegramId !== String(ADMIN_ID)) {
        return;
      }

      const session =
        await prisma.adminSession.findUnique({
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

      const photos =
        ctx.message?.photo;

      if (
        !Array.isArray(photos) ||
        photos.length === 0
      ) {
        return ctx.reply(
          "❌ Ba a samu poster ɗin da ka aika ba."
        );
      }

      const poster =
        photos[photos.length - 1];

      // =================================
      // CHANGE EXISTING POSTER
      // =================================

      if (
        session.step ===
        "change_poster"
      ) {
        const filmId =
          Number(
            filmData.filmId
          );

        if (
          !Number.isInteger(
            filmId
          ) ||
          filmId <= 0
        ) {
          await deleteAdminSession(
            telegramId
          );

          return ctx.reply(
            "❌ Film ID bai dace ba. Ka sake buɗe Manage Films."
          );
        }

        const film =
          await prisma.film.findUnique({
            where: {
              id: filmId,
            },
          });

        if (!film) {
          await deleteAdminSession(
            telegramId
          );

          return ctx.reply(
            "❌ Ba a samu wannan film ba."
          );
        }

        await prisma.film.update({
          where: {
            id: filmId,
          },

          data: {
            posterFileId:
              poster.file_id,
          },
        });

        await deleteAdminSession(
          telegramId
        );

        return ctx.reply(
          `✅ An canza poster na "${film.title}" cikin nasara.`,
          {
            ...Markup.inlineKeyboard([
              [
                Markup.button.callback(
                  "⚙️ Manage Film",
                  `film_manage_${film.id}`
                ),
              ],
              [
                Markup.button.callback(
                  "⬅️ Manage Films",
                  "admin_manage_films"
                ),
              ],
            ]),
          }
        );
      }

      // =================================
      // POSTER FOR NEW FILM
      // =================================

      if (
        !filmData.title ||
        !filmData.description ||
        !filmData.category ||
        filmData.price ===
          undefined
      ) {
        await deleteAdminSession(
          telegramId
        );

        return ctx.reply(
          "❌ Bayanan film ba su cika ba.\n\nKa sake fara Add Film."
        );
      }

      const price =
        Number(
          filmData.price
        );

      if (
        !Number.isInteger(
          price
        ) ||
        price < 0
      ) {
        await deleteAdminSession(
          telegramId
        );

        return ctx.reply(
          "❌ Farashin film bai dace ba.\n\nKa sake fara Add Film."
        );
      }

      filmData.posterFileId =
        poster.file_id;

      // =================================
      // MU BAR SESSION A NAN
      // domin bunnyFilmHandler.js ya karanta
      // filmData sannan ya create Film record
      // =================================

      await prisma.adminSession.update({
        where: {
          telegramId,
        },

        data: {
          step:
            "ready_for_bunny",

          filmData:
            JSON.stringify(
              filmData
            ),
        },
      });

      return ctx.reply(
        "✅ An karɓi poster ɗin film.\n\n" +
          "Bayanan film sun cika.\n\n" +
          "🎬 Mataki na gaba: ƙirƙiri Film record sannan mu haɗa shi da Bunny Stream.",
        {
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback(
                "🎬 Create Film",
                "admin_create_bunny_film"
              ),
            ],
            [
              Markup.button.callback(
                "❌ Cancel",
                "admin_panel"
              ),
            ],
          ]),
        }
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

async function deleteAdminSession(
  telegramId
) {
  await prisma.adminSession.deleteMany({
    where: {
      telegramId,
    },
  });
}