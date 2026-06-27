<p align="center">
  <img src="public/icons/logo.png" alt="Neflix Cat" width="200" />
</p>

<h1 align="center">Neflix Cat</h1>

<p align="center">
  <strong>Neflix · Chrome Extension · TypeScript</strong>
</p>

A Chrome Extension (Manifest V3 + TypeScript) for Netflix My List.  
It lets you create custom categories, tag titles, and filter your list quickly.

**[Install from Chrome Web Store](https://chromewebstore.google.com/detail/netflix-cat/boopinhhmaaicjhfogojcefimkpbfbch)**

## Features

- Create, edit, delete, and reorder categories
- Assign categories directly on My List cards
- Filter cards by selected category
- Persist all data in `chrome.storage.local`
- Export and import JSON data
- Reset all extension data
- Supports `en` and `zh_HK` UI locale

## Privacy Policy

https://kenchudigital.github.io/NetflixCat/privacy/

Hosted from `docs/privacy/` via GitHub Pages (enable **Deploy from branch → /docs** in repo settings).

## How It Works

- Content script is injected on `https://www.netflix.com/*`
- UI is only enabled when My List DOM is ready (guarded by runtime checks)
- Background service worker handles data operations and broadcasts updates
- Popup UI manages categories, language, export/import, and system toggle

## Project Structure

```text
src/
  background/   # service worker message handlers
  content/      # Netflix page UI, filters, DOM integration
  core/         # category/filter/export-import domain logic
  i18n/         # localization
  messaging/    # typed message contracts
  popup/        # extension popup UI
  shared/       # constants, types, utilities
  storage/      # schema, migrations, repository
```

## Development

```bash
npm install
npm run build
cd dist && zip -r ../dist.zip . && cd ..
```

Load the **`dist`** folder (not project root) as an unpacked extension in `chrome://extensions`.

## Versioning Checklist

Before release, update all three files to the same version:

- `package.json`
- `package-lock.json`
- `manifest.json`

## Release

```bash
git tag v0.1.6
git push origin v0.1.6
```

Then create a GitHub release manually and upload `dist.zip`.

## Notes

- Main target experience: `https://www.netflix.com/browse/my-list`
- Content script is loaded on `https://www.netflix.com/*` for SPA navigation stability
- Netflix DOM can change at any time; selectors may require updates
- This project is a demo and may need maintenance for future Netflix UI changes


## Versioning Handle

- v0.1.0 - initial
- v0.1.1 - fix: logic in Non-MyList page
- v0.1.2 - feat: edit category name and category order
- v0.1.3 - feat: optimise in-site navigation
- v0.1.4 - FIX: OLD UI ISSUE; feat: handle the case that if loading video more than 99. (first-load)
- v0.1.5 - feat: global grid card size selector (small / medium / large) in popup 
- v0.1.6 - fix: keep filter bar mounted after returning to My List