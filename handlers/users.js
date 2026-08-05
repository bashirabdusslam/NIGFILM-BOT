import { bot, prisma, ADMIN_ID } from "../bot.js";
import { Markup } from "telegraf";

const USERS_PER_PAGE = 10;

export default function registerUsersHandlers() {
  // =================================
  // USER LIST — PAGE 1
  // =================================

  bot.action("user_list", async (ctx) => {
    return showUsersPage(ctx, 1);
  });

  // =================================
  // USER LIST — OTHER PAGES
  // =================================

  bot.action(/^user_list_page_(\d+)$/, async (ctx) => {
    const page = Number(ctx.match[1]);

    return showUsersPage(ctx, page);
  });

  // =================================
  // USER DETAILS
  // =================================

  bot.action(/^admin_user_details_(\d+)$/, async (ctx) => {
    try {
      if (String(ctx.from.id) !== String(ADMIN_ID)) {
        return ctx.answerCbQuery("⛔ Ba ka da izini.");
      }

      await ctx.answerCbQuery().catch(() => {});

      const userId = Number(ctx.match[1]);

      if (!Number.isInteger(userId)) {
        return ctx.reply("❌ User ID bai dace ba.");
      }

      const user = await prisma.user.findUnique({
        where: {
          id: userId,
        },
        include: {
          orders: {
            orderBy: {
              createdAt: "desc",
            },
          },
          purchases: true,
        },
      });

      if (!user) {
        return ctx.reply("❌ Ba a samu wannan user ba.");
      }

      const paidOrders = user.orders.filter(
        (order) => order.status === "paid"
      );

      const totalSpent = paidOrders.reduce(
        (total, order) => total + Number(order.amount),
        0
      );

      const fullName =
        `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
        "N/A";

      return ctx.reply(
        `👤 *USER DETAILS*

🆔 Database ID:
${user.id}

📱 Telegram ID:
${user.telegramId}

👤 Name:
${fullName}

🔗 Username:
${user.username ? `@${user.username}` : "Babu username"}

🛒 Total Orders:
${user.orders.length}

✅ Paid Orders:
${paidOrders.length}

🎬 Films Purchased:
${user.purchases.length}

💰 Total Spent:
₦${totalSpent.toLocaleString()}

📅 Joined:
${user.createdAt.toLocaleString()}`,
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback(
                "⬅️ User List",
                "user_list"
              ),
            ],
            [
              Markup.button.callback(
                "🏠 Users Dashboard",
                "admin_users"
              ),
            ],
          ]),
        }
      );
    } catch (error) {
      console.error("USER DETAILS ERROR:", error);

      return ctx.reply(
        "❌ An samu kuskure wajen buɗe bayanan user."
      );
    }
  });

  // =================================
  // SEARCH USER
  // =================================

  bot.action("search_user", async (ctx) => {
    try {
      if (String(ctx.from.id) !== String(ADMIN_ID)) {
        return ctx.answerCbQuery("⛔ Ba ka da izini.");
      }

      await ctx.answerCbQuery().catch(() => {});

      await prisma.adminSession.upsert({
        where: {
          telegramId: String(ctx.from.id),
        },
        update: {
          step: "search_user",
          filmData: "{}",
        },
        create: {
          telegramId: String(ctx.from.id),
          step: "search_user",
          filmData: "{}",
        },
      });

      return ctx.reply(
        "🔍 Aika Telegram ID na user.\n\n" +
          "Misali:\n7356306160"
      );
    } catch (error) {
      console.error("SEARCH USER ERROR:", error);

      return ctx.reply(
        "❌ An samu kuskure wajen fara binciken user."
      );
    }
  });

  // =================================
  // NEW USERS
  // =================================

  bot.action("new_users", async (ctx) => {
    try {
      if (String(ctx.from.id) !== String(ADMIN_ID)) {
        return ctx.answerCbQuery("⛔ Ba ka da izini.");
      }

      await ctx.answerCbQuery().catch(() => {});

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const users = await prisma.user.findMany({
        where: {
          createdAt: {
            gte: sevenDaysAgo,
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 20,
      });

      if (users.length === 0) {
        return ctx.reply(
          "📭 Babu sabon user cikin kwanaki 7 da suka gabata.",
          {
            ...Markup.inlineKeyboard([
              [
                Markup.button.callback(
                  "⬅️ Back",
                  "admin_users"
                ),
              ],
            ]),
          }
        );
      }

      let message =
        `🆕 *NEW USERS — LAST 7 DAYS*\n\n` +
        `👥 An samu: ${users.length}\n\n`;

      users.forEach((user, index) => {
        const fullName =
          `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
          "N/A";

        message +=
          `${index + 1}. ${fullName}\n` +
          `🆔 ${user.telegramId}\n` +
          `📅 ${user.createdAt.toLocaleString()}\n\n`;
      });

      return ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback(
              "📋 All Users",
              "user_list"
            ),
          ],
          [
            Markup.button.callback(
              "⬅️ Back",
              "admin_users"
            ),
          ],
        ]),
      });
    } catch (error) {
      console.error("NEW USERS ERROR:", error);

      return ctx.reply(
        "❌ An samu kuskure wajen ɗauko sababbin users."
      );
    }
  });
}

// =================================
// HELPER — SHOW USERS PAGE
// =================================

async function showUsersPage(ctx, requestedPage) {
  try {
    if (String(ctx.from.id) !== String(ADMIN_ID)) {
      return ctx.answerCbQuery("⛔ Ba ka da izini.");
    }

    await ctx.answerCbQuery().catch(() => {});

    const totalUsers = await prisma.user.count();

    if (totalUsers === 0) {
      return ctx.reply("❌ Babu users.", {
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback(
              "⬅️ Back",
              "admin_users"
            ),
          ],
        ]),
      });
    }

    const totalPages = Math.max(
      1,
      Math.ceil(totalUsers / USERS_PER_PAGE)
    );

    const page = Math.min(
      Math.max(Number(requestedPage) || 1, 1),
      totalPages
    );

    const users = await prisma.user.findMany({
      orderBy: {
        createdAt: "desc",
      },
      skip: (page - 1) * USERS_PER_PAGE,
      take: USERS_PER_PAGE,
    });

    const userButtons = users.map((user) => {
      const displayName =
        user.firstName ||
        user.username ||
        `User ${user.id}`;

      return [
        Markup.button.callback(
          `👤 ${displayName}`,
          `admin_user_details_${user.id}`
        ),
      ];
    });

    const navigationButtons = [];

    if (page > 1) {
      navigationButtons.push(
        Markup.button.callback(
          "⬅️ Previous",
          `user_list_page_${page - 1}`
        )
      );
    }

    if (page < totalPages) {
      navigationButtons.push(
        Markup.button.callback(
          "Next ➡️",
          `user_list_page_${page + 1}`
        )
      );
    }

    if (navigationButtons.length > 0) {
      userButtons.push(navigationButtons);
    }

    userButtons.push([
      Markup.button.callback(
        "🏠 Users Dashboard",
        "admin_users"
      ),
    ]);

    return ctx.reply(
      `👥 *USER LIST*

📄 Page: ${page}/${totalPages}

👤 Total Users: ${totalUsers}

Zaɓi user domin ganin cikakken bayani:`,
      {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(userButtons),
      }
    );
  } catch (error) {
    console.error("USER LIST ERROR:", error);

    return ctx.reply(
      "❌ An samu kuskure wajen ɗauko jerin users."
    );
  }
}