# Add ZIP Import to Deck Editor

**Status: Approved & Implemented**  
**Date: 2026-02-21**

## What it does
Adds a new "Import ZIP" button to the Deck Editor sidebar (next to "Add Slide" and "Interactive"). Clicking it opens a file picker for a `.zip` file. The ZIP is extracted client-side, images are compressed (matching the existing DeckBuilder logic), and each image is added as a pending slide at the end of the current deck -- just like pasting or uploading a single image, but in bulk.

## How it works

1. **New button** in the left sidebar button row (`src/pages/DeckEditor.tsx`)
   - Label: "Import ZIP"
   - Icon: `FileDown`
   - Hidden `<input type="file" accept=".zip">` triggered on click

2. **New handler: `handleZipImport(file: File)`**
   - Uses `JSZip` (already a project dependency) to extract `.png/.jpg/.jpeg/.gif/.webp` files
   - Filters out `__MACOSX` entries
   - Sorts extracted images alphabetically
   - For each image: validates via existing `validateImage()`, uses resized file if returned, calls existing `handleImageUpload()`
   - Shows a toast with count of slides added
   - User then clicks "Save Changes" to persist

3. **No new files or dependencies** -- `JSZip` was already installed.

## File changed
- `src/pages/DeckEditor.tsx`
