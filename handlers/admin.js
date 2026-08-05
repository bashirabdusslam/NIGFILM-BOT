import { bot, prisma, ADMIN_ID } from "../bot.js";
import { Markup } from "telegraf";

export default function registerAdminHandlers(adminMenu) {
  // ================================
  // OPEN ADMIN PANEL
  // ================================

  bot.command("admin", async (ctx) => {
    if (String(ctx.from.id) !== String(ADMIN_ID)) {
      return ctx.reply("⛔ Ba ka da izini.");
    }

    return ctx.reply(
      "👨‍💼 ADMIN PANEL\n\nZaɓi abin da kake son yi:",
      adminMenu
    );
  });

  bot.action("admin_panel", async (ctx) => {
    if (String(ctx.from.id) !== String(ADMIN_ID)) {
      return ctx.answerCbQuery("⛔ Ba ka da izini.");
    }

    await ctx.answerCbQuery().catch(() => {});

    return ctx.reply(
      "👨‍💼 *ADMIN PANEL*\n\nZaɓi abin da kake son yi:",
      {
        parse_mode: "Markdown",
        ...adminMenu,
      }
    );
  });

  // ================================
  // CHANGE PRICE
  // ================================

  bot.action(/^price_film_(\d+)$/, async (ctx) => {
    if (String(ctx.from.id) !== String(ADMIN_ID)) {
      return ctx.answerCbQuery("⛔ Ba ka da izini.");
    }

    await ctx.answerCbQuery().catch(() => {});

    const filmId = Number(ctx.match[1]);

    await prisma.adminSession.upsert({
      where: {
        telegramId: String(ctx.from.id),
      },
      update: {
        step: "change_price",
        filmData: JSON.stringify({ filmId }),
      },
      create: {
        telegramId: String(ctx.from.id),
        step: "change_price",
        filmData: JSON.stringify({ filmId }),
      },
    });

    return ctx.reply(
      "💰 Aika sabon farashin film.\n\nMisali:\n1000"
    );
  });

  // ================================
  // USERS DASHBOARD
  // ================================

  bot.action("admin_users", async (ctx) => {
    if (String(ctx.from.id) !== String(ADMIN_ID)) {
      return ctx.answerCbQuery("⛔ Ba ka da izini.");
    }

    await ctx.answerCbQuery().catch(() => {});

    const totalUsers = await prisma.user.count();

    const activeUsers = await prisma.user.count({
      where: {
        purchases: {
          some: {},
        },
      },
    });

    return ctx.reply(
      `👥 *USERS DASHBOARD*

👤 Total Users: ${totalUsers}

✅ Active Users: ${activeUsers}`,
      {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback(
              "🔍 Search User",
              "search_user"
            ),
            Markup.button.callback(
              "🆕 New Users",
              "new_users"
            ),
          ],
          [
            Markup.button.callback(
              "📋 User List",
              "user_list"
            ),
          ],
          [
            Markup.button.callback(
              "🔄 Refresh",
              "admin_users"
            ),
          ],
          [
            Markup.button.callback(
              "⬅️ Back",
              "admin_panel"
            ),
          ],
        ]),
      }
    );
  });

  // ================================
  // GET CHANNEL ID
  // ================================

  bot.command("getchannelid", async (ctx) => {
    if (String(ctx.from.id) !== String(ADMIN_ID)) {
      return ctx.reply("⛔ Ba ka da izini.");
    }

    try {
      const chat = await ctx.telegram.getChat(
        "@Nigfilm_channel"
      );

      console.log("CHANNEL ID:", chat.id);

      return ctx.reply(
        `✅ Channel ID:\n\n${chat.id}`
      );
    } catch (error) {
      console.error(
        "❌ Get Channel ID Error:",
        error
      );

      return ctx.reply(
        "❌ An samu matsala. Ka tabbatar bot ɗin Admin ne a channel."
      );
    }
  });
}