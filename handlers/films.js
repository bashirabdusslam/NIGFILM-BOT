import {
  bot,
  prisma,
  ADMIN_ID,
  CHANNEL_ID,
} from "../bot.js";

import { Markup } from "telegraf";

export default function registerFilmHandlers() {
  // =================================
  // ADD FILM
  // =================================

  bot.action("admin_add_film", async (ctx) => {
    if (String(ctx.from.id) !== String(ADMIN_ID)) {
      return ctx.answerCbQuery("⛔ Ba ka da izini.");
    }

    await ctx.answerCbQuery().catch(() => {});

    await prisma.adminSession.upsert({
      where: {
        telegramId: String(ctx.from.id),
      },
      update: {
        step: "title",
        filmData: JSON.stringify({}),
      },
      create: {
        telegramId: String(ctx.from.id),
        step: "title",
        filmData: JSON.stringify({}),
      },
    });

    return ctx.reply(
      "🎬 ADD FILM\n\n" +
        "Mataki na 1/6\n\n" +
        "📝 Aika sunan film ɗin:"
    );
  });

  // =================================
  // MANAGE FILMS
  // =================================

  bot.action("admin_manage_films", async (ctx) => {
    try {
      if (String(ctx.from.id) !== String(ADMIN_ID)) {
        return ctx.answerCbQuery("⛔ Ba ka da izini.");
      }

      await ctx.answerCbQuery().catch(() => {});

      const films = await prisma.film.findMany({
        orderBy: {
          createdAt: "desc",
        },
      });

      if (films.length === 0) {
        return ctx.reply(
          "❌ Babu wani film a database.",
          {
            ...Markup.inlineKeyboard([
              [
                Markup.button.callback(
                  "⬅️ Back",
                  "admin_panel"
                ),
              ],
            ]),
          }
        );
      }

      await ctx.reply(
        `🎞️ An samu films ${films.length}.\n\nZaɓi film ɗin da kake son sarrafawa.`
      );

      for (const film of films) {
        const caption =
          `🎬 *${film.title}*\n\n` +
          `📂 ${film.category}\n` +
          `💰 ₦${Number(
            film.price
          ).toLocaleString()}`;

        const keyboard = Markup.inlineKeyboard([
          [
            Markup.button.callback(
              "⚙️ Manage",
              `film_manage_${film.id}`
            ),
          ],
          [
            Markup.button.callback(
              "📢 Publish",
              `admin_publish_film_${film.id}`
            ),
            Markup.button.callback(
              "🗑 Delete",
              `delete_film_${film.id}`
            ),
          ],
        ]);

        if (film.posterFileId) {
          await ctx.replyWithPhoto(
            film.posterFileId,
            {
              caption,
              parse_mode: "Markdown",
              ...keyboard,
            }
          );
        } else {
          await ctx.reply(caption, {
            parse_mode: "Markdown",
            ...keyboard,
          });
        }
      }

      return ctx.reply("👇 Komawa Admin Panel:", {
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback(
              "⬅️ Admin Panel",
              "admin_panel"
            ),
          ],
        ]),
      });
    } catch (error) {
      console.error(
        "MANAGE FILMS ERROR:",
        error
      );

      return ctx.reply(
        "❌ An samu kuskure wajen ɗauko films."
      );
    }
  });

  // =================================
  // FILM MANAGEMENT DETAILS
  // =================================

  bot.action(
    /^film_manage_(\d+)$/,
    async (ctx) => {
      try {
        if (
          String(ctx.from.id) !== String(ADMIN_ID)
        ) {
          return ctx.answerCbQuery(
            "⛔ Ba ka da izini."
          );
        }

        await ctx.answerCbQuery().catch(() => {});

        const filmId = Number(ctx.match[1]);

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

        const caption =
          `🎬 *${film.title}*\n\n` +
          `📝 ${film.description}\n\n` +
          `📂 Category: ${film.category}\n` +
          `💰 Price: ₦${Number(
            film.price
          ).toLocaleString()}\n\n` +
          `🆔 Film ID: ${film.id}`;

        const keyboard =
          Markup.inlineKeyboard([
            [
              Markup.button.callback(
                "✏️ Edit Title",
                `edit_title_${film.id}`
              ),
              Markup.button.callback(
                "💰 Edit Price",
                `edit_price_${film.id}`
              ),
            ],
            [
              Markup.button.callback(
                "📝 Edit Description",
                `edit_description_${film.id}`
              ),
            ],
            [
              Markup.button.callback(
                "📂 Edit Category",
                `edit_category_${film.id}`
              ),
            ],
            [
              Markup.button.callback(
                "🖼 Change Poster",
                `change_poster_${film.id}`
              ),
              Markup.button.callback(
                "🎥 Change Video",
                `change_video_${film.id}`
              ),
            ],
            [
              Markup.button.callback(
                "📢 Publish",
                `admin_publish_film_${film.id}`
              ),
            ],
            [
              Markup.button.callback(
                "🗑 Delete Film",
                `delete_film_${film.id}`
              ),
            ],
            [
              Markup.button.callback(
                "⬅️ Manage Films",
                "admin_manage_films"
              ),
            ],
          ]);

        if (film.posterFileId) {
          return ctx.replyWithPhoto(
            film.posterFileId,
            {
              caption,
              parse_mode: "Markdown",
              ...keyboard,
            }
          );
        }

        return ctx.reply(caption, {
          parse_mode: "Markdown",
          ...keyboard,
        });
      } catch (error) {
        console.error(
          "FILM MANAGEMENT ERROR:",
          error
        );

        return ctx.reply(
          "❌ An samu kuskure wajen buɗe film."
        );
      }
    }
  );

  // =================================
  // EDIT TITLE
  // =================================

  bot.action(
    /^edit_title_(\d+)$/,
    async (ctx) => {
      if (
        String(ctx.from.id) !== String(ADMIN_ID)
      ) {
        return ctx.answerCbQuery(
          "⛔ Ba ka da izini."
        );
      }

      await ctx.answerCbQuery().catch(() => {});

      const filmId = Number(ctx.match[1]);

      await saveFilmEditSession(
        ctx,
        "edit_title",
        filmId
      );

      return ctx.reply(
        "📝 Aika sabon sunan film."
      );
    }
  );

  // =================================
  // EDIT DESCRIPTION
  // =================================

  bot.action(
    /^edit_description_(\d+)$/,
    async (ctx) => {
      if (
        String(ctx.from.id) !== String(ADMIN_ID)
      ) {
        return ctx.answerCbQuery(
          "⛔ Ba ka da izini."
        );
      }

      await ctx.answerCbQuery().catch(() => {});

      const filmId = Number(ctx.match[1]);

      await saveFilmEditSession(
        ctx,
        "edit_description",
        filmId
      );

      return ctx.reply(
        "📝 Aika sabon description na film."
      );
    }
  );

  // =================================
  // EDIT CATEGORY
  // =================================

  bot.action(
    /^edit_category_(\d+)$/,
    async (ctx) => {
      if (
        String(ctx.from.id) !== String(ADMIN_ID)
      ) {
        return ctx.answerCbQuery(
          "⛔ Ba ka da izini."
        );
      }

      await ctx.answerCbQuery().catch(() => {});

      const filmId = Number(ctx.match[1]);

      await saveFilmEditSession(
        ctx,
        "edit_category",
        filmId
      );

      return ctx.reply(
        "📂 Aika sabon category na film."
      );
    }
  );

  // =================================
  // EDIT PRICE
  // =================================

  bot.action(
    /^edit_price_(\d+)$/,
    async (ctx) => {
      if (
        String(ctx.from.id) !== String(ADMIN_ID)
      ) {
        return ctx.answerCbQuery(
          "⛔ Ba ka da izini."
        );
      }

      await ctx.answerCbQuery().catch(() => {});

      const filmId = Number(ctx.match[1]);

      await saveFilmEditSession(
        ctx,
        "edit_price",
        filmId
      );

      return ctx.reply(
        "💰 Aika sabon farashin film.\n\n" +
          "Misali:\n500"
      );
    }
  );

  // =================================
  // CHANGE POSTER
  // =================================

  bot.action(
    /^change_poster_(\d+)$/,
    async (ctx) => {
      if (
        String(ctx.from.id) !== String(ADMIN_ID)
      ) {
        return ctx.answerCbQuery(
          "⛔ Ba ka da izini."
        );
      }

      await ctx.answerCbQuery().catch(() => {});

      const filmId = Number(ctx.match[1]);

      await saveFilmEditSession(
        ctx,
        "change_poster",
        filmId
      );

      return ctx.reply(
        "🖼️ Yanzu aika sabon POSTER na film."
      );
    }
  );

  // =================================
  // CHANGE VIDEO
  // =================================

  bot.action(
    /^change_video_(\d+)$/,
    async (ctx) => {
      if (
        String(ctx.from.id) !== String(ADMIN_ID)
      ) {
        return ctx.answerCbQuery(
          "⛔ Ba ka da izini."
        );
      }

      await ctx.answerCbQuery().catch(() => {});

      const filmId = Number(ctx.match[1]);

      await saveFilmEditSession(
        ctx,
        "change_video",
        filmId
      );

      return ctx.reply(
        "🎥 Yanzu aika sabon VIDEO na film."
      );
    }
  );

  // =================================
  // DELETE FILM
  // =================================

  bot.action(
    /^delete_film_(\d+)$/,
    async (ctx) => {
      if (
        String(ctx.from.id) !== String(ADMIN_ID)
      ) {
        return ctx.answerCbQuery(
          "⛔ Ba ka da izini."
        );
      }

      await ctx.answerCbQuery().catch(() => {});

      const filmId = Number(ctx.match[1]);

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

      return ctx.reply(
        `⚠️ Kana tabbatar kana son goge wannan film?\n\n🎬 ${film.title}\n\n❗ Za a goge orders, purchases da cart records masu alaƙa da shi.`,
        {
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback(
                "✅ YES, DELETE",
                `confirm_delete_${film.id}`
              ),
            ],
            [
              Markup.button.callback(
                "❌ Cancel",
                "cancel_delete"
              ),
            ],
          ]),
        }
      );
    }
  );

  // =================================
  // CONFIRM DELETE FILM
  // =================================

  bot.action(
    /^confirm_delete_(\d+)$/,
    async (ctx) => {
      try {
        if (
          String(ctx.from.id) !==
          String(ADMIN_ID)
        ) {
          return ctx.answerCbQuery(
            "⛔ Ba ka da izini."
          );
        }

        await ctx.answerCbQuery().catch(() => {});

        const filmId = Number(ctx.match[1]);

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

        await prisma.$transaction(
          async (tx) => {
            await tx.purchase.deleteMany({
              where: {
                filmId,
              },
            });

            await tx.cart.deleteMany({
              where: {
                filmId,
              },
            });

            await tx.order.deleteMany({
              where: {
                filmId,
              },
            });

            await tx.film.delete({
              where: {
                id: filmId,
              },
            });
          }
        );

        return ctx.reply(
          `✅ Film "${film.title}" an goge cikin nasara.`,
          {
            ...Markup.inlineKeyboard([
              [
                Markup.button.callback(
                  "🎞️ Manage Films",
                  "admin_manage_films"
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
          "DELETE FILM ERROR:",
          error
        );

        return ctx.reply(
          "❌ An kasa goge film. Duba Render Logs."
        );
      }
    }
  );

  // =================================
  // CANCEL DELETE
  // =================================

  bot.action("cancel_delete", async (ctx) => {
    if (String(ctx.from.id) !== String(ADMIN_ID)) {
      return ctx.answerCbQuery("⛔ Ba ka da izini.");
    }

    await ctx.answerCbQuery().catch(() => {});

    return ctx.reply("✅ An soke goge film.", {
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback(
            "🎞️ Manage Films",
            "admin_manage_films"
          ),
        ],
      ]),
    });
  });

  // =================================
  // PUBLISH FILM TO CHANNEL
  // =================================

  bot.action(
    /^admin_publish_film_(\d+)$/,
    async (ctx) => {
      try {
        if (
          String(ctx.from.id) !==
          String(ADMIN_ID)
        ) {
          return ctx.answerCbQuery(
            "⛔ Ba ka da izini."
          );
        }

        await ctx.answerCbQuery().catch(() => {});

        const filmId = Number(ctx.match[1]);

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

        if (!film.posterFileId) {
          return ctx.reply(
            "❌ Wannan film ba shi da poster. Ka saka poster kafin publish."
          );
        }

        if (!CHANNEL_ID) {
          return ctx.reply(
            "❌ CHANNEL_ID baya cikin environment variables."
          );
        }

        const caption =
          `🎬 *${film.title}*\n\n` +
          `📝 ${film.description}\n\n` +
          `📂 Category: ${film.category}\n` +
          `💰 Price: ₦${Number(
            film.price
          ).toLocaleString()}\n\n` +
          "━━━━━━━━━━━━━━━\n" +
          "🔥 Kalli wannan fim cikin inganci.\n\n" +
          "👇 Danna BUY NOW domin siya.";

        await bot.telegram.sendPhoto(
          CHANNEL_ID,
          film.posterFileId,
          {
            caption,
            parse_mode: "Markdown",
            ...Markup.inlineKeyboard([
              [
                Markup.button.url(
                  "💳 BUY NOW",
                  `https://t.me/Nigfilm_bot?start=film_${film.id}`
                ),
              ],
            ]),
          }
        );

        return ctx.reply(
          `✅ An publish "${film.title}" zuwa channel cikin nasara.`
        );
      } catch (error) {
        console.error(
          "PUBLISH FILM ERROR:",
          error
        );

        return ctx.reply(
          "❌ An samu kuskure wajen publish film."
        );
      }
    }
  );
}

// =================================
// HELPER: SAVE EDIT SESSION
// =================================

async function saveFilmEditSession(
  ctx,
  step,
  filmId
) {
  await prisma.adminSession.upsert({
    where: {
      telegramId: String(ctx.from.id),
    },
    update: {
      step,
      filmData: JSON.stringify({
        filmId,
      }),
    },
    create: {
      telegramId: String(ctx.from.id),
      step,
      filmData: JSON.stringify({
        filmId,
      }),
    },
  });
}