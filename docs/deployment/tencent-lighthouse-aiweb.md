# Tencent Lighthouse Aiweb Deployment Runbook

This runbook deploys `aiweb` to the Tencent Cloud Lighthouse server while leaving the existing Sub2API stack untouched.

Current server context:

- Provider: Tencent Cloud Lighthouse
- Region: Seoul
- Public IP: `43.133.240.199`
- OS: Ubuntu 22.04, Docker 26, Docker Compose v2
- Existing API host: `api.fzl-ai.top`
- Existing API route: Cloudflare -> Caddy -> Sub2API on host port `8081`

## Target Topology

```text
Cloudflare
-> 43.133.240.199
-> existing Caddy container
   -> api.fzl-ai.top        -> existing Sub2API container
   -> fzl-ai.top/www        -> new aiweb container:3000
```

Do not replace the existing Caddyfile. Add a new site block for the front-end domain only.

## DNS

In Cloudflare, add or verify these records:

```text
A  fzl-ai.top      43.133.240.199  Proxied
A  www             43.133.240.199  Proxied
```

Keep the existing `api.fzl-ai.top` record unchanged.

## Server Layout

Use these paths on the server:

```text
/opt/aiweb/
  repo/                  # git checkout of this project
  .env.production        # secrets, never committed
  compose.env            # non-secret compose settings
```

Create the directory:

```bash
sudo mkdir -p /opt/aiweb
sudo chown -R "$USER":"$USER" /opt/aiweb
```

## Clone Or Update Code

First deploy:

```bash
cd /opt/aiweb
git clone <YOUR_REPO_URL> repo
cd /opt/aiweb/repo
git checkout codex/membership-limits
```

Later updates:

```bash
cd /opt/aiweb/repo
git fetch --all --prune
git checkout codex/membership-limits
git pull --ff-only
```

If the deploy branch changes after merge, replace `codex/membership-limits` with the final production branch.

## Environment File

Create `/opt/aiweb/.env.production` on the server:

```env
AI_BASE_URL=https://api.fzl-ai.top/v1
AI_API_KEY=<redacted>
AI_MODEL=<model-name>
AI_VISION_MODEL=<optional-vision-model-name>
SUPABASE_URL=<your-supabase-url>
SUPABASE_SERVICE_ROLE_KEY=<redacted>
APP_ACCESS_SECRET=<redacted>
MEMBERSHIP_CODE_SECRET=<redacted>
NEXT_PUBLIC_LDXP_PLUS_URL=https://pay.ldxp.cn/item/knq3lq
NEXT_PUBLIC_LDXP_PRO_URL=https://pay.ldxp.cn/item/c0zh71
```

Notes:

- Do not commit this file.
- `AI_BASE_URL` can point at the existing Sub2API endpoint.
- `SUPABASE_SERVICE_ROLE_KEY`, `APP_ACCESS_SECRET`, `MEMBERSHIP_CODE_SECRET`, and `AI_API_KEY` are secrets.
- `NEXT_PUBLIC_LDXP_*` values are embedded into the browser bundle at build time. Rebuild the Docker image after changing them.

Lock down the file:

```bash
chmod 600 /opt/aiweb/.env.production
```

## Discover The Existing Caddy Network

Find the Caddy container name:

```bash
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}'
```

Inspect its networks:

```bash
docker inspect caddy --format '{{range $name, $_ := .NetworkSettings.Networks}}{{println $name}}{{end}}'
```

If the container is not named `caddy`, replace `caddy` in the command with the actual container name.

Create `/opt/aiweb/compose.env`:

```env
AIWEB_CADDY_NETWORK=<network-name-from-docker-inspect>
NEXT_PUBLIC_LDXP_PLUS_URL=https://pay.ldxp.cn/item/knq3lq
NEXT_PUBLIC_LDXP_PRO_URL=https://pay.ldxp.cn/item/c0zh71
```

Example:

```env
AIWEB_CADDY_NETWORK=sub2api_default
NEXT_PUBLIC_LDXP_PLUS_URL=https://pay.ldxp.cn/item/knq3lq
NEXT_PUBLIC_LDXP_PRO_URL=https://pay.ldxp.cn/item/c0zh71
```

`NEXT_PUBLIC_LDXP_*` values are build-time public values. They are passed as Docker build args by `deployment/docker-compose.aiweb.yml`; rebuild the image after changing them.

## Start Aiweb

Run the preflight first:

```bash
cd /opt/aiweb/repo
bash deployment/preflight-aiweb.sh
```

Build and start the app:

```bash
cd /opt/aiweb/repo
docker compose --env-file /opt/aiweb/compose.env -f deployment/docker-compose.aiweb.yml up -d --build
```

On a 2-core/4GB server, direct image builds can be memory-heavy. If the build is killed, add temporary swap or build the image on another machine/CI and push it to a registry.

Check status:

```bash
docker compose --env-file /opt/aiweb/compose.env -f deployment/docker-compose.aiweb.yml ps
docker logs --tail=100 aiweb
```

The Compose healthcheck calls the internal runtime endpoint:

```bash
docker exec aiweb node -e "fetch('http://127.0.0.1:3000/api/health').then(async (response) => { console.log(response.status, await response.text()); process.exit(response.ok ? 0 : 1); }).catch((error) => { console.error(error); process.exit(1); })"
```

Expected: HTTP `200` with JSON booleans under `checks`. If it returns `503`, inspect `/opt/aiweb/.env.production` for missing required variables; the response intentionally reports only configured/not-configured flags and never prints secret values.

## Add Caddy Route

Open the existing Caddyfile used by the running Caddy container and add this site block:

```caddyfile
fzl-ai.top, www.fzl-ai.top {
	encode zstd gzip
	reverse_proxy aiweb:3000
}
```

Do not edit or remove the existing `api.fzl-ai.top` block.

Validate and reload Caddy. The exact command depends on how Caddy is mounted. Common patterns:

```bash
docker exec caddy caddy validate --config /etc/caddy/Caddyfile
docker exec caddy caddy reload --config /etc/caddy/Caddyfile
```

If Caddy is managed by Compose, reload through that stack's existing workflow instead of recreating unrelated containers.

## Smoke Tests

From the server:

```bash
docker exec aiweb node -e "fetch('http://127.0.0.1:3000/api/health').then(async (response) => { console.log(response.status, await response.text()); process.exit(response.ok ? 0 : 1); }).catch((error) => { console.error(error); process.exit(1); })"
curl -fsS https://fzl-ai.top/api/health
curl -I http://aiweb:3000
curl -I https://fzl-ai.top
curl -I https://www.fzl-ai.top
curl -sS https://api.fzl-ai.top/v1/models -o /dev/null -w '%{http_code}\n'
```

Expected:

- `http://127.0.0.1:3000/api/health` inside the `aiweb` container returns HTTP 200.
- `https://fzl-ai.top/api/health` returns HTTP 200 through Cloudflare and Caddy.
- `https://fzl-ai.top` returns HTTP 200 or a normal redirect.
- `https://www.fzl-ai.top` returns HTTP 200 or a normal redirect.
- `https://api.fzl-ai.top/v1/models` still reaches Sub2API and does not route to `aiweb`.

Security header smoke test:

```bash
curl -I https://fzl-ai.top
```

Expected response headers:

- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`
- `X-Frame-Options: DENY`

`Content-Security-Policy is intentionally not set` in this pass. Add it only after auditing Next.js runtime scripts, external purchase links, and model/API traffic.

Browser smoke test:

1. Open `https://fzl-ai.top`.
2. Register or log in.
3. Send a short chat message.
4. Open the membership recharge modal.
5. Confirm `https://api.fzl-ai.top/admin/dashboard` still opens the Sub2API admin.

## Logs

Application logs:

```bash
docker logs -f --tail=200 aiweb
```

Caddy logs:

```bash
docker logs -f --tail=200 caddy
```

Sub2API logs are intentionally separate. Do not restart Sub2API while deploying the front end unless you are also changing the API service.

## Rollback

Rollback app code:

```bash
cd /opt/aiweb/repo
git log --oneline -5
git checkout <known-good-commit>
docker compose --env-file /opt/aiweb/compose.env -f deployment/docker-compose.aiweb.yml up -d --build
```

Disable only the front-end route:

1. Remove or comment the `fzl-ai.top, www.fzl-ai.top` Caddy block.
2. Validate and reload Caddy.

Stop only `aiweb`:

```bash
cd /opt/aiweb/repo
docker compose --env-file /opt/aiweb/compose.env -f deployment/docker-compose.aiweb.yml down
```

## Things Not To Touch

- Do not change the `api.fzl-ai.top` Caddy block during front-end deployment.
- Do not publish `aiweb` with `ports: "3000:3000"` unless Caddy cannot share a Docker network.
- Do not commit `/opt/aiweb/.env.production`.
- Do not commit files under `membership-codes/`.
- Do not rotate `APP_ACCESS_SECRET` casually. Existing login cookies depend on it.
- Do not point `AI_BASE_URL` at Cloudflare-proxied endpoints if you see loop or WAF issues; use the internal or direct Sub2API URL if needed.
