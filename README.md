# Pool Boi AI

AI-powered pool chemistry management for residential pool owners.

## What it does

Pool Boi AI helps you keep your pool balanced through:

- **Photo-based test strip reading** — snap a photo of your test strip and let the AI read the levels
- **AI treatment plans** — get plain-language instructions for exactly what to add and how much
- **Chemical inventory tracking** — log what you have on hand so recommendations stay practical

## Pool specs

| Spec | Value |
|------|-------|
| Volume | 18,000 gallons |
| Liner | Vinyl |
| Filter | Sand |

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite |
| Backend / DB | Supabase |
| AI | Anthropic API (`claude-sonnet-4-20250514`) |
| Deployment | Vercel |

## Getting started

```bash
npm install
# fill in .env.local with your keys
npm run dev
```

## Environment variables

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `VITE_ANTHROPIC_API_KEY` | Anthropic API key (server-side only via Vercel Edge Functions) |

> **Note:** `VITE_ANTHROPIC_API_KEY` must never be exposed to the browser.
> All Anthropic API calls are proxied through Vercel Edge Functions.

## Project structure

```
pool-boi-ai/
├── src/
│   ├── components/     # Shared UI components
│   ├── pages/          # Route-level page components
│   ├── hooks/          # Custom React hooks
│   ├── lib/
│   │   ├── supabase.js # Supabase client
│   │   └── anthropic.js# Anthropic API helpers (server-side proxy)
│   └── assets/         # Static assets
├── api/                # Vercel Edge Functions (Anthropic proxy, etc.)
├── .env.local          # Local environment variables (git-ignored)
└── README.md
```

## Naming conventions

| Context | Convention | Example |
|---------|-----------|---------|
| Files / folders | kebab-case | `pool-boi-ai`, `test-strip-reader.jsx` |
| DB tables / columns | snake_case with `pool_boi_` prefix | `pool_boi_readings` |
| React components / types | PascalCase with `PoolBoi` prefix | `PoolBoiDashboard` |
| State objects | camelCase with `poolBoi` prefix | `poolBoiReading` |
