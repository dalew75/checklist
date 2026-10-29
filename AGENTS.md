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

This is a Next.js 14 App Router app. The UI is one client component in `app/page.tsx`. Lists are stored on the server and synced live to every browser that has the list open, for example a laptop and a phone.

- **Lists are per-link.** Each list has a random ID in the URL (`/?list=<id>`, matching `/^[a-z0-9]{8,40}$/`). The page picks the list in this order:
  1. `?list=` in the URL
  2. otherwise, the last ID saved in `localStorage['checklist-list-id']`
  3. otherwise, a new ID

  `?new=true` always starts a new, empty list. The old one stays on the server. There is no login: anyone with the link can edit the list.
- **Sync flow:**
  1. The client turns every change into a `ListOp` (`lib/listOps.ts`): `import`, `add`, `toggle`, `delete`, `restore`, `move` or `clearTrash`.
  2. `dispatch` applies it locally with `applyOp`, so the change appears instantly (drag-and-drop needs this), then `POST`s it to `/api/lists/[id]`.
  3. The server applies the same `applyOp` in `lib/listStore.ts`, saves `${DATA_DIR:-data}/lists/<id>.json`, and emits a change event.
  4. `/api/lists/[id]/events` is a Server-Sent Events stream. It sends the whole list when a browser connects and after every change. The client's `EventSource` replaces its `items` with each message and reconnects on its own.
- **`applyOp` must stay pure and deterministic,** because the client and the server both run it. Item IDs are created by the client, inside the op.
- **`lib/listStore.ts`:**
  - Keeps its cache and `EventEmitter` on `globalThis`, so they survive dev hot reloads.
  - Runs ops one at a time per list, and writes through a temp file that is then renamed.
  - Is in-process, so it assumes a single server instance.
- **Tabs are filters on one `items` array (`{ id, text, completed, deleted }`), not separate lists:**
  - Todo: `!deleted && !completed`
  - Done: `!deleted && completed`
  - Trash: `deleted`

  Deleting is a soft delete. Only the Trash tab's "Clear All" (`clearTrash`) removes items for good. Drag-and-drop is turned on only in Todo, but `move` reorders the full array, so the order is shared by every tab.
- **Behaviours that aren't obvious from the UI:**
  - Clicking the Todo tab while it is already active opens the "Add New Item" modal. New items go to the front.
  - Clicking an item's text in Done un-completes it. Clicking it in Trash restores it.
  - The import screen shows whenever the loaded list is empty. Importing *replaces* the list.
  - Checking an item in Todo leaves it crossed out there for 300 ms (`recentlyChecked`). This is local to each browser and not synced.
  - A list saved by the old localStorage-only version (`localStorage['checklist-items']`) is imported once into the first empty server list the browser opens, and the old key is then deleted.
- **`useSearchParams`** has to be inside a `<Suspense>` boundary, so the default export wraps `ChecklistAppContent`.
- **Phone link:** `app/api/lan-ip/route.ts` (`force-dynamic`) returns the server machine's non-internal IPv4 addresses, with private ranges sorted first. The page shows `http://<lan-ip>:<port>/?list=<id>` at the top, so you can open the same list on a phone.
- **Random IDs in the browser** must use `crypto.getRandomValues`. `crypto.randomUUID` only works in secure contexts, and a plain-http LAN address isn't one.

## Conventions

- Styling uses inline `style={{...}}` objects with a hard-coded dark palette:
  - backgrounds `#0a0a0a`, `#1a1a1a`
  - borders `#2a2a2a`, `#3a3a3a`
  - text `#CCCCCC`, muted `#4a4a4a`
  - accent `#60a5fa`, danger `#ff6b6b`

  `app/globals.css` holds only base resets. Follow the inline style when adding UI.
- `next.config.js` sets `output: 'standalone'` for deployment. The README covers PM2, Docker, Nginx and Let's Encrypt setup.
- `DATA_DIR` sets where lists are stored. It defaults to `data/` relative to the current working directory, and that directory is gitignored.

## Known issues

- The README's Dockerfile copies `/app/public`, but the repo has no `public/` directory.
