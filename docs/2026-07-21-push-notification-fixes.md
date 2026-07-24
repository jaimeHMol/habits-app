# 🔔 Push Notification Reliability — Diagnosis & Fixes (July 2026)

**Date:** 2026-07-21
**Context:** Push notifications on Android (PWA installed via Chrome, Android 16) are inconsistent — sometimes appear, sometimes don't, sometimes delayed. Especially noticeable with focus timer notifications.

---

## Root Cause Analysis

### Architecture Overview (Healthy)
The push notification stack is architecturally sound:
- **Backend:** APScheduler runs every 1 minute, checks for expired timers and due reminders, sends Web Push via manual VAPID (PyJWT ES256) + http_ece encryption.
- **Frontend:** Service Worker (Workbox injectManifest) handles `push` events and shows native notifications. Focus timers run client-side with `setInterval(1s)` and sync `timer_end_time` to the backend for server-side push fallback.
- **Delivery:** `Urgency: high` header used for timer notifications to bypass Android Doze mode.

### Bugs Found & Fixed

#### Bug 1: 🔴 Critical — Subscribe endpoint deletes all subscriptions
**File:** `backend/src/api/routers.py` (subscribe endpoint)
**Problem:** A leftover `DEBUG CLEANUP` block deleted ALL push subscriptions for the user every time ANY device subscribed. This meant: subscribe on Android ✅ → open app on Desktop → Android subscription deleted ❌ → timer fires → only Desktop gets the push.
**Fix:** Removed the debug cleanup. The repository's `create` method already handles upsert (update existing endpoint or create new one).

#### Bug 2: 🟡 Medium — `notificationclick` URL matching broken
**File:** `frontend/src/sw.js` (notificationclick handler)
**Problem:** Compared `client.url === '/'` but `client.url` is a full URL like `https://habits.jaimehmol.me/`. The comparison never matched, so clicking a notification always opened a new tab instead of focusing the existing app window.
**Fix:** Compare using `new URL(client.url).origin === self.location.origin` instead.

#### Bug 3: 🟡 Medium — Shared notification `tag` replaces notifications
**File:** `frontend/src/sw.js` (push event handler)
**Problem:** All notifications used `tag: 'habit-reminder'`. The `tag` property is a grouping key — newer notifications with the same tag silently replace older ones. If a wellness reminder and a timer alarm arrive close together, only one is visible.
**Fix:** Use unique tags per notification type and source: `timer-{task_id}`, `reminder-{reminder_id}`, etc.

#### Weakness 1: 🟠 Low-Medium — 1-minute scheduler granularity
**File:** `backend/src/application/reminder_scheduler.py`
**Problem:** APScheduler checked for expired timers every 60 seconds. A 10-minute timer could fire up to ~59s late (avg ~30s delay).
**Fix:** Split into two jobs — timer checks every 15 seconds (time-critical), reminder checks every 60 seconds (slot-based, not time-sensitive).

#### Weakness 2: 🟠 Low-Medium — Interval reminders use `urgency="normal"`
**File:** `backend/src/application/reminder_scheduler.py`
**Problem:** Android batches `normal` urgency pushes in Doze mode (screen off), delivering them in maintenance windows every ~15-30 minutes. Interval-based wellness reminders (e.g., "stretch every 60 min") are time-sensitive by nature.
**Fix:** Changed interval reminders to use `urgency="high"`. Task-linked slot reminders remain `urgency="normal"` (3x/day, tolerate some delay).

---

## Files Modified
- `backend/src/api/routers.py` — Removed debug cleanup in subscribe endpoint
- `backend/src/application/reminder_scheduler.py` — Split scheduler jobs, changed urgency
- `frontend/src/sw.js` — Fixed notificationclick matching, unique notification tags

## Tests Added/Updated
- `backend/tests/test_push_logic.py`:
  - Updated `test_scheduler_triggers_interval_reminder` — expected urgency changed from `"normal"` to `"high"`
  - Added `test_scheduler_triggers_timer_with_high_urgency` — verifies expired timers fire with `urgency="high"` and mark task as completed
  - Added `test_scheduler_does_not_trigger_untriggered_timer` — verifies timers that haven't expired yet don't fire

## Verification
- Backend: `ruff check` ✅, `ruff format` ✅, `pytest -v` 22/22 passed ✅
- Frontend: `eslint` ✅, `vitest run` 19/19 passed ✅

## Deployment
After merging, deploy with:
```bash
docker compose up -d --build backend frontend nginx
```
Note: Users on Android should disable and re-enable push notifications in the Reminder Panel to force a fresh subscription after the subscription bug fix.
