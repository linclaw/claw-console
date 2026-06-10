// pm2 process file: runs the claw-console Vite dev server under pm2 so it stays
// up and restarts on crash. `interpreter: 'none'` makes pm2 exec `npm` directly.
//
// Port (5174), LAN binding, and allowedHosts all live in vite.config.ts. nginx
// reverse-proxies http://claw.local (:80) → this dev server; see infra/README.md.
//
// Requires a global pm2 (`npm i -g pm2`). Start: `npm start` (or `pm2 start
// ecosystem.config.cjs`). Persist across reboots: `pm2 save` + `pm2 startup`.
module.exports = {
  apps: [
    {
      name: 'claw-console',
      script: 'npm',
      args: 'run dev',
      interpreter: 'none',
      cwd: __dirname,
    },
  ],
};
