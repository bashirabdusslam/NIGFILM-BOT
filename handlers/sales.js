import { bot, prisma, ADMIN_ID } from "../bot.js";
import { Markup } from "telegraf";

export default function registerSalesHandlers() {
  // =================================
  // SALES DASHBOARD
  // =================================

  bot.action("admin_sales", async (ctx) => {
    try {
      if (String(ctx.from.id) !== String(ADMIN_ID)) {
        return ctx.answerCbQuery("⛔ Ba ka da izini.");
      }

      await ctx.answerCbQuery().catch(() => {});

      const [
        totalUsers,
        totalFilms,
        totalOrders,
        paidOrders,
        pendingOrders,
        revenue,
      ] = await Promise.all([
        prisma.user.count(),
        prisma.film.count(),
        prisma.order.count(),
        prisma.order.count({
          where: {
            status: "paid",
          },
        }),
        prisma.order.count({
          where: {
            status: "pending",
          },
        }),
        prisma.order.aggregate({
          where: {
            status: "paid",
          },
          _sum: {
            amount: true,
          },
        }),
      ]);

      const message = `📊 *NIGFILM SALES DASHBOARD*

👥 Users: ${totalUsers}

🎬 Films: ${totalFilms}

🛒 Total Orders: ${totalOrders}

✅ Successful Payments: ${paidOrders}

⏳ Pending Payments: ${pendingOrders}

💰 Total Revenue: ₦${Number(
        revenue._sum.amount || 0
      ).toLocaleString()}`;

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback(
            "📅 Today",
            "sales_today"
          ),
          Markup.button.callback(
            "📆 Month",
            "sales_month"
          ),
        ],
        [
          Markup.button.callback(
            "🧾 Recent Orders",
            "recent_orders"
          ),
        ],
        [
          Markup.button.callback(
            "🔄 Refresh",
            "admin_sales"
          ),
        ],
        [
          Markup.button.callback(
            "⬅️ Back",
            "admin_panel"
          ),
        ],
      ]);

      return safeEditOrReply(ctx, message, {
        parse_mode: "Markdown",
        ...keyboard,
      });
    } catch (error) {
      console.error("ADMIN SALES ERROR:", error);

      return ctx.reply(
        "❌ An samu kuskure wajen buɗe Sales Dashboard."
      );
    }
  });

  // =================================
  // TODAY SALES
  // =================================

  bot.action("sales_today", async (ctx) => {
    try {
      if (String(ctx.from.id) !== String(ADMIN_ID)) {
        return ctx.answerCbQuery("⛔ Ba ka da izini.");
      }

      await ctx.answerCbQuery().catch(() => {});

      const start = new Date();
      start.setHours(0, 0, 0, 0);

      const end = new Date();
      end.setHours(23, 59, 59, 999);

      const [todayOrders, todayRevenue] =
        await Promise.all([
          prisma.order.count({
            where: {
              status: "paid",
              createdAt: {
                gte: start,
                lte: end,
              },
            },
          }),
          prisma.order.aggregate({
            where: {
              status: "paid",
              createdAt: {
                gte: start,
                lte: end,
              },
            },
            _sum: {
              amount: true,
            },
          }),
        ]);

      const message = `📅 *TODAY'S SALES*

🛒 Successful Orders: ${todayOrders}

💰 Revenue Today:
₦${Number(
        todayRevenue._sum.amount || 0
      ).toLocaleString()}`;

      return safeEditOrReply(ctx, message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback(
              "⬅️ Back",
              "admin_sales"
            ),
          ],
        ]),
      });
    } catch (error) {
      console.error("TODAY SALES ERROR:", error);

      return ctx.reply(
        "❌ An samu kuskure wajen ɗauko sales na yau."
      );
    }
  });

  // =================================
  // MONTH SALES
  // =================================

  bot.action("sales_month", async (ctx) => {
    try {
      if (String(ctx.from.id) !== String(ADMIN_ID)) {
        return ctx.answerCbQuery("⛔ Ba ka da izini.");
      }

      await ctx.answerCbQuery().catch(() => {});

      const start = new Date();
      start.setDate(1);
      start.setHours(0, 0, 0, 0);

      const end = new Date();

      const [monthOrders, monthRevenue] =
        await Promise.all([
          prisma.order.count({
            where: {
              status: "paid",
              createdAt: {
                gte: start,
                lte: end,
              },
            },
          }),
          prisma.order.aggregate({
            where: {
              status: "paid",
              createdAt: {
                gte: start,
                lte: end,
              },
            },
            _sum: {
              amount: true,
            },
          }),
        ]);

      const message = `📆 *MONTHLY SALES*

🛒 Successful Orders: ${monthOrders}

💰 Revenue This Month:
₦${Number(
        monthRevenue._sum.amount || 0
      ).toLocaleString()}`;

      return safeEditOrReply(ctx, message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback(
              "⬅️ Back",
              "admin_sales"
            ),
          ],
        ]),
      });
    } catch (error) {
      console.error("MONTH SALES ERROR:", error);

      return ctx.reply(
        "❌ An samu kuskure wajen ɗauko sales na wannan watan."
      );
    }
  });

  // =================================
  // RECENT ORDERS
  // =================================

  bot.action("recent_orders", async (ctx) => {
    try {
      if (String(ctx.from.id) !== String(ADMIN_ID)) {
        return ctx.answerCbQuery("⛔ Ba ka da izini.");
      }

      await ctx.answerCbQuery().catch(() => {});

      const orders = await prisma.order.findMany({
        where: {
          status: "paid",
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 10,
        include: {
          film: true,
          user: true,
        },
      });

      if (orders.length === 0) {
        return safeEditOrReply(
          ctx,
          "❌ Har yanzu babu successful orders.",
          {
            ...Markup.inlineKeyboard([
              [
                Markup.button.callback(
                  "⬅️ Back",
                  "admin_sales"
                ),
              ],
            ]),
          }
        );
      }

      let message = "🧾 *RECENT ORDERS*\n\n";

      orders.forEach((order, index) => {
        const customerName =
          `${order.user?.firstName || ""} ${
            order.user?.lastName || ""
          }`.trim() || "N/A";

        message +=
          `${index + 1}. 🎬 ${
            order.film?.title || "Unknown Film"
          }\n` +
          `👤 ${customerName}\n` +
          `🆔 ${order.telegramId}\n` +
          `💰 ₦${Number(
            order.amount
          ).toLocaleString()}\n` +
          `📅 ${order.createdAt.toLocaleString()}\n\n`;
      });

      return safeEditOrReply(ctx, message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback(
              "⬅️ Back",
              "admin_sales"
            ),
          ],
        ]),
      });
    } catch (error) {
      console.error("RECENT ORDERS ERROR:", error);

      return ctx.reply(
        "❌ An samu kuskure wajen ɗauko recent orders."
      );
    }
  });
}

// =================================
// SAFE EDIT OR REPLY
// =================================

async function safeEditOrReply(ctx, message, options) {
  try {
    return await ctx.editMessageText(
      message,
      options
    );
  } catch (error) {
    const description =
      error?.response?.description || "";

    if (
      description.includes(
        "message is not modified"
      )
    ) {
      return;
    }

    if (
      description.includes(
        "message to edit not found"
      ) ||
      description.includes(
        "message can't be edited"
      )
    ) {
      return ctx.reply(message, options);
    }

    throw error;
  }
}