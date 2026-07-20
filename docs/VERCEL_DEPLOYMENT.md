# Vercel deployment

1. Push the existing repository to GitHub and import it into Vercel.
2. Select the existing project root (`lastbacktestxau`).
3. Configure these environment variables in Vercel:

```text
DATA_STORAGE_MODE=MONGODB
MONGODB_URI=
MONGODB_DATABASE=backtestgold
CRON_SECRET=
XAU_DATA_PROVIDER=
XAU_DATA_PROVIDER_API_KEY=
XAU_DATA_PROVIDER_BASE_URL=
```

4. Deploy and test `/api/health`.
5. Run `npm run import:xau-cloud -- --timeframe=H4` locally with the Atlas URI to import data from 2022 onward, then import H1 and M1.
6. Test the protected sync endpoint, configure cron-job.org, and run a short backtest.

Never commit `.env` files, MongoDB credentials, API keys, or cron secrets.
