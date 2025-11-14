import { useEffect, useState } from 'react';
import { BellRing, Clock } from 'lucide-react';
import { InternalLink } from '../components/InternalLink';
import { generatePageMetadata, updateMetaTags } from '../lib/seo';

interface AlertForm {
  symbol: string;
  condition: 'price-above' | 'price-below' | 'percent-move';
  value: string;
  timeframe: 'immediate' | 'session' | 'close';
}

const INITIAL_FORM: AlertForm = {
  symbol: 'AAPL',
  condition: 'price-above',
  value: '200',
  timeframe: 'immediate',
};

export function AlertsPage() {
  const [form, setForm] = useState<AlertForm>(INITIAL_FORM);
  const [alerts, setAlerts] = useState<AlertForm[]>([]);

  useEffect(() => {
    updateMetaTags(generatePageMetadata('alerts'));
  }, []);

  const handleChange = (key: keyof AlertForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value as AlertForm[keyof AlertForm] }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setAlerts((prev) => [...prev, form]);
    setForm(INITIAL_FORM);
  };

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-sm text-blue-400 uppercase tracking-[0.35em]">Stay Proactive</p>
        <h2 className="text-3xl font-semibold text-slate-50">Intelligent Price Alerts</h2>
        <p className="text-slate-400 max-w-3xl">
          Get notified before the crowd when key technical levels, volatility thresholds, or percent-move targets trigger.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-2 bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4"
        >
          <div className="flex items-center gap-2 text-slate-100 font-semibold">
            <BellRing className="w-5 h-5 text-blue-400" aria-hidden="true" />
            Create Alert
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="text-sm text-slate-400 space-y-2">
              Symbol
              <input
                type="text"
                value={form.symbol}
                onChange={(e) => handleChange('symbol', e.target.value.toUpperCase())}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100"
                placeholder="AAPL"
              />
            </label>
            <label className="text-sm text-slate-400 space-y-2">
              Condition
              <select
                value={form.condition}
                onChange={(e) => handleChange('condition', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100"
              >
                <option value="price-above">Price above</option>
                <option value="price-below">Price below</option>
                <option value="percent-move">% move in session</option>
              </select>
            </label>
            <label className="text-sm text-slate-400 space-y-2">
              Value
              <input
                type="text"
                value={form.value}
                onChange={(e) => handleChange('value', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100"
              />
            </label>
            <label className="text-sm text-slate-400 space-y-2">
              Timeframe
              <select
                value={form.timeframe}
                onChange={(e) => handleChange('timeframe', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100"
              >
                <option value="immediate">Immediate push</option>
                <option value="session">Any time today</option>
                <option value="close">At session close</option>
              </select>
            </label>
          </div>

          <button
          type="submit"
          className="px-5 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold"
          >
            Add alert
          </button>
        </form>

        <aside className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-slate-100 font-semibold">
            <Clock className="w-5 h-5 text-blue-400" aria-hidden="true" />
            Active Alerts
          </div>
          {alerts.length === 0 ? (
            <p className="text-sm text-slate-400">
              No alerts yet. Create one to see it here.
            </p>
          ) : (
            <ul className="space-y-3 text-sm text-slate-300">
              {alerts.map((alert, index) => (
                <li key={`${alert.symbol}-${index}`} className="border border-slate-800 rounded-xl p-3">
                  <div className="font-semibold text-slate-100">{alert.symbol}</div>
                  <div>{alert.condition.replace('-', ' ')} {alert.value}</div>
                  <div className="text-xs text-slate-500">Notify: {alert.timeframe}</div>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-slate-500">
            Alerts sync with mobile push. <InternalLink to="/help" className="text-blue-400 hover:text-blue-300">Learn more</InternalLink>
          </p>
        </aside>
      </div>
    </div>
  );
}
