import { createApp } from './app';
import { env } from './config';
import { executeDueReminders } from './repo/work';
import { runDueSchedules } from './repo/tl';
import { reconcileFormerCallerLeads } from './repo/caller-reassignment';

const app = createApp();
app.listen(env.API_PORT, () => {
  console.log(`[api] listening on http://localhost:${env.API_PORT} (${env.NODE_ENV})`);
});

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
