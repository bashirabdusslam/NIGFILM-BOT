const settingsId = 1;
const path = '/api/admin/payment-provider';

export function registerPaymentSettings({ app, prisma, requireAdmin, isReady, env = process.env }) {
  const settings = prisma.checkoutPaymentSettings;
  const getSavedProvider = async () => (await settings.findUnique({
    where: { id: settingsId }, select: { provider: true },
  }))?.provider ?? null;

  async function view(res) {
    const saved = await getSavedProvider();
    const provider = saved ?? (env.WEB_PAYMENT_PROVIDER === 'flutterwave' ? 'flutterwave'
      : env.BILLSTACK_ENABLED === 'true' ? 'billstack' : 'paystack');
    return res.json({
      success: true, provider, source: saved ? 'admin' : 'environment',
      available: { paystack: isReady('paystack'), flutterwave: isReady('flutterwave') },
    });
  }

  const adminRoute = handler => async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      return await handler(req, res);
    } catch {
      return res.status(503).json({ success: false, message: 'An kasa samun saitin biyan kuɗi. Sake gwadawa.' });
    }
  };

  app.get(path, requireAdmin, adminRoute((req, res) => view(res)));
  app.put(path, requireAdmin, adminRoute(async (req, res) => {
    const { provider } = req.body ?? {};
    if (provider !== 'paystack' && provider !== 'flutterwave') {
      return res.status(400).json({ success: false, message: 'Zaɓi Paystack ko Flutterwave.' });
    }
    if (!isReady(provider)) {
      return res.status(409).json({ success: false, message: 'Ba a gama saitin wannan hanyar biya a server ba.' });
    }
    const data = { provider, updatedBy: req.webUser.id };
    await settings.upsert({ where: { id: settingsId }, create: { id: settingsId, ...data }, update: data });
    return view(res);
  }));

  return getSavedProvider;
}
