# Review false positives

Findings from `/code-review`, `/code-review ultra`, `/security-review` or the `review-checklist` skill that are not real problems in pt-app. The skill drops findings that match an entry here. Add a row when a finding is wrong, with the reason, so the retro can count them and reviewers stop re-raising them.

## Known trade-offs (by design)

| Finding                                           | Why it is not a bug                                                                                                                                                                 |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Users log in with only a name, no password        | Product decision for PT clients; documented under "Giới hạn hiện tại" in the README. Admins use username + scrypt password.                                                         |
| No rate limit on admin login                      | Known limit, also in the README; there is a delay on wrong passwords. Track as a ticket if it should change, do not flag it per PR.                                                 |
| `db` in `db/index.ts` is a `Proxy`                | Intentional lazy connection, so a bad `DATABASE_URL` becomes a classified error inside the request (and in `/api/health`) instead of crashing every import.                         |
| Generic error message hides the cause             | `services/action-errors.ts` shows only a generic message plus a reference id in production on purpose; the cause is in the Vercel logs under the same id. Dev shows the full cause. |
| Session cookie lasts 400 days and renews on visit | "Remember me" by design (README). Admin sessions last 7 days.                                                                                                                       |
| `unstable_rethrow` in error handling looks unsafe | Required so `redirect()` / `notFound()` reach Next.js instead of being reported as errors.                                                                                          |

## Log

| Date | Tool | Finding | Why it was wrong | PR  |
| ---- | ---- | ------- | ---------------- | --- |
