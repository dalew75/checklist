# AGENTS.md

Guidance for coding agents working in this repository.

## Commands

```bash
npm install        # install dependencies
npm run dev        # dev server on http://localhost:3000 (listens on all interfaces, so it is reachable from the LAN)
npm run build      # production build (also runs the TypeScript type check)
npm start          # serve the production build
```

- There are no tests and no test runner.
- `npm run lint` runs `next lint`, but the repo has no ESLint config. On first run it asks interactively to set one up.
- `npx tsc --noEmit` type-checks without building.

## Architecture

This is a Next.js 14 App Router app with no backend storage. Almost everything is in `app/page.tsx`, one client component (`'use client'`).

- **State and persistence:** all items live in one `items: ChecklistItem[]` array (`{ id, text, completed, deleted }`). It is saved to `localStorage` under the key `checklist-items` whenever it changes. On load, items without a `deleted` field are migrated to `deleted: false`.
- **Tabs are filters on that one array, not separate lists:**
  - Todo: `!deleted && !completed`
  - Done: `!deleted && completed`
  - Trash: `deleted`

  Deleting is a soft delete (`deleted: true`). Restoring clears the flag. Only the Trash tab's "Clear All" removes items for good, and it removes only the deleted ones.
- **Ordering:** drag-and-drop (`@dnd-kit`) is turned on only in the Todo tab. `handleDragEnd` finds positions by id in the full `items` array and calls `arrayMove` on that array, so the order is shared by every tab.
- **Check animation:** an item checked in Todo stays in the Todo list, crossed out, for 300 ms. The `recentlyChecked` set does this.
- **Behaviours that aren't obvious from the UI:**
  - Clicking the Todo tab while it is already active opens the "Add New Item" modal. New items go to the front of the list.
  - Clicking an item's text in Done un-completes it. Clicking it in Trash restores it.
  - `?new=true` in the URL clears `localStorage`, shows the import screen again, and then removes the query string from the URL.
  - The import screen (one item per line in a textarea) shows when there are no saved items. Importing *replaces* the list.
- **`useSearchParams`** has to be inside a `<Suspense>` boundary, so the default export wraps `ChecklistAppContent`.
- **Phone link:** `app/api/lan-ip/route.ts` (`force-dynamic`) returns the server machine's non-internal IPv4 addresses, with private ranges sorted first. The page fetches it on mount and shows `http://<ip>:<port>` at the top, so you can open the app on a phone.

## Conventions

- Styling uses inline `style={{...}}` objects with a hard-coded dark palette:
  - backgrounds `#0a0a0a`, `#1a1a1a`
  - borders `#2a2a2a`, `#3a3a3a`
  - text `#CCCCCC`, muted `#4a4a4a`
  - accent `#60a5fa`, danger `#ff6b6b`

  `app/globals.css` holds only base resets. Follow the inline style when adding UI.
- `next.config.js` sets `output: 'standalone'` for deployment. The README covers PM2, Docker, Nginx and Let's Encrypt setup.

## Known issues

- `npm run build` currently fails its type check with "`searchParams` is possibly `null`" at the two `searchParams.get(...)` calls in `app/page.tsx`. `searchParams?.get(...)` fixes it.
- The README's Dockerfile copies `/app/public`, but the repo has no `public/` directory.
