# Competitive brief — PreCog Security vs. superagi.com and precog.com

**Date:** 2026-10-21
**Scope:** `https://precogsecurity.github.io/` (the product we sell) against two
different-shaped companies whose *site craft* is the benchmark.
**Method:** both competitors rendered in a real browser (they are JS apps, so a
plain fetch returns an empty document), then reduced to comparable fact sheets.

---

## 1. Who they actually are

Neither is a direct competitor. Both are benchmarks for **how a modern AI
company earns trust on the web**, and both are in adjacent categories.

| | **SuperAGI** (superagi.com) | **Precog** (precog.com) | **PreCog Security** (us) |
|---|---|---|---|
| Category | "AI Super App for Work" — a marketplace of 50+ agent apps | Automated ELT / data ingest for the CFO | Autonomous red team, blue team, offensive security |
| Buyer | Any team; self-serve | Enterprise CFO, demo-led | CTO / CISO / head of engineering |
| Headline | "Get work done with SuperAGI" | "Turning data into decisions for the Office of the CFO" | "Find vulnerabilities before attackers do." |
| Offer | Freemium, seats + AI credits | $3,950–$27,000 per source-instance per year | Free review → $500 audit → $1,500+ pentest → $1,200/mo |
| Self-serve | **Yes** — "Sign up for free", $0 tier | **No** — "Book a demo" only | Partial — a free review, but it starts as a form |
| Social proof | "Trusted By 50,000+ Customers Across The World" | "Leading brands rely on Precog" (logo wall) | **None** — only self-reported numbers |
| Trust artifacts | Audit Logs, RBAC, "Priority Support <24h" | **SOC 2 Type II**, SSO/SAML, sandboxes | Public code, a public gate, a published doctrine |
| Pricing clarity | Seat picker + credit meter; "Lowest Price, Highest ROI. Guaranteed." | Named tiers, unit explained ("What's a source-instance anyway?"), "no usage meters" | Four named cards, no comparison, no "what's included" |
| Content strategy | App catalogue as content | **"Featured articles & insights"** — 3 real thought pieces on the homepage | A broken page behind a "Research" nav link |
| Jargon explained | No | **Yes** — defines its own pricing unit | Partly |

### The three lessons that actually transfer

1. **Precog proves by showing.** It does not say "enterprise grade"; it names
   *SOC 2 Type II, SSO/SAML, dev/test/QA/training sandboxes*, explains its own
   pricing unit in plain words, and publishes three substantive articles on the
   homepage. Its trust is **specific and checkable**.
2. **SuperAGI proves by removing friction.** A $0 tier, a one-click sign-up, a
   seat/credit calculator, a lowest-price guarantee. The visitor can price
   themselves in under ten seconds.
3. **Both make the *unit* of value obvious.** SuperAGI sells *credits and
   seats*. Precog sells *source-instances*. Each is a noun a buyer can count.
   We sell *engagements* — a noun a buyer cannot compare — and never define
   what one contains.

### Where we already beat both

- **Price.** $500 for a focused audit against $3,950–$27,000 for one connector.
  We are 8–50× cheaper and say so plainly.
- **Proof of work.** We do not just find issues, we ship the fix *and* the
  detection *and* the regression test. Neither competitor has a security
  analogue of that loop.
- **Genuine autonomy.** Our own engineering runs under an automated security
  gate with 379 assertions and a rollback on failure. We already dogfood the
  product we sell.

### Where we lose, honestly

| Gap | SuperAGI | Precog | Ours |
|---|---|---|---|
| **Nothing checkable on the page** | logo wall | SOC 2 + SSO + articles | self-reported numbers only — **we assert, we do not prove** |
| **No self-serve path** | $0 tier, sign up | demo | a form that asks for "Project Details" |
| **Pricing unit undefined** | seats + credits | source-instance, explained | "audit" vs "engagement" vs "monitoring", never defined |
| **Homepage credibility broken** | n/a | n/a | `swarm.html` is a canvas game whose **scripts and styles are blocked by its own CSP** — it renders as an empty shell |
| **Third-party font request** | n/a | n/a | `fonts.googleapis.com` is **blocked by our CSP** (`style-src 'self'`) — a render-blocking request that can never succeed |
| **No security contact** | — | SOC 2 | no `security.txt`, despite running a disclosure programme |

---

## 2. The plan

### P0 — Correctness (these are bugs, not opinions)

| # | Change | Why |
|---|---|---|
| 1 | **Self-host the fonts** (`assets/fonts/*.woff2` + `@font-face`), drop the Google Fonts link | The stylesheet is blocked by our own CSP. Today every visit pays a DNS + TLS + 404-ish round trip for nothing. Self-hosting removes a third party, removes the blocked request, keeps `style-src 'self'` strict. |
| 2 | **Rebuild `swarm.html` as a static "Research & Live Operations" page** | The current page is a canvas simulation whose `<script>` and `<style>` are both blocked by its own `script-src 'none'` / `style-src 'self'`. It renders as a broken shell behind the "Research" nav link. |
| 3 | **Publish `.well-known/security.txt`** | A security company that runs a disclosure programme but has no `security.txt` is telling buyers its own house isn't wired up. |

### P1 — Positioning and proof

| # | Change | Why it beats the benchmark |
|---|---|---|
| 4 | **Sharper headline.** "We break in. Then we ship the fix." | SuperAGI and Precog sell *capability*. Every security vendor sells *"find vulnerabilities before attackers do"* — including our current headline. The **fix + detection + regression test** is the thing nobody in the category claims, because nobody else does it. |
| 5 | **A "verified, not asserted" proof band** | Replaces "50,000+ customers" and "SOC 2 Type II" with things a prospect can **open and check**: our published gate, our doctrine, our scope registry, our open-source organisation. Specific beats impressive. |
| 6 | **"Why not just point an LLM at your repo?"** | Neither competitor faces this objection because neither is in security. In our category it is *the* objection. Answering it head-on with our closed loop is the highest-leverage section on the page. |
| 7 | **Comparison table** — PreCog vs. classic consultancy vs. point scanner | Gives the buyer a frame instead of a feature list. "Classic consultancy" is the real alternative we lose to on trust, and "point scanner" is the real alternative we lose to on price. We beat the first on speed and the second on completeness. |
| 8 | **A real worked example** — one finding, end to end: attack path → diff → detection → regression test | Precog's homepage wins with substance. This is our version of substance, and it is the only artefact that proves the loop rather than describing it. |

### P2 — Conversion and clarity

| # | Change | Why it beats the benchmark |
|---|---|---|
| 9 | **A one-field "free automated scan" path** | SuperAGI wins on friction with a $0 tier; we win it with a **free scan of your actual repository**, one field, no account, no sales call. A free *product*, not a free *demo*. |
| 10 | **Pricing: named tiers, a recommended anchor, and "what's included"** | Copy Precog's discipline — define the unit. Name the tiers, mark the recommended one, and list what each engagement actually contains. |
| 11 | **Research teaser on the homepage** | Copy Precog's "Featured articles & insights" pattern, pointed at our research page. |
| 12 | **"Shipped this month" strip** | Precog proves liveness with articles. We prove liveness with a public work log — which is stronger, because it is generated by the machine we are selling. |
| 13 | **Nav/footer/JSON-LD aligned** with the new story, including `Service` and `BreadcrumbList` schema. | |

---

## 3. Constraints we did not break

The site's validator is the gate and it was **not** weakened. In particular:

- `script-src 'none'` still holds on every page — which is why the interactive
  swarm dashboard had to become a static page rather than being "fixed" by
  relaxing the policy.
- `style-src 'self'` still holds — which is why the fonts are self-hosted
  rather than the policy being widened to `fonts.googleapis.com`.
- No inline `style` attributes, no event handlers, forms still POST over
  HTTPS with `_captcha`, credential-shaped field names still rejected, every
  link still has to resolve.

The new work is *additive* to the gate, and two new tests were added to hold
the new invariants (self-hosted fonts, `security.txt` present).

---

## 4. What shipped

See `docs/competitive-ship-report.md` for the shipped diff and the gate output.
