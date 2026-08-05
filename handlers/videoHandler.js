import { bot, prisma, ADMIN_ID } from "../bot.js";
import { Markup } from "telegraf";

export default function registerVideoHandlers() {
  bot.on("video", async (ctx) => {
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
        session.step !== "video" &&
        session.step !== "change_video"
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

      const videoFileId =
        ctx.message?.video?.file_id;

      if (!videoFileId) {
        return ctx.reply(
          "❌ Ba a samu video ɗin da ka aika ba."
        );
      }

      // =================================
      // CHANGE EXISTING VIDEO
      // =================================

      if (session.step === "change_video") {
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
            videoFileId,
          },
        });

        await deleteAdminSession(telegramId);

        return ctx.reply(
          `✅ An canza VIDEO na "${film.title}" cikin nasara.`,
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
      // CREATE NEW FILM
      // =================================

      if (
        !filmData.title ||
        !filmData.description ||
        !filmData.category ||
        filmData.price === undefined ||
        !filmData.posterFileId
      ) {
        await deleteAdminSession(telegramId);

        return ctx.reply(
          "❌ Bayanan film ba su cika ba.\n\nKa sake fara Add Film."
        );
      }

      const price = Number(filmData.price);

      if (!Number.isInteger(price) || price < 0) {
        await deleteAdminSession(telegramId);

        return ctx.reply(
          "❌ Farashin film bai dace ba.\n\nKa sake fara Add Film."
        );
      }

      const film = await prisma.film.create({
        data: {
          title: filmData.title,
          description: filmData.description,
          category: filmData.category,
          price,
          posterFileId: filmData.posterFileId,
          videoFileId,
        },
      });

      await deleteAdminSession(telegramId);

      return ctx.reply(
        `✅ *FILM AN ADANA CIKIN NASARA!*

🎬 Suna: ${escapeMarkdown(film.title)}

💰 Farashi: ₦${Number(
          film.price
        ).toLocaleString()}

📂 Category: ${escapeMarkdown(
          film.category
        )}

📢 Danna ƙasa domin tura shi zuwa Channel:`,
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback(
                "📢 Publish zuwa Channel",
                `admin_publish_film_${film.id}`
              ),
            ],
            [
              Markup.button.callback(
                "⚙️ Manage Film",
                `film_manage_${film.id}`
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
        "VIDEO HANDLER ERROR:",
        error
      );

      return ctx.reply(
        "❌ An samu kuskure wajen adana video ko film."
      );
    }
  });
}

// =================================
// HELPERS
// =================================

async function deleteAdminSession(telegramId) {
  await prisma.adminSession.deleteMany({
    where: {
      telegramId,
    },
  });
}

function escapeMarkdown(value) {
  return String(value ?? "").replace(
    /([_*[\]()~`>#+\-=|{}.!])/g,
    "\\$1"
  );
}