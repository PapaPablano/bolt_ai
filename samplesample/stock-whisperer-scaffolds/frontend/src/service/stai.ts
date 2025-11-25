// Proxy to your Edge Function to avoid CORS headaches in dev
export async function getSTAI(symbol:string, tf:string, params:Record<string,any>) {
  const sp = new URLSearchParams({ symbol, tf, ...Object.fromEntries(Object.entries(params).map(([k,v])=>[k,String(v)])) });
  const r = await fetch(`/api/regimes-supertrend?${sp}`);
  if(!r.ok) throw new Error(await r.text());
  return r.json();
}
