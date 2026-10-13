# Deploying the FastAPI backend on Cloudflare Containers

The role portals can continue to use Cloudflare Pages as documented in `CLOUDFLARE_DEPLOYMENT.md`. This guide deploys the **backend** as a Cloudflare Worker backed by a Linux container. It retains the existing FastAPI, PostgreSQL and WeasyPrint implementation; it is not a partial rewrite to a static Worker.

## What this deployment includes

- `wrangler.jsonc` declares one Durable Object-backed container and the Worker route that forwards requests to it.
- `Dockerfile.cloudflare` builds the FastAPI image and runs Uvicorn on port 8080.
- `cloudflare/src/index.ts` waits for `/health` before it forwards traffic and passes configuration into the container at startup. Secrets never enter the image or Git.

The container runs `APP_MODE=local`. That makes certificate generation and the scheduler work without Redis or Celery. A PostgreSQL database is still required. Use a managed PostgreSQL provider reachable from the public Internet and require TLS in its connection string (for example `...?sslmode=require`).

## Deploy

1. Install dependencies and authenticate:

   ```sh
   npm install
   npx wrangler login
   ```

2. Set the required Worker secrets. Do not put these values in `wrangler.jsonc`:

   ```sh
   npx wrangler secret put DATABASE_URL
   npx wrangler secret put JWT_SECRET
   npx wrangler secret put CORS_ORIGINS
   npx wrangler secret put PUBLIC_BASE_URL
   ```

   `CORS_ORIGINS` must be the comma-separated HTTPS origins of the five Pages portals. `PUBLIC_BASE_URL` must be the final Worker custom domain, such as `https://api.example.edu`. `CERT_SECRET` is optional, but should be set for installations that already issued certificates. SMTP and WhatsApp variables may also be set with `wrangler secret put`; their names are listed in `cloudflare/src/index.ts`.

3. Deploy:

   ```sh
   npm run cf:deploy
   ```

   The first deployment may take several minutes while Cloudflare provisions the container. Confirm `https://<worker>.workers.dev/health` returns a JSON response after provisioning.

4. In every Pages project set `MIRAI_API_BASE_URL` to the Worker URL (or its custom domain), redeploy the portal, and include each portal origin in `CORS_ORIGINS`.

For Git deployments, connect this repository under **Workers & Pages → Builds** and use `npx wrangler deploy` for the production branch. Cloudflare builds and publishes the Docker image as part of that command.

## Important operational notes

- The deployment uses `/tmp/uploads`, which is intentionally ephemeral. It is suitable for smoke tests, but uploaded submissions, gallery photos and PDFs do not survive a container replacement. Before production, replace the local storage adapter with R2/S3-backed storage (or mount R2 using FUSE) and set `UPLOAD_DIR` to that persistent mount.
- Background work runs only while the container is awake. Certificates created in a request are handled while it remains running, but time-based reminders are not guaranteed after an idle stop. Use an always-on worker/queue or add a Cloudflare Cron trigger that wakes a dedicated job endpoint for reliable reminders.
- A single named Durable Object fronts the container so the in-process QR cache is not needlessly split. PostgreSQL remains the authoritative duplicate guard and scheduler lock.

## Local validation

Docker (or a Docker-compatible engine) must be running:

```sh
npm run cf:dev
```

Put local secret values in `.dev.vars` (ignored by Git). Cloudflare Containers requires Wrangler 4.136.0 or later for this workflow.
