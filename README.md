# Checklist App

A simple, mobile-friendly checklist app built with Next.js.

## Features

- ✅ Import lists by pasting line-by-line text
- ✅ Check/uncheck items with checkboxes
- ✅ Two tabs: Open and Done
- ✅ Drag and drop to reorder items (in Open tab)
- ✅ Click completed items to move them back to Open
- ✅ Delete items with trash icon
- ✅ Automatic localStorage persistence

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

1. **Import a list**: Paste your list items (one per line) in the textarea and click "Import List"
2. **Check items**: Click the checkbox to mark items as complete (moves to Done tab)
3. **Reorder items**: Drag items in the Open tab to reorder them
4. **Restore items**: Click any item in the Done tab to move it back to Open
5. **Delete items**: Click the trash icon on any item to delete it
6. **Clear all**: Use the "Clear All" button to remove all items and start over

Your checklist is automatically saved to localStorage and will persist when you return to the page.

