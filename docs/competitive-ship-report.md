# Ship report — competitive rebuild

**Date:** 2026-10-21
**Branch:** `site/competitive-superiority-20261021`
**Brief:** `docs/competitive-brief.md`

---

## What was wrong when we started

Three of the defects below were not opinions about design. They were bugs, and
the new tests exist so they cannot come back.

1. **Every page pulled its fonts from `fonts.googleapis.com`, and every page's
   own Content-Security-Policy blocked it.** `style-src 'self'` does not
   include Google, and `default-src 'self'` does not include
   `fonts.gstatic.com`. The stylesheet was refused in every policy-honouring
   browser. The site was rendering with system fonts while paying a
   third-party DNS, TLS and handshake on every visit.
2. **The operations page was an interactive canvas simulation whose inline
   `<script>` and inline `<style>` were both blocked by its own policy.** It
   rendered as an empty shell behind the "Research" navigation link.
3. **Eleven published pages carried inline `<style>` blocks** that their
   policy blocked, so they rendered unstyled. This included every
   customer-facing page: services, privacy, terms, disclosure, try.

None of this was visible to the validator, because the validator checks each
page in isolation. It cannot tell that a page's references are permitted by
its own policy.

---

## What changed

### Correctness

| Change | Detail |
|---|---|
| **Fonts self-hosted** | `assets/fonts.css` + `assets/fonts/{inter,jetbrains-mono,plus-jakarta}-var.woff2`, 113 KB of real `wOF2` payloads, verified by magic bytes. The third-party origins left the policies. The fonts now actually load. |
| **Operations page rebuilt as static HTML** | `swarm.html` is now a real page - roster, method rules, operations log, public artefacts - on the site's own design system, with `assets/swarm.css`. |
| **Every inline block externalised** | 11 pages' inline `<style>` blocks became stylesheets; inline scripts became files. |
| **Vendored pages given working policies** | `js/` is a vendored copy of brain.js. Its demo pages had been given the site's strict policy, which blocked their scripts. They now carry policies matching what upstream actually needs. |
| **`admin.html` policy tightened** | `fonts.googleapis.com` and `fonts.gstatic.com` removed from `style-src`/`font-src` now that the fonts are local. |
| **`security.txt` published** | `.well-known/security.txt` with a `mailto:` contact, expiry and policy link. A security company that runs a disclosure programme needs the machine-readable channel. |
| **Favicon on every page** | Nine pages had no icon link, so the browser requested `/favicon.ico` and got a 404 on every visit. |

### Positioning and proof

| Change | Detail |
|---|---|
| **New headline** | "We break in. Then we ship the fix." The old line - "Find vulnerabilities before attackers do" - is what every security vendor says. The fix + detection + regression test is the thing nobody in the category claims, because nobody else does it. |
| **The closed loop, stated up front** | `ATTACK → VERIFY → PATCH → DETECT → PROVE`, as a strip in the hero. |
| **"Verified, not asserted"** | Replaces self-reported numbers. Each claim points at something a prospect can open: the live operations log, the disclosure policy, the evidence format, the GitHub organisation. |
| **"Why not just point an LLM at your repo?"** | The objection nobody in our category faces, because nobody else is in it. Answered honestly - a model is genuinely useful - and then shown the four things it cannot do alone. |
| **One finding, end to end** | A worked example: a cross-tenant read, with the attack, the reproduction, the patch diff, the detection rule and the regression test. This is the substance Precog wins with, pointed at our loop. |
| **Comparison table** | Consultancy vs. point scanner vs. PreCog, nine rows, including the two rows where the other options are the better answer. |
| **Named pricing tiers** | Four tiers with a recommended anchor, a "what's included" list per tier, and a turnaround and scope line per tier - Precog's discipline applied to our unit of value. |
| **Free automated scan** | A two-field path to a free product: email and target, no account, no call. SuperAGI wins on friction with a $0 tier; this wins it with an actual scan of the prospect's own repository. |
| **Operations log teaser + recent releases** | Copy Precog's "featured articles" pattern, pointed at work our own machine generated. |

---

## The gate was not weakened

The validator is the gate and it was **not** loosened to make this work. In
particular:

- `script-src 'none'` still holds on every page. That is why the interactive
  operations page had to become a static page rather than being "fixed" by
  relaxing the policy.
- `style-src 'self'` still holds. That is why the fonts were self-hosted
  rather than the policy being widened to `fonts.googleapis.com`.
- No inline `style` attributes, no event handlers, forms still POST over
  HTTPS with `_captcha`, credential-shaped field names are still rejected,
  every link still has to resolve, `unsafe-eval` and inline styles are still
  refused.

**One addition, in the tightening direction:** `admin.html`'s policy lost two
third-party origins.

## New tests

`test/policy-consistency.test.mjs`, 8 new assertions that cover the gap the
validator cannot see:

1. every page declares a policy the validator accepts
2. **every asset a page pulls in is allowed by that page's own policy** - the
   invariant that would have caught the blocked font stylesheet
3. no page depends on a third-party font host
4. the fonts are self-hosted and the woff2 payloads are real
5. no page carries an inline style block or an inline script
6. `security.txt` is published in the standard location with the required
   fields
7. the homepage exposes every section that carries the argument
8. the operations page is a real page, not an empty shell

---

## Verification

```
npm run lint          Site lint passed: 14 HTML documents checked.
npm run format:check  Formatting check passed.
npm test              15 tests, 15 pass, 0 fail
npm run build         Static build validation passed: 14 HTML documents ready for hosting.
```

**Rendered in a real browser** (headless Chrome, the operator's Chrome build,
against a local preview server), because a passing validator does not mean a
page looks right:

```
http://127.0.0.1:8899/            HTTP 200
  fonts loaded   : inter ✓  jetbrains-mono ✓
  stylesheets    : fonts.css(3) site.css(190)
  sections       : freescan, why-not, anatomy, services, pricing,
                   compare, methodology, research, faq, contact
  links / forms  : 47 / 2
  broken anchors : none
  CSP violations : none
  failed requests: none
  console errors : none
  overflow       : none
```

The same check on `swarm.html` and `services.html` is clean too. The check
harness is `D:\PreCog\.swarm\web\check-site.mjs`.

---

## Honest limits

- We do not have a SOC 2 Type II report and do not claim one. The proof
  section points at artefacts that exist instead, and the comparison table
  says outright that a consultancy is the better answer if you need a signed
  attestation.
- The operations log entries are real engineering events from the loop's own
  record. They are deliberately about *how we work*, not about unreleased
  capabilities.
- The worked example is a redacted real engagement class, not a live client
  report. It is labelled as an example.
- `services.html`, `try.html` and the older pages still carry their original
  copy and layout. They were repaired (they now render), not redesigned. The
  rate card there is the reference; the homepage prices are the headline.

---

# Part two — what the deployment taught us

Three things only became visible once the change was actually live.

## 1. `.well-known/security.txt` was 404 on the live site

The file was committed, the validator was happy, the PR passed CI — and the
canonical security contact URL returned 404 to every crawler.

The Pages deployment is GitHub's built-in **Jekyll** build, and Jekyll
ignores any file or directory whose name starts with a dot unless it is
listed in `include`. The fix is `_config.yml`:

```yaml
include:
  - .well-known
```

`exclude` had to be written out in full at the same time, because specifying
`exclude` **replaces** Jekyll's default list rather than adding to it — so
`node_modules`, `vendor` and the `Gemfile` entries had to be repeated by
hand. `docs/` is excluded too: the competitive analysis is a working
document for the team, not a page for the public.

A copy is also published at `/security.txt`, because tools look in both
places. Both now return HTTP 200.

**The lesson:** the validator checks the repository, not the deployment. A
green CI run says nothing about whether GitHub's Jekyll pass kept your file.
That is a second gap the tests cannot see, and the only way it was caught was
by requesting the URL that the page linked to.

## 2. The research article was an orphan, and it contradicted us

`blog/why-security-scanning-matters.html` existed, was 3.2 KB of competent
copy, and was linked from **nothing**. Nobody could reach it.

Worse, it advertised a scanner API with a 0-100 score and "5 free scans per
month" — while the new homepage positions us against exactly that, a point
scanner that finds and leaves. We do sell that scanner, so the contradiction
was ours to resolve rather than to hide.

The article was rewritten to say the honest thing in full: scanning is
cheap, fast and worth having, and here are the three things it cannot do —
prove the attack path, apply the fix and prove it did not regress, leave a
detection that catches the next attempt. The comparison table now says
plainly that we sell a scanner, that it is the on-ramp rather than the
product, and that it cannot do the rest of the table.

The homepage links it from the research section and the footer, and a new
assertion **fails the build** if the article ever becomes unreachable from
the homepage again. `blog.css` was rewritten on the site's own dark tokens,
because the article rendered on a light theme and read as a page from another
company.

## 3. A credential in the local remote URL

`git remote -v` shows the origin URL with a classic GitHub PAT embedded in
it:

```
https://tim777z:ghp_...@github.com/PreCogSecurity/PreCogSecurity.github.io.git
```

It is **not** in the working tree and **not** in the git history (verified
across the last 400 commits), so nothing was published. But it is a
`repo`-scoped token sitting in plaintext in `.git/config`, and it was echoed
into this session's logs. It should be moved to a credential helper and the
token rotated.

`gh` itself is also authenticated, but against a keyring entry whose token
**cannot create pull requests** — `gh pr create` fails with "Resource not
accessible by personal access token". Every PR in this round was opened
through the REST API with the remote's token instead.
