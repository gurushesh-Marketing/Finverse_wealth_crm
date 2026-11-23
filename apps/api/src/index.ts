import { createApp } from './app';
import { env } from './config';
import { executeDueReminders } from './repo/work';
import { runDueSchedules } from './repo/tl';
import { reconcileFormerCallerLeads } from './repo/caller-reassignment';

const app = createApp();
// In production Nginx is the only public entry point, so bind to loopback unless
// API_HOST says otherwise. Development keeps Node's default (all interfaces, IPv4 and IPv6),
// so the Vite proxy to localhost:4000 works whether localhost resolves to ::1 or 127.0.0.1.
const host = process.env.API_HOST ?? (env.NODE_ENV === 'production' ? '127.0.0.1' : undefined);
const onListen = () => {
  console.log(`[api] listening on ${host ?? 'all interfaces'}:${env.API_PORT} (${env.NODE_ENV})`);
};
if (host) app.listen(env.API_PORT, host, onListen);
else app.listen(env.API_PORT, onListen);

// SC-11 reminder execution: mark due reminders sent and append timeline events.
const reminderTimer = setInterval(() => {
  executeDueReminders(new Date())
    .then((n) => {
      if (n > 0) console.log(`[api] reminders executed: ${n}`);
    })
    .catch((err) => console.error('[api] reminder tick failed:', err));
}, 30_000);
reminderTimer.unref();

// TL-17 recurring report execution: run due report schedules with explicit IST cadence and concurrency protection.
const scheduleTimer = setInterval(() => {
  runDueSchedules()
    .then((res) => {
      if (res.ran > 0) console.log(`[api] recurring report schedules executed: ${res.ran}`);
    })
    .catch((err) => console.error('[api] recurring report schedule tick failed:', err));
}, 60_000);
scheduleTimer.unref();

// Pick up future-dated transfers/promotions when they become effective.
const callerRoutingTick = () => {
  reconcileFormerCallerLeads()
    .then(({ reassigned, held }) => {
      if (reassigned || held) console.log(`[api] caller leads rerouted: ${reassigned}; held: ${held}`);
    })
    .catch((err) => console.error('[api] caller reassignment tick failed:', err));
};
void callerRoutingTick();
const callerRoutingTimer = setInterval(callerRoutingTick, 60_000);
callerRoutingTimer.unref();
