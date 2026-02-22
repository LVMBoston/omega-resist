
# Enable Multi-File Selection on "Add Slide"

## What it does
Updates the "Add Slide" file picker to accept multiple files at once, so you can select several images in the file dialog and have them all added as new slides.

## Changes (single file: `src/pages/DeckEditor.tsx`)

1. **Add `multiple` attribute** to the hidden `<input id="file-upload">` (line 1111-1121)
2. **Add `image/webp`** to the `accept` attribute (currently missing, but supported elsewhere)
3. **Loop over all selected files** instead of only taking `files[0]` -- use the same batched approach from the ZIP import fix (aggregate temp slides and pending uploads, then set state once) to avoid the stale-state overwrite bug

## Technical detail

```text
Before:
  <input type="file" accept="image/png,image/jpeg,image/gif" ...>
  onChange -> takes files[0], calls handleImageUpload(file)

After:
  <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple ...>
  onChange -> loops over all files, validates each, batches into
             newTempSlides + newPendingUploads arrays,
             then does a single setState call (same pattern as handleZipImport)
```

No new dependencies or files.
