import { createHmac, timingSafeEqual } from 'node:crypto';

function sameBytes(expected, value) {
  return typeof value === 'string' &&
    expected.length === Buffer.byteLength(value) &&
    timingSafeEqual(expected, Buffer.from(value));
}

export function validPaystackWebhook(rawBody, headers, env, now = Math.floor(Date.now() / 1000)) {
  if (!Buffer.isBuffer(rawBody)) return false;
  const modern = headers['paystack-signature'];
  if (env.PAYSTACK_WEBHOOK_SECRET && modern !== undefined) {
    if (typeof modern !== 'string') return false;
    const parts = modern.split(',').map(part => part.trim());
    const timestamps = parts.filter(part => part.startsWith('t='));
    const timestamp = timestamps[0]?.slice(2);
    if (timestamps.length !== 1 || !/^\d{1,12}$/.test(timestamp) || Math.abs(now - Number(timestamp)) > 300) return false;
    const expected = Buffer.from(createHmac('sha512', env.PAYSTACK_WEBHOOK_SECRET)
      .update(timestamp + '.').update(rawBody).digest('hex'));
    return parts.some(part => {
      const signature = /^v1=whk_[^:]+:([a-f0-9]{128})$/.exec(part)?.[1];
      return sameBytes(expected, signature);
    });
  }
  if (!env.PAYSTACK_SECRET_KEY) return false;
  const expected = Buffer.from(createHmac('sha512', env.PAYSTACK_SECRET_KEY).update(rawBody).digest('hex'));
  return sameBytes(expected, headers['x-paystack-signature']);
}

export function validFlutterwaveWebhook(rawBody, headers, secret) {
  if (!secret || !Buffer.isBuffer(rawBody)) return false;
  if (headers['flutterwave-signature'] !== undefined) {
    const expected = Buffer.from(createHmac('sha256', secret).update(rawBody).digest('base64'));
    return sameBytes(expected, headers['flutterwave-signature']);
  }
  return sameBytes(Buffer.from(secret), headers['verif-hash']);
}
