
# Add ZIP Import to Deck Editor

## What it does
Adds a new "Import ZIP" button to the Deck Editor sidebar (next to "Add Slide" and "Interactive"). Clicking it opens a file picker for a `.zip` file. The ZIP is extracted client-side, images are compressed (matching the existing DeckBuilder logic), and each image is added as a pending slide at the end of the current deck -- just like pasting or uploading a single image, but in bulk.

## How it works

1. **New button** in the left sidebar button row (`src/pages/DeckEditor.tsx`, around line 996)
   - Label: "Import ZIP"
   - Icon: `FileDown` (already imported)
   - Hidden `<input type="file" accept=".zip">` triggered on click

2. **New handler: `handleZipImport(file: File)`** added to `DeckEditor`
   - Uses `JSZip` (already a project dependency) to extract `.png/.jpg/.jpeg/.gif` files
   - Sorts extracted images alphabetically (same as DeckBuilder)
   - For each image:
     - Validates via existing `validateImage()`
     - Uses resized file if returned
     - Calls existing `handleImageUpload()` which creates temp slides, adds to `pendingUploads`, and marks `hasChanges`
   - Shows a toast with count of slides added
   - User then clicks "Save Changes" to persist (consistent with existing draft/save workflow)

3. **No new files or dependencies** -- `JSZip` is already installed and `DeckBuilder` already imports it. We just add the import to `DeckEditor.tsx`.

## Technical details

**File changed:** `src/pages/DeckEditor.tsx`

- Add `import JSZip from "jszip"` at top
- Add `handleZipImport` async function (~25 lines) that:
  - Calls `JSZip.loadAsync(file)`
  - Collects image entries matching `/\.(png|jpg|jpeg|gif)$/i`
  - Sorts by filename
  - Sets `uploading = true` with progress toast
  - Loops through images, calling `handleImageUpload(new File([blob], name, { type }))` for each
  - Sets `uploading = false`
- Add hidden `<input id="zip-upload" type="file" accept=".zip">` in the sidebar
- Add a third button in the button row that triggers the file input

**UI layout change:** The three buttons ("Add Slide", "Interactive", "Import ZIP") will stack -- the first two stay on one row, and "Import ZIP" goes on a second row below them (full width), keeping the sidebar tidy.
