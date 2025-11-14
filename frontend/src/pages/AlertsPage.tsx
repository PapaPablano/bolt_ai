import { useCallback, useEffect, useMemo, useState } from 'react';
import { BellRing, Clock, Loader2, PauseCircle, Trash2 } from 'lucide-react';
import { InternalLink } from '../components/InternalLink';
import { generatePageMetadata, updateMetaTags } from '../lib/seo';
import { useSupabaseUser } from '../hooks/useSupabaseUser';
import { supabase } from '../lib/supabase';
import { SupabaseAuthPanel } from '../components/SupabaseAuthPanel';

interface AlertForm {
  symbol: string;
  alertType: 'above' | 'below';
  priceTarget: string;
}

interface PriceAlertRecord {
  id: string;
  symbol: string;
  price_target: number;
  alert_type: 'above' | 'below';
  is_active: boolean;
  created_at: string;
  triggered_at: string | null;
}

const INITIAL_FORM: AlertForm = {
  symbol: 'AAPL',
  alertType: 'above',
  priceTarget: '200',
};

export function AlertsPage() {
  const { user, loading: userLoading } = useSupabaseUser();
  const [form, setForm] = useState<AlertForm>(INITIAL_FORM);
  const [alerts, setAlerts] = useState<PriceAlertRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    updateMetaTags(generatePageMetadata('alerts'));
  }, []);

  const loadAlerts = useCallback(async () => {
    if (!user) {
      setAlerts([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from('price_alerts')
      .select('id, symbol, price_target, alert_type, is_active, created_at, triggered_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      setError(error.message);
      setAlerts([]);
    } else {
      setAlerts((data ?? []) as PriceAlertRecord[]);
    }

    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const handleChange = (key: keyof AlertForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value as AlertForm[keyof AlertForm] }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;

    setStatusMessage(null);
    const symbol = form.symbol.trim().toUpperCase();
    const priceTargetNumber = Number(form.priceTarget);

    if (!symbol || Number.isNaN(priceTargetNumber)) {
      setStatusMessage('Please provide a valid symbol and price target.');
      return;
    }

    const { error } = await supabase.from('price_alerts').insert({
      user_id: user.id,
      symbol,
      price_target: priceTargetNumber,
      alert_type: form.alertType,
    });

    if (error) {
      setStatusMessage(error.message);
      return;
    }

    setForm(INITIAL_FORM);
    setStatusMessage('Alert created successfully.');
    await loadAlerts();
  };

  const handleDeactivate = async (alertId: string) => {
    const { error } = await supabase
      .from('price_alerts')
      .update({ is_active: false, triggered_at: new Date().toISOString() })
      .eq('id', alertId)
      .eq('user_id', user.id);

    if (error) {
      setStatusMessage(error.message);
      return;
    }

    setStatusMessage('Alert paused.');
    await loadAlerts();
  };

  const handleDelete = async (alertId: string) => {
    const { error } = await supabase.from('price_alerts').delete().eq('id', alertId).eq('user_id', user.id);

    if (error) {
      setStatusMessage(error.message);
      return;
    }

    setStatusMessage('Alert removed.');
    await loadAlerts();
  };

  const activeAlerts = useMemo(() => alerts.filter((alert) => alert.is_active), [alerts]);

  if (userLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <SupabaseAuthPanel
        title="Sign in to manage alerts"
        description="Create, pause, and delete price alerts that are stored securely in Supabase."
      />
    );
  }

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-sm text-blue-400 uppercase tracking-[0.35em]">Stay Proactive</p>
        <h2 className="text-3xl font-semibold text-slate-50">Intelligent Price Alerts</h2>
        <p className="text-slate-400 max-w-3xl">
          Alerts are saved directly to Supabase so every session knows which levels matter most.
        </p>
      </header>

      {statusMessage && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 text-sm text-slate-200">
          {statusMessage}
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-2 bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4"
        >
          <div className="flex items-center gap-2 text-slate-100 font-semibold">
            <BellRing className="w-5 h-5 text-blue-400" aria-hidden="true" />
            Create Alert
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="text-sm text-slate-400 space-y-2">
              Symbol
              <input
                type="text"
                value={form.symbol}
                onChange={(event) => handleChange('symbol', event.target.value.toUpperCase())}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100"
                placeholder="AAPL"
                required
              />
            </label>
            <label className="text-sm text-slate-400 space-y-2">
              Condition
              <select
                value={form.alertType}
                onChange={(event) => handleChange('alertType', event.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100"
              >
                <option value="above">Price above level</option>
                <option value="below">Price below level</option>
              </select>
            </label>
            <label className="text-sm text-slate-400 space-y-2">
              Price Target
              <input
                type="number"
                step="0.01"
                value={form.priceTarget}
                onChange={(event) => handleChange('priceTarget', event.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100"
                placeholder="200.00"
                required
              />
            </label>
          </div>

          <button
            type="submit"
            className="px-5 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold"
          >
            Save alert
          </button>
        </form>

        <aside className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-slate-100 font-semibold">
            <Clock className="w-5 h-5 text-blue-400" aria-hidden="true" />
            Active Alerts ({activeAlerts.length})
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
            </div>
          ) : alerts.length === 0 ? (
            <p className="text-sm text-slate-400">No alerts yet. Create one to see it here.</p>
          ) : (
            <ul className="space-y-3 text-sm text-slate-300">
              {alerts.map((alert) => (
                <li
                  key={alert.id}
                  className="border border-slate-800 rounded-xl p-3 flex items-start justify-between gap-4"
                >
                  <div>
                    <div className="font-semibold text-slate-100">{alert.symbol}</div>
                    <div className="text-xs text-slate-400">
                      {alert.alert_type === 'above' ? 'Crosses above' : 'Breaks below'}{' '}
                      <span className="text-slate-100">${alert.price_target.toFixed(2)}</span>
                    </div>
                    <div className="text-xs text-slate-500">
                      Created {new Date(alert.created_at).toLocaleDateString()}
                      {alert.triggered_at && ` • triggered ${new Date(alert.triggered_at).toLocaleDateString()}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {alert.is_active ? (
                      <button
                        onClick={() => handleDeactivate(alert.id)}
                        className="text-xs text-slate-400 hover:text-yellow-300 inline-flex items-center gap-1"
                      >
                        <PauseCircle className="w-4 h-4" aria-hidden="true" />
                        Pause
                      </button>
                    ) : (
                      <span className="text-xs text-slate-500">Paused</span>
                    )}
                    <button
                      onClick={() => handleDelete(alert.id)}
                      className="text-xs text-slate-400 hover:text-red-400 inline-flex items-center gap-1"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-slate-500">
            Alerts sync with mobile push.{' '}
            <InternalLink to="/help" className="text-blue-400 hover:text-blue-300">
              Learn more
            </InternalLink>
          </p>
        </aside>
      </div>
    </div>
  );
}
