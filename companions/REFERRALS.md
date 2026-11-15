# Referrals — how they work, and how to share yours

## Your code

Your referral code is derived from your node handle (`.runtime/identity.txt`,
`h_…`). To see it:

```bash
python - <<'PY'
import importlib.util
spec = importlib.util.spec_from_file_location("node", "precog-earn-node.py")
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
print(m.referral_code(m._user_handle(None)))
PY
```

## Your link

```
https://precogsecurity.pages.dev/earn?ref=<YOUR-CODE>
```

Share that URL. When a new participant installs the node and runs it with
`--referral <YOUR-CODE>`, the worker records the pair (deduped). You can see
your count any time:

```
https://precog-earn-payout.precogsecurity.workers.dev/v1/referral-stats?ref=<YOUR-CODE>
```

## What a referral is worth

Nothing yet — referrals are tracked, not paid. When the redemption policy is
final, a referral may entitle the referrer to a share of the redemption pool
(e.g. a small percentage of the referred miner's redeemed credits). Until the
policy is published, treat the link as a way to grow the cohort, not as income.

## Operator notes

- Endpoint: `POST /v1/referral` (HMAC-signed by the new node) and
  `GET /v1/referral-stats?ref=…` (public).
- Table `referrals(ref_code, new_handle, ts)` with PK `(ref_code, new_handle)`.
- No emails, no PII: the code is derived from a pseudonymous handle.
