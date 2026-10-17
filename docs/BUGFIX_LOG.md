# Bug-fix log

Environment used: PostgreSQL 16 (Docker), API `APP_MODE=local`, demo seed, Chromium via Playwright, portals in source mode and as builds (`build-portal.mjs --demo-accounts`) each on its own origin.

## What the investigation found

| Hypothesis (task 2) | Result |
|---|---|
| a. page module / nav mismatch | **False.** All 56 nav items resolve to a page (Jest `navigation.test.js`, `frontend/tests/portals.test.mjs`). |
| b. build drops a module | **False.** Built portals and source mode behave identically (Karma + Playwright). |
| c. endpoint 403/404/500 for that role | **False** on a current database. Every endpoint the tabs call answers 200 for each role; the only 403s are endpoints the UI does not call for that role. |
| d. migrations missing | **TRUE, and the root cause.** Running the API with `AUTO_MIGRATE=0` (or any deployment whose database stopped before 006-011) started "healthy" (`/health` said `ok`) and then returned 500 for every endpoint touching newer tables. With a schema at 005 the failing set is exactly the reported one: club days / Home, check-in, grading, dashboards, notifications and clubs for staff; notifications (and Home/Check-in) for students; `/admin/notifications` for campus manager and super admin. |
| e. CORS / API base URL | **TRUE, and made d unreadable.** An unhandled 500 left the CORS middleware, so the browser received no `Access-Control-Allow-Origin`, reported "blocked by CORS", and the UI said "Cannot reach the server". Separately `scripts/build-all-portals.mjs` silently fell back to a hardcoded Render demo API and the hub page hardcoded the same URL, contradicting the docs ("the build fails without it"). |
| f. frontend runtime errors | **One real bug found:** when the qrcodejs CDN was blocked, check-in threw before showing the typed code and stopped polling. No other runtime errors on any tab with data, empty data, 403/404/500/503 or network failure (Jest matrix, 5 portals x all tabs x 7 API states). |
| g. empty data | **False.** Every tab renders an empty state (matrix, `empty` mode). |
| h. QR | Bug above (fixed). Fallback of typing session ID + code works. |
| i. notifications | In-app inbox, read state, badge, mark-all-read, preferences and the admin log (rows, filters, pagination) work for every role (`notifications.test.js`). They only failed on a stale schema. |

I could not see your deployed environment, so the root cause is established by reproduction on a deliberately stale database, not by inspecting your Cloudflare/Render deployment. Check `GET /health`: it now reports `schema_current` and `pending_migrations`.

## Fixes

| # | Symptom | Root cause | Fix | Tests | Commit |
|---|---|---|---|---|---|
| A | 20+ tabs fail across portals (see table below) | API served traffic on a database behind the code | Startup now refuses to run when `AUTO_MIGRATE=0` and migrations are pending; `/health` returns 503 with `pending_migrations`; unhandled DB "missing table/column" becomes a 503 naming `python -m app.migrate` | `backend/tests/unit/test_schema_guard.py` | 5f943d8 |
| B | Errors looked like CORS / "cannot reach the server" | Error responses bypassed CORSMiddleware | `app/core/errors.py` error boundary inside CORS: JSON body, CORS headers kept | `test_schema_guard.py` | 5f943d8 |
| C | Deployed portals pointed at a demo API | Silent default in `build-all-portals.mjs`, hardcoded URL in hub | Build requires `MIRAI_API_BASE_URL`; hub removed | `frontend/tests`, Karma | c6e8c63 |
| D | Check-in lost the typed code when the QR CDN is blocked | `tk.textContent` set after awaiting the library; failure stopped polling | Show the code first; QR failure only replaces the QR box | `checkin-qr-blocked.test.js` (fails on old code), `e2e/tabs.spec.mjs` | 15901c7 (fix), c9144f4 (tests) |
| E | Smoke/e2e asserted the old campus name "Main Campus" | Seed uses "Rathinam" | Compare with the account's own campus | `smoke_mirai.py` 110/110, `e2e/authorization`, `workflows` | 15901c7, c9144f4 |
| F | Sign-out e2e never confirmed the dialog | Pre-existing | Test confirms | `e2e/auth.spec.mjs` | c6e8c63 |
| G | Dev launcher links broke between portals and the new login site | Relative dev URLs were portal-relative | Root-relative dev URLs | `e2e/development.spec.mjs` | c9144f4 |
| H | e2e "Campus Manager: approves the budget" failed; in serial mode it also kept the 8 later workflow tests (inbox, notification history, campus scoping) from running | Same stale-seed problem as E: asserted "Approved by Main Campus Admin"; the app shows the real approver, "Rathinam Campus Admin" | The test reads the approver's name from `/auth/me` | `e2e/workflows.spec.mjs` (21/21 with the PDF test excluded); CI now installs Pango for WeasyPrint | see git log |

## Per-tab checklist

All 23 reported tabs share causes A+B (plus D for Check-in). "Reproduced" = 500 responses on the stale-schema database, shown by the browser as the CORS/unreachable error; after the fix they show the 503 message and, on a current schema, load. Each tab is covered for success, empty, 403, 404, 500, 503 and network failure by `frontend/tests/unit/tabs.test.js`, mounted in a real browser by `frontend/karma/portals.spec.js` and against the real API by `frontend/e2e/tabs.spec.mjs`.

| Portal | Tabs |
|---|---|
| Student | Notifications |
| Coordinator | Home, Check-in, Grading, Dashboard, Notifications |
| Advisor | Home, Check-in, Grading, Dashboard, Notifications |
| Campus Manager | Dashboard, Clubs, Check-in, Grading, Notification log, Notifications |
| Super Admin | Clubs, Check-in, Grading, Notification History, Notifications |

Dashboard reconciliation (SQL totals vs monthly report) is reported by the API and rendered as before; not changed.

## Task 1: central login

See `docs/ROLE_PORTALS.md` section 6. Tests: `login.test.js`, `portal-runtime.test.js`, `session.test.js`, Karma "central sign-in", `e2e/central-login.spec.mjs`. One bug caught by a unit test while building it: the deep-link validator rejected encoded page names ("Notification%20log").

## Not verified

- Your deployed Cloudflare/Render environment (not accessible); only a local stale-schema reproduction.
- `e2e/workflows.spec.mjs` "Student: ... downloads the PDF" fails on this Mac because WeasyPrint's system libraries (pango/gobject) are missing (`import weasyprint` raises OSError in the API's venv), not because of the code. It should pass in CI on Linux. The file runs in serial mode, so locally that failure stops the remaining workflow tests; run them with `--grep-invert "downloads the PDF"`.
- Karma's console-error hook was not mutation-tested after a tooling hiccup; the other Karma assertions (navigation, redirects, storage) were.
- Rotate `JWT_SECRET`, `CERT_SECRET` and `POSTGRES_PASSWORD`: they exist in old Git history.
