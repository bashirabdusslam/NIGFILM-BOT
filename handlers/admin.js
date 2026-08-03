import { bot, ADMIN_ID } from "../bot.js";
import { Markup } from "telegraf";

export default function registerAdminHandlers(adminMenu) {
  bot.command("admin", async (ctx) => {
    if (String(ctx.from.id) !== String(ADMIN_ID)) {
      return ctx.reply("⛔ Ba ka da izinin shiga Admin Panel.");
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

    await ctx.answerCbQuery();

    return ctx.reply(
      "👨‍💼 *ADMIN PANEL*\n\nZaɓi abin da kake son yi:",
      {
        parse_mode: "Markdown",
        ...adminMenu,
      }
    );
  });
}