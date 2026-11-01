# PreCog Security — Storefront (GitHub Pages ready)

Artefact-only build (Strategy A). No deploy, no git push, no payments wired. Drop into any static host.

## Contents

- `index.html` — responsive one-page store with 6 pre-priced product cards (SOC 2 Readiness Pack, Attack Surface Report, vCISO, WordPress Hardening, AI/LLM Security, Secrets Cleanup).
- `product.html` — placeholder product detail pages, one section per product, each with email CTA + payment links.
- `invoices/InvoiceTemplate.html` — printable invoice template with `{{ }}` placeholders (client, items, totals, bank/PayPal/Stripe info).
- `../sales-pipeline-schema.json` — JSON Schema + example records for the sales/fulfilment pipeline.
- `../sales-automation-playbook.md` — operational playbook (outreach cadence, order tracking, fulfilment, escalation).

## Publish on GitHub Pages / Cloudflare Pages

1. Create a repo under the PreCog Security org: `tim777z/stores/<store-name>` (or `PreCogSecurity/<name>`). Push the contents of this folder (index.html at repo root) **only after operator approval** — this artefact build stops before any git push (Strategy A).
2. GitHub Pages: Settings → Pages → Deploy from `main` branch / root. Site lands at `https://<org>.github.io/<repo>/`.
3. Cloudflare Pages: connect repo, build command `exit 0`, output directory `/`. Or drag-and-drop this folder in the dashboard.
4. Custom domain (optional, operator supplies): add a `CNAME` file with the domain and create the DNS record. Never commit API tokens.

## Configure Stripe (manual, operator present)

1. Create a Stripe account at https://stripe.com (free to start). Operator supplies card details in-session; never by email.
2. Products → create 6 products matching the store list with the prices in `D:\PreCog\data\product-roadmap.md`.
3. Payment Links → generate one link per product.
4. Replace `[STRIPE_LINK_PLACEHOLDER]` in `index.html` and `product.html` with the real link slug (or the whole URL). Keep the structural `[STRIPE_LINK_PLACEHOLDER]` token until replaced so grep can find pending items:
   - `grep -R "STRIPE_LINK_PLACEHOLDER" .`
5. Set webhook endpoint (later) to record `paid` stage transitions in `sales-pipeline-schema.json`.

## Configure PayPal

1. Create a PayPal business account. Operator verifies identity/bank in-session.
2. Generate a PayPal Checkout / "Pay Now" link or PayPal.me link per product price.
3. Replace the PayPal `href` values (currently `[STRIPE_LINK_PLACEHOLDER]`) with the real PayPal links.

## Notes

- Contact / brand: PreCog Security · timlangeveldt@gmail.com · https://precogsecurity.github.io · theme colour `#0a0e17`.
- No secrets, API keys, or card details are committed or stored in this folder. Inventory all live stores, domains, accounts, suppliers and credentials in `D:\PreCog\.swarm\inventory.local.md` (gitignored, never committed).
- Invoice template: fill `{{ }}` placeholders, save as `PCG-INV-XXXX.html`, print to PDF, email to client. Keep card/bank details out of email bodies where avoidable; use secure channels.
- Strategy A compliance: artefacts only. The next reversible step (publishing to a remote) requires operator confirmation before `git push`.
