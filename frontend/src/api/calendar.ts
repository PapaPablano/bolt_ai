export type EconEvent = {
  id: string;
  source: 'forexfactory';
  ts: number;
  title: string;
  country?: string;
  currency?: string;
  impact: 'low' | 'medium' | 'high' | 'unknown';
  actual?: string | null;
  forecast?: string | null;
  previous?: string | null;
  revised?: string | null;
  url?: string | null;
};

export async function fetchCalendar(params: {
  start: number;
  end: number;
  countries?: string[];
  minImpact?: 'low' | 'medium' | 'high';
  baseUrl?: string;
}) {
  const base = params.baseUrl ?? (import.meta.env.VITE_API_BASE_URL ?? '/api');
  const qs = new URLSearchParams({
    start: String(params.start),
    end: String(params.end),
  });
  if (params.countries?.length) qs.set('countries', params.countries.join(','));
  if (params.minImpact) qs.set('min_impact', params.minImpact);
  const r = await fetch(`${base}/v1/calendar?${qs.toString()}`, { credentials: 'omit' });
  if (!r.ok) throw new Error(`Calendar ${r.status}`);
  return (await r.json()) as EconEvent[];
}
