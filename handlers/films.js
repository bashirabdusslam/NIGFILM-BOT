import { bot, prisma, ADMIN_ID, CHANNEL_ID } from "../bot.js";
import { Markup } from "telegraf";

export default function registerFilmHandlers() {

  // Duk handlers na film za su shiga nan.



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

  await ctx.reply(
    "🎬 ADD FILM\n\n" +
    "Mataki na 1/6\n\n" +
    "📝 Aika sunan film ɗin:"
  );
});

// =================================
// MANAGE FILMS
// =================================

bot.action("admin_manage_films", async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) {
    return ctx.answerCbQuery("⛔ Ba ka da izini.");
  }

  await ctx.answerCbQuery();

  const films = await prisma.film.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });

  if (films.length === 0) {
    return ctx.reply("❌ Babu wani film a database.");
  }

  for (const film of films) {
    if (!film.posterFileId) {
  continue;
}
    await ctx.replyWithPhoto(film.posterFileId, {
      caption:
        `🎬 *${film.title}*\n\n` +
        `📂 ${film.category}\n` +
        `💰 ₦${Number(film.price).toLocaleString()}`,

      parse_mode: "Markdown",

      ...Markup.inlineKeyboard([
        [
          Markup.button.callback(
            "ℹ️ Details",
            `film_details_${film.id}`
          ),
        ],
        [
          Markup.button.callback(
            "✏️ Edit",
            `edit_film_${film.id}`
          ),
          Markup.button.callback(
            "💰 Price",
            `price_film_${film.id}`
          ),
        ],
        [
          Markup.button.callback(
            "🖼 Poster",
            `change_poster_${film.id}`
          ),
          Markup.button.callback(
            "🎥 Video",
            `change_video_${film.id}`
          ),
        ],
        [
          Markup.button.callback(
            "🗑 Delete",
            `delete_film_${film.id}`
          ),
        ],
      ]),
    });
  }
});

// =================================
// FILM DETAILS
// =================================

bot.action(/^film_details_(\d+)$/, async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) {
    return ctx.answerCbQuery("⛔ Ba ka da izini.");
  }

  await ctx.answerCbQuery();

  const filmId = Number(ctx.match[1]);

  const film = await prisma.film.findUnique({
    where: {
      id: filmId,
    },
  });

  if (!film) {
    return ctx.reply("❌ Ba a samu wannan film ba.");
  }

  return ctx.replyWithPhoto(film.posterFileId, {
    caption:
      `🎬 *${film.title}*\n\n` +
      `📝 ${film.description}\n\n` +
      `📂 Category: ${film.category}\n` +
      `💰 Price: ₦${Number(film.price).toLocaleString()}\n\n` +
      `🆔 Film ID: ${film.id}`,

    parse_mode: "Markdown",

    ...Markup.inlineKeyboard([
      [
        Markup.button.callback(
          "✏️ Edit Film",
          `edit_film_${film.id}`
        ),
      ],
      [
        Markup.button.callback(
          "🗑 Delete Film",
          `delete_film_${film.id}`
        ),
      ],
    ]),
  });
});

// =================================
// EDIT FILM MENU
// =================================

bot.action(/^edit_film_(\d+)$/, async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) {
    return ctx.answerCbQuery("⛔ Ba ka da izini.");
  }

  await ctx.answerCbQuery();

  const filmId = Number(ctx.match[1]);

  const film = await prisma.film.findUnique({
    where: {
      id: filmId,
    },
  });

  if (!film) {
    return ctx.reply("❌ Film ba a samu ba.");
  }

  return ctx.reply(
    `✏️ EDIT FILM

🎬 ${film.title}

Zaɓi abin da kake son gyarawa:`,
    Markup.inlineKeyboard([
      [
        Markup.button.callback(
          "📝 Title",
          `edit_title_${film.id}`
        ),
        Markup.button.callback(
          "📄 Description",
          `edit_description_${film.id}`
        ),
      ],
      [
        Markup.button.callback(
          "📂 Category",
          `edit_category_${film.id}`
        ),
        Markup.button.callback(
          "🖼 Poster",
          `edit_poster_${film.id}`
        ),
      ],
      [
        Markup.button.callback(
          "🎥 Video",
          `edit_video_${film.id}`
        ),
      ],
    ])
  );
});

// =================================
// EDIT TITLE
// =================================

bot.action(/^edit_title_(\d+)$/, async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) {
    return ctx.answerCbQuery("⛔ Ba ka da izini.");
  }

  await ctx.answerCbQuery();

  const filmId = Number(ctx.match[1]);

  await prisma.adminSession.upsert({
    where: {
      telegramId: String(ctx.from.id),
    },
    update: {
      step: "edit_title",
      filmData: JSON.stringify({
        filmId,
      }),
    },
    create: {
      telegramId: String(ctx.from.id),
      step: "edit_title",
      filmData: JSON.stringify({
        filmId,
      }),
    },
  });

  return ctx.reply(
    "📝 Aika sabon sunan film."
  );
});


// =================================
// EDIT DESCRIPTION
// =================================

bot.action(/^edit_description_(\d+)$/, async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) {
    return ctx.answerCbQuery("⛔ Ba ka da izini.");
  }

  await ctx.answerCbQuery();

  const filmId = Number(ctx.match[1]);

  await prisma.adminSession.upsert({
    where: {
      telegramId: String(ctx.from.id),
    },
    update: {
      step: "edit_description",
      filmData: JSON.stringify({
        filmId,
      }),
    },
    create: {
      telegramId: String(ctx.from.id),
      step: "edit_description",
      filmData: JSON.stringify({
        filmId,
      }),
    },
  });

  return ctx.reply(
    "📝 Aika sabon description na film."
  );
});

// =================================
// EDIT CATEGORY
// =================================

bot.action(/^edit_category_(\d+)$/, async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) {
    return ctx.answerCbQuery("⛔ Ba ka da izini.");
  }

  await ctx.answerCbQuery();

  const filmId = Number(ctx.match[1]);

  await prisma.adminSession.upsert({
    where: {
      telegramId: String(ctx.from.id),
    },
    update: {
      step: "edit_category",
      filmData: JSON.stringify({
        filmId,
      }),
    },
    create: {
      telegramId: String(ctx.from.id),
      step: "edit_category",
      filmData: JSON.stringify({
        filmId,
      }),
    },
  });

  return ctx.reply(
    "📂 Aika sabon category na film."
  );
});

// =================================
// EDIT PRICE
// =================================

bot.action(/^edit_price_(\d+)$/, async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) {
    return ctx.answerCbQuery("⛔ Ba ka da izini.");
  }

  await ctx.answerCbQuery();

  const filmId = Number(ctx.match[1]);

  await prisma.adminSession.upsert({
    where: {
      telegramId: String(ctx.from.id),
    },
    update: {
      step: "edit_price",
      filmData: JSON.stringify({
        filmId,
      }),
    },
    create: {
      telegramId: String(ctx.from.id),
      step: "edit_price",
      filmData: JSON.stringify({
        filmId,
      }),
    },
  });

  return ctx.reply(
    "💰 Aika sabon farashin film.\n\nMisali:\n500"
  );
});

// =================================
// CHANGE POSTER
// =================================

bot.action(/^change_poster_(\d+)$/, async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) {
    return ctx.answerCbQuery("⛔ Ba ka da izini.");
  }

  await ctx.answerCbQuery();

  const filmId = Number(ctx.match[1]);

  await prisma.adminSession.upsert({
    where: {
      telegramId: String(ctx.from.id),
    },
    update: {
      step: "change_poster",
      filmData: JSON.stringify({
        filmId,
      }),
    },
    create: {
      telegramId: String(ctx.from.id),
      step: "change_poster",
      filmData: JSON.stringify({
        filmId,
      }),
    },
  });

  return ctx.reply(
    "🖼️ Yanzu aika sabon POSTER na film."
  );
});
// =================================
// CHANGE VIDEO
// =================================

bot.action(/^change_video_(\d+)$/, async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) {
    return ctx.answerCbQuery("⛔ Ba ka da izini.");
  }

  await ctx.answerCbQuery();

  const filmId = Number(ctx.match[1]);

  await prisma.adminSession.upsert({
    where: {
      telegramId: String(ctx.from.id),
    },
    update: {
      step: "change_video",
      filmData: JSON.stringify({
        filmId,
      }),
    },
    create: {
      telegramId: String(ctx.from.id),
      step: "change_video",
      filmData: JSON.stringify({
        filmId,
      }),
    },
  });

  return ctx.reply(
    "🎥 Yanzu aika sabon VIDEO na film."
  );
});

// =================================
// DELETE FILM
// =================================

bot.action(/^delete_film_(\d+)$/, async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) {
    return ctx.answerCbQuery("⛔ Ba ka da izini.");
  }

  await ctx.answerCbQuery();

  const filmId = Number(ctx.match[1]);

  const film = await prisma.film.findUnique({
    where: {
      id: filmId,
    },
  });

  if (!film) {
    return ctx.reply("❌ Ba a samu film ba.");
  }

  await ctx.reply(
    `⚠️ Kana tabbatar kana son goge:\n\n🎬 ${film.title}?`,
    Markup.inlineKeyboard([
      [
        Markup.button.callback(
  "🖼 Poster",
  `change_poster_${film.id}`
),
        Markup.button.callback(
  "🎥 Video",
  `change_video_${film.id}`
),
      ],
    ])
  );
});
// =================================
// CONFIRM DELETE FILM
// =================================

bot.action(/^confirm_delete_(\d+)$/, async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) {
    return ctx.answerCbQuery("⛔ Ba ka da izini.");
  }

  await ctx.answerCbQuery();

  const filmId = Number(ctx.match[1]);

  const film = await prisma.film.findUnique({
    where: {
      id: filmId,
    },
  });

  if (!film) {
    return ctx.reply("❌ Ba a samu wannan film ba.");
  }

  await prisma.film.delete({
    where: {
      id: filmId,
    },
  });

  return ctx.reply(
    `✅ Film "${film.title}" an goge cikin nasara.`
  );
});
// =================================
// CANCEL DELETE
// =================================

bot.action("cancel_delete", async (ctx) => {
  await ctx.answerCbQuery();

  return ctx.reply(
    "✅ An soke goge film."
  );
});

// =================================
// PUBLISH FILM TO CHANNEL
// =================================

bot.action(/^admin_publish_film_(\d+)$/, async (ctx) => {
  try {
    if (String(ctx.from.id) !== String(ADMIN_ID)) {
      return ctx.answerCbQuery("⛔ Ba ka da izini.");
    }

    await ctx.answerCbQuery().catch(() => {});

    const filmId = Number(ctx.match[1]);

    const film = await prisma.film.findUnique({
      where: {
        id: filmId,
      },
    });

    if (!film) {
      return ctx.reply("❌ Ba a samu wannan film ba.");
    }

    const caption =
`🎬 *${film.title}*

📝 ${film.description}

📂 Category: ${film.category}
💰 Price: ₦${Number(film.price).toLocaleString()}

━━━━━━━━━━━━━━━
🔥 Kalli wannan fim cikin inganci.

👇 Danna BUY NOW domin siya.`;

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

    await ctx.reply(
      `✅ An publish "${film.title}" zuwa channel cikin nasara.`
    );

  } catch (error) {
    console.error("Publish Error:", error);

    await ctx.reply(
      "❌ An samu kuskure wajen publish film."
    );
  }
});
// ===============================
// BUY NOW - PAYSTACK
// ===============================

bot.action(/^buy_now_(\d+)$/, async (ctx) => {
  try {
    await ctx.answerCbQuery().catch(() => {});

    const filmId = Number(ctx.match[1]);
    const telegramId = String(ctx.from.id).trim();
// Find film
const film = await prisma.film.findUnique({
  where: {
    id: filmId,
  },
});

if (!film) {
  return ctx.reply("❌ Ba a sami wannan film ba.");
}

const title = film.title;
const price = Number(film.price);

    // User information
    const firstName = ctx.from.first_name || "Customer";
    const lastName = ctx.from.last_name || "User";
    const username = ctx.from.username || "";

    // Temporary email
    const email =
  `${telegramId}@telegram.nigfilm.com`;

    // Create unique order reference
    const orderReference =
      `NIGIFILM_${telegramId}_${filmId}_${Date.now()}`;

    // Create order
    const order = await prisma.order.create({
  data: {
    telegramId,
    filmId,
    amount: price,
    status: "pending",
    paymentReference: orderReference,
  },
});
const response = await fetch(
  "https://api.paystack.co/transaction/initialize",
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      amount: price * 100,
      reference: orderReference,
      callback_url: "https://nigfilm-bot.onrender.com/payment-success",
     channels: [
  "card",
  "bank",
  "bank_transfer",
  "ussd"
],
      metadata: {
        telegramId,
        filmId,
      },
    }),
  }
);

const result = await response.json();

if (!result.status) {
  console.error(result);

  return ctx.reply(
    "❌ An kasa ƙirƙirar Payment Link."
  );
}

const paymentLink = result.data.authorization_url;
  await ctx.reply(
  `🎬 *${title}*

💰 Amount: ₦${price.toLocaleString()}

✅ Danna link ɗin da ke ƙasa domin biyan kuɗi ta Paystack.

🔗 ${paymentLink}

⚠️ Bayan an tabbatar da biyan kuɗinka, bot zai tura maka film ɗin ta atomatik.`,
  {
    parse_mode: "Markdown",
    disable_web_page_preview: true,
  }
);
} catch (error) {
  console.error("========== BUY NOW ERROR ==========");
  console.error(error);

  await ctx.reply(
    "❌ ERROR:\n\n" +
    (error.message || JSON.stringify(error))
  );
}
});
// =================================
// MY PURCHASES
// =================================

bot.action("my_purchases", async (ctx) => {
  try {
    await ctx.answerCbQuery().catch(() => {});

    const telegramId = String(ctx.from.id);

    const purchases = await prisma.purchase.findMany({
      where: {
        telegramId,
      },
      include: {
        film: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (purchases.length === 0) {
      return ctx.reply(
        "📭 Har yanzu ba ka sayi wani film ba."
      );
    }

    for (const purchase of purchases) {
      const film = purchase.film;

      await ctx.reply(
        `🎬 *${film.title}*\n\n` +
        `📂 ${film.category}\n` +
        `💰 ₦${Number(film.price).toLocaleString()}`,
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback(
                "📥 Download",
                `download_${film.id}`
              ),
            ],
          ]),
        }
      );
    }

  } catch (error) {
    console.error("MY PURCHASES ERROR:", error);

    await ctx.reply(
      "❌ An samu kuskure wajen ɗauko fina-finanka."
    );
  }
});
// =================================
// DOWNLOAD PURCHASED FILM
// =================================

bot.action(/^download_(\d+)$/, async (ctx) => {
  try {
    await ctx.answerCbQuery().catch(() => {});

    const telegramId = String(ctx.from.id);
    const filmId = Number(ctx.match[1]);

    const purchase = await prisma.purchase.findFirst({
      where: {
        telegramId,
        filmId,
      },
      include: {
        film: true,
      },
    });

    if (!purchase) {
      return ctx.reply(
        "❌ Ba ka mallaki wannan film ba."
      );
    }

    await bot.telegram.sendVideo(
      ctx.chat.id,
      purchase.film.videoFileId,
      {
        caption: `🎬 ${purchase.film.title}`,
      }
    );

  } catch (error) {
    console.error("DOWNLOAD ERROR:", error);

    await ctx.reply(
      "❌ An samu kuskure wajen tura film."
    );
  }
});

}