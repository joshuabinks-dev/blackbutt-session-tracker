# Blackbutt Session Tracker (v0.1 scaffold)

## What this version includes
- Installable PWA (offline via service worker)
- Session start from preset
- Athlete list + group assignment (A/B by default, configurable)
- Blocks editor (distance, reps, cycle, mode)
- Manual start per rep per group (separate clocks)
- Tap athletes in finish order to record time
- Results table
- Share results as PNG (Share Sheet on mobile when supported, clipboard/open-tab fallback)
- Export / copy as TSV (Excel-friendly)

## Run locally
Because this is a PWA, run from a local server:

Python:
    python -m http.server 8000

Then open:
    http://localhost:8000

## Host on GitHub Pages
- Create a repo
- Upload the folder contents to the repo root
- Enable GitHub Pages (Settings → Pages → Deploy from branch)

## Next improvements (v0.2)
- Multi-block image paging (if many columns)
- Rest countdown logic per block (last finisher + cycle rules)
- Coach-controlled rep advancement (Next/Prev rep buttons)
- Read-only share links and Google Sheets sync
