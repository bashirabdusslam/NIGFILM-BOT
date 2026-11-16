import {
  bot,
  prisma,
  ADMIN_ID,
  CHANNEL_ID,
} from "../bot.js";

import { Markup } from "telegraf";
import { canRetryPublishedFilmPush, queuePublishedFilmPush, readPublishedFilmPush } from "./pushNotifications.js";
import { telegramErrorCode } from "./telegramPoster.js";

function appPushStatus(campaign) {
  if (!campaign) return "Ba a saka sanarwar fim ɗin a layin aikawa ba tukuna.";
  const state = {
    QUEUED:"Yana jira", SENDING:"Ana aikawa", FINISHED:"An gama ƙoƙarin aikawa", FAILED:"Aikawa ya gaza",
  }[campaign.status] || "Ba a san halin aikawa ba";
  return `${state}. Firebase ya karɓa: ${campaign.accepted}. Sun gaza: ${campaign.failed}.` +
    (campaign.errorCode ? ` Lambar kuskure: ${campaign.errorCode}.` : "");
}

function appPushResult(push) {
  if (push.status === "alreadyQueued") return appPushStatus(push.campaign);
  return {
    queued:`An saka sanarwar Android a layin aikawa (${push.estimatedDevices} na’ura).`,
    notConfigured:"Ba a saita Firebase a backend ba tukuna.",
    notReady:"Fim bai shirya don kallo a app ba tukuna. A tabbatar video yana Playable ko Ready.",
    noDevices:"Babu na’urar Android da ta yi rajistar sanarwa tukuna.",
    hidden:"Fim yana ɓoye a catalog; ba a tura sanarwa ba.",
  }[push.status] || "Ba a san halin aikawa ba.";
}

function appPushButton(filmId, action = "status") {
  return Markup.button.callback(action === "status" ? "📱 Duba sanarwar app" : "📱 Aika zuwa app kawai", `admin_film_app_${action}_${filmId}`);
}

export default function registerFilmHandlers() {
  bot.action(/^admin_film_app_(status|send)_(\d+)$/, async (ctx) => {
    if (String(ctx.from.id) !== String(ADMIN_ID)) return ctx.answerCbQuery("⛔ Ba ka da izini.");
    await ctx.answerCbQuery().catch(() => {});
    const [, action, id] = ctx.match;
    const filmId = Number(id);
    if (!Number.isSafeInteger(filmId) || filmId < 1 || filmId > 2147483647) return;
    try {
      if (action === "status") {
        const campaign = await readPublishedFilmPush(prisma,filmId);
        const canSend = !campaign || canRetryPublishedFilmPush(campaign);
        return ctx.reply(`📱 NIGFILM App — Fim #${filmId}\n${appPushStatus(campaign)}`,
          Markup.inlineKeyboard([[appPushButton(filmId)], ...(canSend ? [[appPushButton(filmId,"send")]] : [])]));
      }
      const film = await prisma.film.findUnique({where:{id:filmId}});
      if (!film) return ctx.reply("❌ Ba a samu wannan fim ba.");
      const push = await queuePublishedFilmPush({prisma,film,baseUrl:process.env.PUBLIC_BASE_URL?.trim(),retry:true});
      return ctx.reply(`📱 NIGFILM App — Fim #${filmId}\n${appPushResult(push)}`,
        Markup.inlineKeyboard([[appPushButton(filmId)]]));
    } catch (error) {
      console.error("APP FILM PUSH FAILED:",telegramErrorCode(error));
      return ctx.reply("❌ An samu matsala wajen duba ko aika sanarwar app.");
    }
  });

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
              "📢 Push Public",
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
                "📢 Push Public",
                `admin_publish_film_${film.id}`
              ),
            ],
            [appPushButton(film.id), appPushButton(film.id,"send")],
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

bot.action(/^confirm_delete_(\d+)$/, async (ctx) => {
  try {
    if (String(ctx.from.id) !== String(ADMIN_ID)) {
      return ctx.answerCbQuery("⛔ Ba ka da izini.");
    }

    await ctx.answerCbQuery().catch(() => {});

    const filmId = Number(ctx.match[1]);

    if (!Number.isInteger(filmId)) {
      return ctx.reply("❌ Film ID bai dace ba.");
    }

    const film = await prisma.film.findUnique({
      where: {
        id: filmId,
      },
    });

    if (!film) {
      return ctx.reply(
        "❌ Ba a samu wannan film ba."
      );
    }

    // Fara goge duk records masu alaƙa da film
    await prisma.$transaction([
      prisma.purchase.deleteMany({
        where: {
          filmId,
        },
      }),

      prisma.cart.deleteMany({
        where: {
          filmId,
        },
      }),

      prisma.order.deleteMany({
        where: {
          filmId,
        },
      }),

      prisma.film.delete({
        where: {
          id: filmId,
        },
      }),
    ]);

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
    console.error("DELETE FILM ERROR:", error);

    return ctx.reply(
      "❌ An kasa goge film. Duba Render Logs."
    );
  }
});
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
// PUBLISH FILM TO CHANNEL + USERS
// =================================

bot.action(
  /^admin_publish_film_(\d+)$/,
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

      if (!Number.isInteger(filmId)) {
        return ctx.reply(
          "❌ Film ID bai dace ba."
        );
      }

      const film = await prisma.film.findUnique({
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
          "❌ Wannan film ba shi da poster."
        );
      }

      let appStatus;
      try {
        const push = await queuePublishedFilmPush({prisma,film,baseUrl:process.env.PUBLIC_BASE_URL?.trim()});
        appStatus = appPushResult(push);
      } catch (error) {
        console.error("APP FILM PUSH FAILED:", telegramErrorCode(error));
        appStatus = "An kasa saka sanarwar app a layin aikawa.";
      }
      await ctx.reply(`📱 NIGFILM App — Fim #${filmId}\n${appStatus}`,
        Markup.inlineKeyboard([[appPushButton(filmId)]])).catch(() => {});

      const botUsername =
        process.env.BOT_USERNAME ||
        "Nigfilm_bot";

      const buyLink =
        `https://t.me/${botUsername}?start=film_${film.id}`;


      const caption =
        `🎬 *${escapeMarkdown(film.title)}*

📝 ${escapeMarkdown(
          film.description || ""
        )}

📂 Category: ${escapeMarkdown(
          film.category || ""
        )}
💰 Price: ₦${Number(
          film.price
        ).toLocaleString()}

━━━━━━━━━━━━━━━
🔥 Sabon film yana nan yanzu.

👇 Zaɓi abin da kake son yi:`;

      // =================================
      // SEND TO CHANNEL
      // =================================

      let channelStatus = "An tura cikin nasara.";
      try {
        await bot.telegram.sendPhoto(
          CHANNEL_ID,
          film.posterFileId,
          {
            caption,
            parse_mode: "Markdown",
            ...Markup.inlineKeyboard([[
              Markup.button.url("💳 BUY NOW", buyLink),
              Markup.button.callback("🛒 ADD TO CART", `channel_add_cart_${film.id}`),
            ]]),
          }
        );
      } catch (error) {
        console.error("FILM CHANNEL PUBLISH FAILED:", error?.code || error?.name);
        channelStatus = "An kasa tura zuwa Channel.";
      }

      // =================================
      // SEND TO ALL BOT USERS
      // =================================

      const users = await prisma.user.findMany({
        select: {
          telegramId: true,
        },
      });

      let delivered = 0;
      let failed = 0;

      for (const user of users) {
        try {
          await bot.telegram.sendPhoto(
            user.telegramId,
            film.posterFileId,
            {
              caption,
              parse_mode: "Markdown",
              ...Markup.inlineKeyboard([
                [
                  Markup.button.callback(
                    "💳 BUY NOW",
                    `buy_now_${film.id}`
                  ),
                  Markup.button.callback(
                    "🛒 ADD TO CART",
                    `add_to_cart_${film.id}`
                  ),
                ],
                [
                  Markup.button.callback(
                    "📥 DOWNLOAD",
                    `download_${film.id}`
                  ),
                ],
              ]),
            }
          );

          delivered += 1;
        } catch (error) {
          failed += 1;

          console.error(
            `PUBLISH USER FAILED ${user.telegramId}:`,
            telegramErrorCode(error)
          );
        }

        await delay(100);
      }

      return ctx.reply(
        `✅ *PUBLISH YA KAMMALA*

🎬 Film:
${escapeMarkdown(film.title)}

📢 Channel:
${channelStatus}

📱 NIGFILM App:
${appStatus}

👥 Total Bot Users:
${users.length}

✅ Delivered:
${delivered}

❌ Failed:
${failed}`,
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            [appPushButton(film.id)],
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
        "PUBLISH FILM ERROR:",
        telegramErrorCode(error)
      );

      return ctx.reply(
        "❌ An samu kuskure wajen publish film."
      );
    }
  }
);

// Wannan } yana rufe registerFilmHandlers()
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

// =================================
// HELPER: DELAY
// =================================

function delay(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

// =================================
// HELPER: ESCAPE MARKDOWN
// =================================

function escapeMarkdown(value) {
  return String(value ?? "").replace(
    /([_*[\]()~`>#+\-=|{}.!])/g,
    "\\$1"
  );
}