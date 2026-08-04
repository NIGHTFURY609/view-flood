# Relief Camp Verification Platform — PRD v1.1 (as-built)

## 1. Problem
During Kerala floods, camp information is scattered across PDFs, WhatsApp forwards and
news posts. Seekers cannot tell whether a camp is open, reachable or full. Donors cannot
tell what a camp actually needs. Nothing carries provenance: who said this, when, and how.

## 2. Goal
A public, mobile-first platform where every fact about a camp carries a visible
verification chain — source, reporter, timestamp — and where communities can confirm
status, check in, and fulfil needs.

## 3. Users
- **Seeker** — needs a nearby, open camp with contacts and directions.
- **Reporter** — on-ground volunteer submitting status, photos, occupancy.
- **Donor / supplier** — wants to know what each camp needs and pledge quantities.
- **Admin (v1: single)** — verifies reports, resolves duplicates, publishes state.

## 4. Non-goals (v1)
Official/government endorsement claims, multi-tenant admin roles, private messaging,
logistics routing, payment processing for donations.

## 5. Data model (implemented)
- **Geography**: `districts` (14), `taluks` (78), `lsg_bodies` (1,182 panchayats /
  municipalities / corporations).
- **Camps** (6,375 seeded from the KSDMA / Revenue monsoon camp sheet): identity,
  geo point, contacts, amenities, status, verification state, occupancy counters,
  `checkin_count`, `report_count`.
- **Reports**: community submissions with OTP-verified phone, images, quality flags.
- **Images**: private storage, signed URLs, blur / brightness / duplicate hash checks.
- **camp_checkins**: self + family counts, rate-limited one per phone and per IP per
  camp per day.
- **camp_needs / need_pledges**: item, unit, quantity needed, quantity pledged, urgency;
  pledges update pledged totals by trigger.
- **sources / audit log**: provenance for every published value.

## 6. Implemented features
### Discovery
- Camp list with **Camps / Requirements** tabs, card and list views, pagination.
- Collapsible filter panel: district, taluk, LSG, status, verification, free-text,
  multi-select facilities (food, water, toilets, medical, power, bedding…).
- URL-driven filters — every view is shareable.
- Distance ranking from geolocation; critical > high > distance > recency.
- Sticky header, breadcrumbs (District › Taluk › LSG), EN/ML toggle, light/dark toggle.

### Camp card / row
Verification badge, government-list badge, urgency, distance, occupancy / families /
children / check-ins / reports / needs counts, facility icons, top-5 needs, tap-to-call,
one-tap directions. Tooltips carry the detail so the surface stays low-text.

### Camp detail
Interactive Leaflet map with pulsing marker, Google Maps directions link, contacts,
verification chain, photo gallery with flagging, "Inside the camp" amenities and latest
occupancy, needs list with progress, check-in card, donate flow.

### Check-in
Self + people-with-me + children-with-me, OTP verified, one per phone and per IP per
camp per day, feeds live occupancy.

### Donations
Donate dialog: quantity → name and phone → OTP → pledged count updates on the need.

### Reporting
6-step wizard: location → status → occupancy → photos (client-side blur / brightness /
EXIF / SHA-256 duplicate checks) → contact → OTP. Duplicate camp detection at 150 m or
0.85 name similarity.

### Support surfaces
Helplines page with emergency contacts, weather panel, offline-friendly PWA shell.

## 7. Trust guardrails
- Never claim official status. Government-sourced rows are labelled "Government list".
- Two states only in the UI: **Verified** and **Unverified — community reported**.
- Every published value links to its source and last-confirmed timestamp.
- Unverified camps show a "call before you travel" line.

## 8. Success metrics
Time-to-find a nearby open camp, share of camps with a confirmation in the last 12 h,
check-ins per active camp, needs fulfilment rate, duplicate-report rate, image reject rate.

---

## 9. Must-have (v1 scope — done or required to ship)
| # | Feature | Status |
|---|---------|--------|
| 1 | Camp directory with geography filters and search | Done |
| 2 | Verification badge + provenance on every camp | Done |
| 3 | Camp detail with contacts, map, directions | Done |
| 4 | OTP-verified community reporting with photos | Done |
| 5 | Image quality and duplicate checks | Done |
| 6 | Duplicate camp detection (150 m / 0.85 name) | Done |
| 7 | Rate-limited check-ins with occupancy | Done |
| 8 | Requirements tab + donation pledges | Done |
| 9 | Helplines and emergency contacts | Done |
| 10 | EN / ML, dark mode, mobile-first responsive shell | Done |
| 11 | Admin verification portal (approve, reject, merge) | Pending |
| 12 | Real SMS OTP provider in production | Pending |
| 13 | Offline cache of last-seen camps (PWA) | Partial |

## 10. Good-to-have (v1.x / v2)
| # | Feature | Why |
|---|---------|-----|
| 1 | Interactive cluster map of all camps with filter sync | Fastest spatial scan for seekers |
| 2 | Live "needs heatmap" by district | Directs donors where the gap is |
| 3 | Volunteer / supplier accounts with pledge history | Accountability on fulfilment |
| 4 | WhatsApp / SMS broadcast of camp status changes | Reaches low-connectivity users |
| 5 | Trust score per reporter (accepted vs rejected reports) | Auto-prioritises reliable sources |
| 6 | Bulk CSV / sheet import and diff for government updates | Keeps 6k+ rows current |
| 7 | Public API and embeddable widget for newsrooms | Distribution without scraping |
| 8 | Transport / route status overlay (blocked roads) | Camp reachability, not just location |
| 9 | Capacity vs occupancy alerts (camp near full) | Load-balances arrivals |
| 10 | Photo auto-blur of faces before publish | Dignity and privacy |
| 11 | Malayalam voice input for reporting | Lowers reporting friction |
| 12 | Post-event archive and data export | Research and audit after the event |

## 11. Explicit non-features
No "official" or "government-approved" wording, no anonymous unverified writes, no
public exposure of reporter phone numbers, no monetary donation handling in v1.
