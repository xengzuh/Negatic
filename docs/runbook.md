# Negatic Runbook

Day-to-day commands for running the project locally. Avoid asking the AI to
do these — they're mechanical and burn tokens.

## From cold (laptop reboot)

```bash
# 1. Start Docker Desktop (click icon, or:)
#    powershell -c 'Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"'
#    Wait ~30-60s for the whale icon to say running.

# 2. Supabase containers usually auto-resume with Docker. If not:
pnpm db:start

# 3. Bot (terminal A — keep open)
pnpm --filter @negatic/bot start

# 4. Cloudflare tunnel (terminal B — keep open)
"/c/Program Files (x86)/cloudflared/cloudflared.exe" tunnel --url http://localhost:3001

# 5. Dashboard, optional (terminal C — keep open)
pnpm --filter @negatic/dashboard dev
#    open http://localhost:3000
```

After step 4, the tunnel prints a URL like
`https://<random>.trycloudflare.com`. **Three things to do with it:**

1. Update `apps/bot/.env`:
   ```
   BOT_PUBLIC_URL=https://<random>.trycloudflare.com
   ```
2. Meta app → WhatsApp → Configuration → Edit **Callback URL** → paste
   `https://<random>.trycloudflare.com/webhook`. Verify token unchanged.
   **Verify and save.** No need to re-subscribe to `messages`.
3. (No restart needed — `BOT_PUBLIC_URL` is just bookkeeping; the bot
   doesn't read it at runtime.)

## Stop everything

| What | How |
| --- | --- |
| Bot | `Ctrl+C` in terminal A |
| Tunnel | `Ctrl+C` in terminal B |
| Dashboard | `Ctrl+C` in terminal C |
| Supabase | `pnpm db:stop` |
| Docker Desktop | quit from tray |

## After pulling new code

```bash
pnpm install
```

If a new migration is in `supabase/migrations/`:

```bash
pnpm db:reset      # WIPES local DB, re-applies all migrations + seed
pnpm db:gen-types  # regenerate TS types for both apps
```

Then **re-apply the test wa_id mapping** (db:reset wipes it):

```bash
SVC="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
curl -s -X PATCH "http://127.0.0.1:54321/rest/v1/restaurants?id=eq.33333333-3333-3333-3333-333333333301" \
  -H "apikey: $SVC" -H "Authorization: Bearer $SVC" \
  -H "Content-Type: application/json" \
  -d '{"whatsapp_number":"+60162158252"}'
```

## Tests / typecheck

```bash
pnpm typecheck                       # all packages
pnpm test                            # all packages
pnpm --filter @negatic/bot test      # just the bot
pnpm --filter @negatic/dashboard build  # production build
```

## Common breakages

| Symptom | Cause | Fix |
| --- | --- | --- |
| Bot returns `401 OAuthException` from Meta | Access token expired (dev token = 24h) | Refresh from Meta API Setup OR re-generate the System User permanent token. Replace `META_WHATSAPP_ACCESS_TOKEN` in `.env`. Restart bot. |
| Tunnel URL stops working overnight | Cloudflare quick-tunnel session timed out | Kill cloudflared, run step 4 again, get new URL, paste into Meta webhook + `.env` |
| Docker daemon errors | Docker Desktop stopped | Click whale icon to restart |
| `Cannot find module` after pulling | New dep added | `pnpm install` |
| Bot tests fail with "module not found" | Bot needs new shared package | `pnpm install` from repo root, not from `apps/bot/` |

## Get the current tunnel URL programmatically

If you need to see the URL but lost the terminal:

```bash
grep -oE "https://[a-z0-9-]+\.trycloudflare\.com" /tmp/tunnel.log | head -1
```

(only works if you started cloudflared with `> /tmp/tunnel.log 2>&1 &`)

## Refresh access token (when 401)

1. Meta Business Settings → Users → System Users → `negatic-bot`
2. Generate new token, expiration **Never**, permissions:
   `whatsapp_business_messaging`, `whatsapp_business_management`
3. Copy → replace `META_WHATSAPP_ACCESS_TOKEN` in `apps/bot/.env`
4. Restart bot (`Ctrl+C` then `pnpm --filter @negatic/bot start`)
