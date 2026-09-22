import crypto from "crypto";
import { Markup } from "telegraf";
import { prisma, bot } from "../bot.js";

import {
  PREMIUM_PLANS,
  getPremiumExpiryDate,
} from "./premium.js";

// ======================================================
// PAYSTACK HASH COMPARISON
// ======================================================

export function securelyCompareHashes(
  firstHash,
  secondHash
) {
  try {
    const firstBuffer =
      Buffer.from(
        String(firstHash || ""),
        "hex"
      );

    const secondBuffer =
      Buffer.from(
        String(secondHash || ""),
        "hex"
      );

    if (
      firstBuffer.length === 0 ||
      secondBuffer.length === 0 ||
      firstBuffer.length !==
        secondBuffer.length
    ) {
      return false;
    }

    return crypto.timingSafeEqual(
      firstBuffer,
      secondBuffer
    );
  } catch {
    return false;
  }
}

// ======================================================
// PROCESS WEB FILM PAYMENT
// ======================================================

export async function processWebFilmPayment({
  reference,
  paidAmount,
}) {
  try {
    const order =
      await prisma.webOrder.findUnique({
        where: {
          paymentReference:
            reference,
        },
      });

    if (!order) {
      return {
        success: false,
        message:
          "Ba a samu WebOrder na payment ba.",
      };
    }

    const expectedAmount =
      Number(order.amount) * 100;

    if (
      !Number.isFinite(
        paidAmount
      ) ||
      paidAmount !==
        expectedAmount
    ) {
      console.error(
        "❌ WEB PAYMENT AMOUNT MISMATCH:",
        {
          reference,
          paidAmount,
          expectedAmount,
        }
      );

      return {
        success: false,
        message:
          "Adadin kudin da aka biya bai dace da farashin film ba.",
      };
    }

    if (
      order.status === "paid"
    ) {
      return {
        success: true,
        alreadyProcessed: true,
      };
    }

    const film =
      await prisma.film.findUnique({
        where: {
          id: order.filmId,
        },
      });

    if (!film) {
      return {
        success: false,
        message:
          "Ba a samu film na order ba.",
      };
    }

    await prisma.$transaction(
      async (tx) => {
        const currentOrder =
          await tx.webOrder.findUnique({
            where: {
              id: order.id,
            },
          });

        if (
          !currentOrder ||
          currentOrder.status ===
            "paid"
        ) {
          return;
        }

        const existingPurchase =
          await tx.webPurchase.findUnique({
            where: {
              webUserId_filmId: {
                webUserId:
                  order.webUserId,

                filmId:
                  order.filmId,
              },
            },
          });

        if (!existingPurchase) {
          await tx.webPurchase.create({
            data: {
              webUserId:
                order.webUserId,

              filmId:
                order.filmId,

              orderId:
                order.id,
            },
          });
        }

        await tx.webOrder.update({
          where: {
            id: order.id,
          },

          data: {
            status: "paid",
          },
        });
      }
    );

    console.log(
      "✅ WEB PURCHASE CREATED:",
      {
        webUserId:
          order.webUserId,

        filmId:
          order.filmId,

        reference,
      }
    );

    return {
      success: true,
    };
  } catch (error) {
    console.error(
      "❌ PROCESS WEB PAYMENT ERROR:",
      error
    );

    return {
      success: false,
      message:
        "An samu matsala wajen adana WebPurchase.",
    };
  }
}

// ======================================================
// PROCESS PREMIUM PAYMENT
// ======================================================

export async function processPremiumPayment({
  reference,
  paidAmount,
}) {
  try {
    const order =
      await prisma.premiumOrder.findUnique({
        where: {
          paymentReference:
            reference,
        },
      });

    if (!order) {
      return {
        success: false,
        message:
          "Ba a samu PremiumOrder na payment ba.",
      };
    }

    const expectedAmount =
      Number(order.amount) * 100;

    if (
      !Number.isFinite(
        paidAmount
      ) ||
      paidAmount !==
        expectedAmount
    ) {
      console.error(
        "❌ PREMIUM PAYMENT AMOUNT MISMATCH:",
        {
          reference,
          paidAmount,
          expectedAmount,
        }
      );

      return {
        success: false,
        message:
          "Adadin kudin Premium bai dace ba.",
      };
    }

    if (
      order.status === "paid"
    ) {
      return {
        success: true,
        alreadyProcessed: true,
      };
    }

    const plan =
      PREMIUM_PLANS[
        order.plan
      ];

    if (!plan) {
      return {
        success: false,
        message:
          "Premium plan na order bai dace ba.",
      };
    }

    const now =
      new Date();

    const existingSubscription =
      await prisma
        .premiumSubscription
        .findFirst({
          where: {
            webUserId:
              order.webUserId,

            status:
              "ACTIVE",

            expiresAt: {
              gt: now,
            },
          },

          orderBy: {
            expiresAt:
              "desc",
          },
        });

    const startsAt =
      existingSubscription
        ? new Date(
            existingSubscription
              .expiresAt
          )
        : now;

    const expiresAt =
      getPremiumExpiryDate(
        order.plan,
        startsAt
      );

    if (!expiresAt) {
      return {
        success: false,
        message:
          "An kasa lissafa lokacin kare Premium.",
      };
    }

    await prisma.$transaction(
      async (tx) => {
        const currentOrder =
          await tx.premiumOrder
            .findUnique({
              where: {
                id: order.id,
              },
            });

        if (
          !currentOrder ||
          currentOrder.status ===
            "paid"
        ) {
          return;
        }

        await tx
          .premiumSubscription
          .create({
            data: {
              webUserId:
                order.webUserId,

              plan:
                order.plan,

              status:
                "ACTIVE",

              amount:
                order.amount,

              paymentReference:
                order.paymentReference,

              startsAt,

              expiresAt,
            },
          });

        await tx.premiumOrder.update({
          where: {
            id: order.id,
          },

          data: {
            status:
              "paid",
          },
        });
      }
    );

    console.log(
      "✅ PREMIUM SUBSCRIPTION ACTIVATED:",
      {
        webUserId:
          order.webUserId,

        plan:
          order.plan,

        reference,
        startsAt,
        expiresAt,
      }
    );

    return {
      success: true,
      startsAt,
      expiresAt,
    };
  } catch (error) {
    console.error(
      "❌ PROCESS PREMIUM PAYMENT ERROR:",
      error
    );

    return {
      success: false,
      message:
        "An samu matsala wajen kunna Premium.",
    };
  }
}

// ======================================================
// VERIFY PAYSTACK TRANSACTION
// ======================================================

export async function verifyPaystackTransaction(
  reference
) {
  try {
    if (
      !process.env
        .PAYSTACK_SECRET_KEY
    ) {
      return {
        success: false,
        message:
          "PAYSTACK_SECRET_KEY babu.",
      };
    }

    const response =
      await fetch(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(
          reference
        )}`,
        {
          method: "GET",

          headers: {
            Authorization:
              `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          },
        }
      );

    const data =
      await response
        .json()
        .catch(() => null);

    if (
      !response.ok ||
      !data?.status ||
      data?.data?.status !==
        "success"
    ) {
      console.error(
        "❌ PAYSTACK VERIFY FAILED:",
        data
      );

      return {
        success: false,

        message:
          data?.message ||
          "Payment bai samu tabbaci ba.",
      };
    }

    if (
      String(
        data.data.reference
      ) !==
      String(reference)
    ) {
      return {
        success: false,
        message:
          "Payment reference bai dace ba.",
      };
    }

    return {
      success: true,

      amount:
        Number(
          data.data.amount
        ),

      data:
        data.data,
    };
  } catch (error) {
    console.error(
      "❌ VERIFY PAYSTACK ERROR:",
      error
    );

    return {
      success: false,
      message:
        "An kasa tabbatar da payment daga Paystack.",
    };
  }
}

// ======================================================
// PROCESS SINGLE TELEGRAM FILM PAYMENT
// ======================================================

export async function processSingleFilmPayment({
  order,
}) {
  const film =
    await prisma.film.findUnique({
      where: {
        id: order.filmId,
      },
    });

  if (!film) {
    throw new Error(
      `Film not found: ${order.filmId}`
    );
  }

  await prisma.$transaction(
    async (tx) => {
      const currentOrder =
        await tx.order.findUnique({
          where: {
            id: order.id,
          },
        });

      if (
        !currentOrder ||
        currentOrder.status ===
          "paid"
      ) {
        return;
      }

      const existingPurchase =
        await tx.purchase.findFirst({
          where: {
            telegramId:
              order.telegramId,

            filmId:
              film.id,
          },
        });

      if (!existingPurchase) {
        await tx.purchase.create({
          data: {
            telegramId:
              order.telegramId,

            filmId:
              film.id,

            orderId:
              order.id,
          },
        });
      }

      await tx.order.update({
        where: {
          id: order.id,
        },

        data: {
          status: "paid",
        },
      });
    }
  );

  try {
    // ==================================================
    // NEW BUNNY STREAM FILM
    // ==================================================

    if (
      film.bunnyVideoId &&
      film.webVideoUrl
    ) {
      const baseUrl =
        process.env
          .PUBLIC_BASE_URL ||
        "https://nigfilm-bot.onrender.com";

      const watchUrl =
        `${baseUrl}/telegram/watch/${film.id}` +
        `?telegramId=${encodeURIComponent(
          order.telegramId
        )}`;

      const downloadPageUrl =
        `${baseUrl}/telegram/download/${film.id}` +
        `?telegramId=${encodeURIComponent(
          order.telegramId
        )}`;

      await bot.telegram.sendMessage(
        order.telegramId,

        `✅ PAYMENT CONFIRMED\n\n` +
          `🎬 ${film.title}\n\n` +
          `An tabbatar da biyan kuɗinka cikin nasara.\n\n` +
          `Za ka iya kallon film ɗin ko sauke shi zuwa na'urarka.`,

        {
          ...Markup.inlineKeyboard([
            [
              Markup.button.webApp(
                "▶️ Watch Movie",
                watchUrl
              ),
            ],

            [
              Markup.button.webApp(
                "⬇️ Download Movie",
                downloadPageUrl
              ),
            ],

            [
              Markup.button.callback(
                "🎬 My Movies",
                "my_movies"
              ),
            ],
          ]),
        }
      );

      return;
    }

    // ==================================================
    // OLD TELEGRAM FILM
    // ==================================================

    if (film.videoFileId) {
      await bot.telegram.sendVideo(
        order.telegramId,
        film.videoFileId,
        {
          caption:
            `✅ PAYMENT CONFIRMED\n\n` +
            `🎬 ${film.title}\n\n` +
            `Na gode da siyan film.\n` +
            `Ga film ɗinka, ka ji daɗin kallo.`,
        }
      );

      return;
    }

    // ==================================================
    // NO VIDEO SOURCE
    // ==================================================

    await bot.telegram.sendMessage(
      order.telegramId,

      `✅ Payment ya tabbata.\n\n` +
        `⚠️ Amma "${film.title}" bai samu video source ba tukuna.\n\n` +
        `Ka tuntubi admin.`
    );
  } catch (deliveryError) {
    console.error(
      "SINGLE FILM DELIVERY ERROR:",
      deliveryError
    );

    await bot.telegram
      .sendMessage(
        order.telegramId,

        `⚠️ Payment ya tabbata amma an samu matsala wajen baka film ɗin.\n\n` +
          `Ka shiga My Movies ko ka tuntubi admin.`
      )
      .catch(() => {});
  }
}

// ======================================================
// PROCESS TELEGRAM CART PAYMENT
// ======================================================

export async function processCartPayment({
  order,
  metadata,
}) {
  let filmIds = [];

  // ==================================================
  // GET FILM IDS FROM ORDER
  // ==================================================

  if (order.cartFilmIds) {
    try {
      const parsedFilmIds =
        JSON.parse(
          order.cartFilmIds
        );

      if (
        Array.isArray(
          parsedFilmIds
        )
      ) {
        filmIds =
          parsedFilmIds
            .map(Number)
            .filter(
              Number.isInteger
            );
      }
    } catch (error) {
      console.error(
        "INVALID ORDER CART FILM IDS:",
        error
      );
    }
  }

  // ==================================================
  // FALLBACK: METADATA ARRAY
  // ==================================================

  if (
    filmIds.length === 0 &&
    Array.isArray(
      metadata?.filmIds
    )
  ) {
    filmIds =
      metadata.filmIds
        .map(Number)
        .filter(
          Number.isInteger
        );
  }

  // ==================================================
  // FALLBACK: METADATA STRING
  // ==================================================

  if (
    filmIds.length === 0 &&
    typeof metadata?.filmIds ===
      "string"
  ) {
    try {
      const parsedMetadataIds =
        JSON.parse(
          metadata.filmIds
        );

      if (
        Array.isArray(
          parsedMetadataIds
        )
      ) {
        filmIds =
          parsedMetadataIds
            .map(Number)
            .filter(
              Number.isInteger
            );
      }
    } catch {
      filmIds =
        metadata.filmIds
          .split(",")
          .map(Number)
          .filter(
            Number.isInteger
          );
    }
  }

  filmIds = [
    ...new Set(filmIds),
  ];

  if (
    filmIds.length === 0
  ) {
    throw new Error(
      `Babu film IDs a cart order ${order.id}`
    );
  }

  const films =
    await prisma.film.findMany({
      where: {
        id: {
          in: filmIds,
        },
      },
    });

  if (
    films.length === 0
  ) {
    throw new Error(
      `Ba a samu films na cart order ${order.id} ba.`
    );
  }

  // ==================================================
  // SAVE PURCHASES
  // ==================================================

  await prisma.$transaction(
    async (tx) => {
      const currentOrder =
        await tx.order.findUnique({
          where: {
            id: order.id,
          },
        });

      if (
        !currentOrder ||
        currentOrder.status ===
          "paid"
      ) {
        return;
      }

      for (
        const film of films
      ) {
        const existingPurchase =
          await tx.purchase.findFirst({
            where: {
              telegramId:
                order.telegramId,

              filmId:
                film.id,
            },
          });

        if (
          !existingPurchase
        ) {
          await tx.purchase.create({
            data: {
              telegramId:
                order.telegramId,

              filmId:
                film.id,

              orderId:
                order.id,
            },
          });
        }
      }

      await tx.cart.deleteMany({
        where: {
          telegramId:
            order.telegramId,

          filmId: {
            in: filmIds,
          },
        },
      });

      await tx.order.update({
        where: {
          id: order.id,
        },

        data: {
          status: "paid",
        },
      });
    }
  );

  // ==================================================
  // DELIVER FILMS
  // ==================================================

  for (
    const film of films
  ) {
    try {
      if (
        film.bunnyVideoId &&
        film.webVideoUrl
      ) {
        const baseUrl =
          process.env
            .PUBLIC_BASE_URL ||
          "https://nigfilm-bot.onrender.com";

        const watchUrl =
          `${baseUrl}/telegram/watch/${film.id}` +
          `?telegramId=${encodeURIComponent(
            order.telegramId
          )}`;

        const downloadPageUrl =
          `${baseUrl}/telegram/download/${film.id}` +
          `?telegramId=${encodeURIComponent(
            order.telegramId
          )}`;

        await bot.telegram.sendMessage(
          order.telegramId,

          `✅ PAYMENT CONFIRMED\n\n` +
            `🎬 ${film.title}\n\n` +
            `An tabbatar da biyan kuɗinka cikin nasara.\n\n` +
            `Za ka iya kallon film ɗin ko sauke shi zuwa na'urarka.`,

          {
            ...Markup.inlineKeyboard([
              [
                Markup.button.webApp(
                  "▶️ Watch Movie",
                  watchUrl
                ),
              ],

              [
                Markup.button.webApp(
                  "⬇️ Download Movie",
                  downloadPageUrl
                ),
              ],

              [
                Markup.button.callback(
                  "🎬 My Movies",
                  "my_movies"
                ),
              ],
            ]),
          }
        );
      } else if (
        film.videoFileId
      ) {
        await bot.telegram.sendVideo(
          order.telegramId,
          film.videoFileId,
          {
            caption:
              `✅ PAYMENT CONFIRMED\n\n` +
              `🎬 ${film.title}\n\n` +
              `Na gode da siyan film.\n` +
              `Ga film ɗinka, ka ji daɗin kallo.`,
          }
        );
      } else {
        await bot.telegram.sendMessage(
          order.telegramId,

          `✅ Payment na "${film.title}" ya tabbata.\n\n` +
            `⚠️ Amma wannan film bai samu video source ba tukuna.\n\n` +
            `Ka tuntubi admin.`
        );
      }

      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            500
          )
      );
    } catch (deliveryError) {
      console.error(
        `CART DELIVERY ERROR — FILM ${film.id}:`,
        deliveryError
      );

      await bot.telegram
        .sendMessage(
          order.telegramId,

          `⚠️ Payment na "${film.title}" ya tabbata, amma an samu matsala wajen baka film ɗin.\n\n` +
            `Ka shiga My Movies ko ka tuntubi admin.`
        )
        .catch(() => {});
    }
  }

  console.log(
    "✅ TELEGRAM CART PAYMENT DELIVERED:",
    {
      orderId:
        order.id,

      telegramId:
        order.telegramId,

      filmIds,
    }
  );
}