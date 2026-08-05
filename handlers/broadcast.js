import { bot, prisma, ADMIN_ID } from "../bot.js";
import { Markup } from "telegraf";

export default function registerBroadcastHandlers() {
  // =================================
  // START BROADCAST
  // =================================

  bot.action("admin_broadcast", async (ctx) => {
    try {
      if (String(ctx.from.id) !== String(ADMIN_ID)) {
        return ctx.answerCbQuery("⛔ Ba ka da izini.");
      }

      await ctx.answerCbQuery().catch(() => {});

      const totalUsers = await prisma.user.count();

      if (totalUsers === 0) {
        return ctx.reply(
          "❌ Babu users da za a turawa saƙo.",
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

      await prisma.adminSession.upsert({
        where: {
          telegramId: String(ctx.from.id),
        },
        update: {
          step: "broadcast",
          filmData: JSON.stringify({
            totalUsers,
          }),
        },
        create: {
          telegramId: String(ctx.from.id),
          step: "broadcast",
          filmData: JSON.stringify({
            totalUsers,
          }),
        },
      });

      return ctx.reply(
        `📢 *BROADCAST MESSAGE*

👥 Users da za a turawa: ${totalUsers}

Aika saƙon da kake son turawa ga duk users.

⚠️ Da zarar ka aika saƙon, broadcast zai fara kai tsaye.`,
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback(
                "❌ Cancel Broadcast",
                "cancel_broadcast"
              ),
            ],
          ]),
        }
      );
    } catch (error) {
      console.error(
        "START BROADCAST ERROR:",
        error
      );

      return ctx.reply(
        "❌ An samu kuskure wajen fara broadcast."
      );
    }
  });

  // =================================
  // CANCEL BROADCAST
  // =================================

  bot.action("cancel_broadcast", async (ctx) => {
    try {
      if (String(ctx.from.id) !== String(ADMIN_ID)) {
        return ctx.answerCbQuery("⛔ Ba ka da izini.");
      }

      await ctx.answerCbQuery().catch(() => {});

      await prisma.adminSession.deleteMany({
        where: {
          telegramId: String(ctx.from.id),
          step: "broadcast",
        },
      });

      return ctx.reply(
        "✅ An soke broadcast.",
        {
          ...Markup.inlineKeyboard([
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
        "CANCEL BROADCAST ERROR:",
        error
      );

      return ctx.reply(
        "❌ An samu kuskure wajen soke broadcast."
      );
    }
  });
}