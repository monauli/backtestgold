# cron-job.org setup

Set the production domain and `CRON_SECRET` in Vercel first. Do not put the secret in a URL or browser code.

## Sync XAU

- Title: `BACKTESTGOLD Sync XAU`
- Method: `POST`
- URL: `https://YOUR_DOMAIN/api/cron/sync-xau`
- Headers: `Authorization: Bearer YOUR_CRON_SECRET`, `Content-Type: application/json`
- Body: `{ "timeframes": ["M1", "H1", "H4"] }`
- Suggested schedule: every 15 minutes

## Process backtests

- Title: `BACKTESTGOLD Process Backtests`
- Method: `POST`
- URL: `https://YOUR_DOMAIN/api/cron/process-backtests`
- Headers: `Authorization: Bearer YOUR_CRON_SECRET`, `Content-Type: application/json`
- Body: `{}`
- Suggested schedule: every minute while jobs are queued

The provider endpoint is intentionally not implemented until a real XAUUSD data provider is selected.
