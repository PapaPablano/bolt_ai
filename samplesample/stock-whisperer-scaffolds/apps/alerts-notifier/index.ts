import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY!;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY!;
webpush.setVapidDetails('mailto:alerts@yourapp.io', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function tick() {
  const { data: evs } = await supabase
    .from('alert_events')
    .select('id, alert_id, fired_at, payload_json, alerts(user_id)')
    .is('sent_at', null)
    .order('id');
  for (const e of evs ?? []) {
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('endpoint,p256dh,auth')
      .eq('user_id', e.alerts.user_id);
    const notifications = (subs ?? []).map((s:any) => webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } } as any, JSON.stringify(e.payload_json)).catch(()=>null));
    await Promise.allSettled(notifications);
    await supabase.from('alert_events').update({ sent_at: new Date().toISOString() }).eq('id', e.id);
  }
}

setInterval(tick, 5_000);
