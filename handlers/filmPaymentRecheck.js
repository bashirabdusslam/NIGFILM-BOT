const paystackFilm = /^WEB_(?:[1-9]\d*_[1-9]\d*_\d{13}_[a-f0-9]{8}|APP_[a-f0-9]{32})$/;
const flutterwaveFilm = /^FLW_FILM_(?:APP_)?[a-f0-9]{32}$/;
export const isTelegramPaystackReference = reference => typeof reference === "string" &&
  reference.length <= 100 && /^(?:NIGFILM_\d+_\d+|CART_\d+)_\d{13}$/.test(reference);

export async function recheckFilmOrder({ reference, model, verify, fulfill, telegram = false }) {
  const fail = (code, message) => ({ code, success: false, message });
  const order = await model.findUnique({ where: { paymentReference: reference } });
  if (!order || (telegram && order.virtualAccountReference)) {
    return fail(404, "Ba a samu odar fim ta wannan hanyar biya ba.");
  }
  if (order.status === "paid") return { code: 200, success: true, status: "paid", message: "An riga an tabbatar da wannan odar. Duba My Movies." };
  if (order.status !== "pending") return fail(409, "Wannan odar ba ta Pending.");

  const payment = await verify(reference);
  if (!payment) return fail(502, "Ba a samu tabbaci daga kamfanin biyan kuɗi ba. Duba odar a dashboard ɗinsa.");
  if (payment.reference !== reference) return fail(409, "Reference ɗin biyan kuɗi bai dace da odar ba.");
  if (!payment.paid) return { code: 200, success: true, status: "unconfirmed", message: "Kamfanin biyan kuɗi bai tabbatar da nasara ba. Ba a buɗe fim ba." };
  if (payment.currency !== "NGN" || !Number.isSafeInteger(payment.amountKobo) ||
      payment.amountKobo <= 0 || payment.amountKobo !== order.amount * 100) {
    return fail(409, "Adadi ko currency bai dace da odar ba. Ba a buɗe fim ba.");
  }
  const result = await fulfill({ reference, paidAmount: payment.amountKobo, order });
  if (!result?.success) return fail(503, "An tabbatar an biya, amma ba a samu damar buɗe fim ba. Sake dubawa daga baya.");
  return { code: 200, success: true, status: "paid", message: "An tabbatar an biya. Mai saya zai ga fim ɗin a My Movies." };
}

export function registerFilmPaymentRecheck({
  app, prisma, requireAdmin, verifyPaystack, verifyFlutterwave, fulfill, fulfillTelegram,
}) {
  app.post("/api/admin/transactions/recheck-film-payment", requireAdmin, async (req, res) => {
    res.set("Cache-Control", "no-store");
    const reference = typeof req.body?.reference === "string" ? req.body.reference : "";
    const telegram = isTelegramPaystackReference(reference);
    const verify = reference.length <= 100 && ((telegram || paystackFilm.test(reference))
      ? verifyPaystack : flutterwaveFilm.test(reference) ? verifyFlutterwave : null);
    if (!verify) return res.status(400).json({ success: false, message: "Wannan reference ba na sayen fim ta Paystack ko Flutterwave ba ne." });

    try {
      const { code, ...result } = await recheckFilmOrder({
        reference, model: telegram ? prisma.order : prisma.webOrder, verify,
        fulfill: telegram ? fulfillTelegram : fulfill, telegram,
      });
      return res.status(code).json(result);
    } catch (error) {
      console.error("FILM PAYMENT RECHECK FAILED:", error.code || error.name);
      return res.status(503).json({ success: false, message: "An kasa sake duba wannan odar. Sake gwadawa daga baya." });
    }
  });
}
