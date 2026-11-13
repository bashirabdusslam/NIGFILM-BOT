import { useEffect, useState } from 'react';

const providers = { paystack: 'Paystack', flutterwave: 'Flutterwave', billstack: 'Billstack' };

export default function AdminPaymentProvider({ apiUrl, token }) {
  const [settings, setSettings] = useState(null);
  const [selection, setSelection] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`${apiUrl}/api/admin/payment-provider`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
          cache: 'no-store',
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw Error(data.message);
        setSettings(data);
        setSelection(data.provider === 'billstack' ? '' : data.provider);
      } catch (err) {
        if (err.name !== 'AbortError') setError('An kasa loda saitin biyan kuɗi.');
      }
    }
    load();
    return () => controller.abort();
  }, [apiUrl, token]);

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`${apiUrl}/api/admin/payment-provider`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: selection }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw Error(data.message);
      setSettings(data);
      setSelection(data.provider);
      setNotice('An adana sabon zaɓi.');
    } catch (err) {
      setError(err.message || 'An kasa adana zaɓi.');
    } finally {
      setSaving(false);
    }
  }

  return <section>
    <h2>Hanyar biyan kuɗi</h2>
    <p>Zaɓin nan zai shafi sabbin sayayyar fim da Premium a web da app.</p>
    {!settings && !error && <p role="status">Ana loda saitin…</p>}
    {settings && <>
      <p>Mai aiki yanzu: <strong>{providers[settings.provider]}</strong>{settings.source === 'environment' && ' (saitin server)'}</p>
      <form className="transactions-filters" onSubmit={save}>
        <label>Zaɓi hanyar biya
          <select disabled={saving} value={selection} onChange={event => {
            setSelection(event.target.value);
            setNotice('');
          }}>
            <option value="" disabled>Zaɓi hanya</option>
            {['paystack', 'flutterwave'].map(value => <option key={value} value={value} disabled={!settings.available[value]}>
              {providers[value]}{settings.available[value] ? '' : ' — ba a gama saitawa ba'}
            </option>)}
          </select>
        </label>
        <button type="submit" disabled={saving || !settings.available[selection] ||
          (settings.source === 'admin' && selection === settings.provider)}>
          {saving ? 'Ana adanawa…' : 'Adana zaɓi'}
        </button>
      </form>
    </>}
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
  </section>;
}
