import { bot, prisma, ADMIN_ID } from "../bot.js";
import { Markup } from "telegraf";

export default function registerSalesHandlers() {

bot.action("admin_sales", async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) {
    return ctx.answerCbQuery("⛔ Ba ka da izini.");
  }

  await ctx.answerCbQuery();

  const totalUsers = await prisma.user.count();

  const totalFilms = await prisma.film.count();

  const totalOrders = await prisma.order.count();

  const paidOrders = await prisma.order.count({
    where: {
      status: "paid",
    },
  });

  const revenue = await prisma.order.aggregate({
    where: {
      status: "paid",
    },
    _sum: {
      amount: true,
    },
  });

  return ctx.editMessageText(
    `📊 *NIGFILM SALES DASHBOARD*

👥 Users: ${totalUsers}

🎬 Films: ${totalFilms}

🛒 Orders: ${totalOrders}

✅ Successful Payments: ${paidOrders}

💰 Total Revenue: ₦${Number(
      revenue._sum.amount || 0
    ).toLocaleString()}`,
    {
      parse_mode: "Markdown",

      ...Markup.inlineKeyboard([
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
      ]),
    }
  );
});


}
bot.action("sales_today", async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) {
    return ctx.answerCbQuery("⛔ Ba ka da izini.");
  }

  await ctx.answerCbQuery();

  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const todayOrders = await prisma.order.count({
    where: {
      status: "paid",
      createdAt: {
        gte: start,
        lte: end,
      },
    },
  });

  const todayRevenue = await prisma.order.aggregate({
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
  });

  return ctx.reply(
    `📅 *TODAY'S SALES*

🛒 Successful Orders: ${todayOrders}

💰 Revenue Today:
₦${Number(todayRevenue._sum.amount || 0).toLocaleString()}`,
    {
      parse_mode: "Markdown",
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
});