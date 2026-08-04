# Kerala Camp Check — Camps Page Structure

## Header (top bar)
- Logo + app name "Kerala Camp Check" with tagline "Community-verified relief camp information."
- Center nav: Camps (active), Requirements, + Report a camp, Helplines
- Right side: live timestamp (e.g. 04 Aug, 02:25 am), language toggle (മലയാളം), theme toggle, emergency call button (1077, red)

## Disclaimer strip
Full-width bar below header: "Not an official government source" with info icon.

## Page header
- Breadcrumb: "Camps"
- Page title: "Relief camps" with a count badge (e.g. 1)
- Right-aligned actions: "Show map" and "Refresh" buttons

## Tab / view controls
- Segmented control: Camps | Requirements (toggles main content type)
- Right-aligned view switch: Cards | List (toggles layout of results)

## Left sidebar — Filters panel
- Collapsible "Filters" header
- Search input (camp, place, or landmark)
- Dropdowns: All districts, All taluks, All local bodies
- Status toggle chips: Open now, Pre-designated list, Closed, All, Verified only
- Collapsible "Facilities" section

## Main content area
- "Use my location" CTA button (orange, with info icon)
- Camp card(s), each containing:
  - Camp name (e.g. "test") + chevron to expand/view details
  - Location path (e.g. "PTA > Konni > Elanthoor")
  - Status badges: verification state (Unverified/Verified) and open/closed state
  - Meta counts: occupant count icon+number, document count icon+number
  - Last updated timestamp
  - Footer row: phone number (click-to-call) and a directions/navigate icon button

## Hierarchy summary
Header → Disclaimer → Page title/actions → Tab switch → [Filters sidebar | Results grid of camp cards] → each card has identity, status badges, stats, and contact actions.
