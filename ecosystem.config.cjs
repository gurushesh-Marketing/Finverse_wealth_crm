// PM2 process definition for the production VPS.
// Express serves both /api and the built SPA (apps/web/dist) on one origin;
// Nginx terminates TLS in front of it. Secrets come from /opt/finverse/.env.
module.exports = {
  apps: [
    {
      name: 'finverse-crm',
      cwd: __dirname + '/apps/api',
      script: 'dist/index.js',
      instances: 1, // background timers (reminders, schedules, routing) must run once
      exec_mode: 'fork',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '700M',
      time: true,
    },
  ],
};
