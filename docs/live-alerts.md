# Live forecasts, notifications and authority updates

The default `ALERT_SOURCE=openmeteo` retrieves three daily forecasts for representative centres in eight supported Assam districts. Each fetch uses the public [Open-Meteo forecast API](https://open-meteo.com/en/docs), with a 12-second timeout. Successful data is cached for 15 minutes. Refresh failures retain the previous result, explicitly marked stale, for at most 45 minutes; after that the feed is unavailable. Missing readings remain unknown, never zero. `ALERT_SOURCE=demo` explicitly selects the simulated alert collection.

Daily rain thresholds of 50/100/150 mm and gust thresholds of 50/70/90 km/h produce Watch/Elevated/High application advisories. Thunderstorm codes also produce a Watch. These are prototype application rules, not official warning thresholds or predictions of a confirmed flood or landslide. A district-centre forecast does not represent every vulnerable village. Forecast timestamps show retrieval time and daily validity in IST. Quiet forecasts do not establish safety.

Official SACHET and IMD portals remain linked for verification. Their official warning feeds are not ingested. Authority advisories appear separately alongside forecasts; revising one never rewrites the upstream forecast.

## Browser notifications

Open `/alerts`, select a district, and press Enable notifications. Grant the browser permission, then use Test notification. HTTPS or localhost is required. Permission and opt-in preferences are browser-specific. New non-demo, unexpired advisories in the selected district trigger notifications; already displayed advisories are remembered. Routine forecast retrieval does not repeat the same warning. Stale forecasts are excluded from new notifications.

Keep the app open. Polling can be delayed in background tabs. The service worker displays notifications and opens Alerts when clicked, but there is no Push API subscription, VAPID server or closed-browser delivery. Browser and operating-system notification settings can prevent display. Pause notifications to stop delivery in that browser.

## Authority controls

Open `/authority` with password **1234**, as requested for the prototype. `AUTHORITY_PASSWORD` can change this server-side value. Sessions are signed, HTTP-only, valid for two hours, and rate-limited at login. Production requires a private, random `SESSION_SECRET`. Replace this shared prototype password with individual accounts and authority roles before public deployment.

Incident overrides require a reason, retain original report evidence, record previous and new states, and reject stale revisions. Rejected reports must be closed; active assigned responses require an assigned team. Authority advisories require a public message, source URL, expiry and reason. Withdrawals retain the audit trail. Access does not establish the identity of an official and does not dispatch a rescue team.

Authorized operators publish camp, food-distribution and initiative updates from `/relief`. Include an accurate source, location and validity time, and update or close outdated entries. Quantities describe reported availability, not reservations. No camp capacity or distribution schedule is fabricated. The page also links official Assam situation reports and assistance information.

These records use the existing SQLite snapshot or Supabase `bs_state` transaction, including optimistic revision checks. No additional Supabase migration is required for this update. Public projections omit moderation-held reports except for their uploader and authorities. Photo access is enforced independently on the server. Legacy photos remain private; the submitting browser and authorized authorities can view them. New reports include optional public-photo consent, recorded with a timestamp. Consented photos display on public report cards and incident details only when the report is eligible for public viewing. The storage bucket stays private.

The Safety page describes public report coverage and reported impacts. There is currently no verified unaffected-area dataset or safe-route service. Emergency buttons offer phone links and calling instructions; selecting the navigation button does not place a call automatically.

The authority review queue uses Pending, Approved and Rejected tabs with photo cards, severity, timestamps and search. Review/Approve/Reject/Move to pending controls open the evidence editor and prepare a proposed change. Record a reason and save to apply it. No reports or evidence are permanently deleted.
