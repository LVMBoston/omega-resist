
# Fix: Force SVG Fallback Icons on iOS Safari

**Date:** 2026-03-02

## 1. Problem

The previous fix (FallbackImg with `onError` + cache-busting) does not work on iOS Safari because iOS loads the PNGs successfully (HTTP 200) but fails to render them visually. The `onError` event never fires, so the fallback SVG never appears.

## 2. Fix: iOS User-Agent Detection

One change to `src/components/InteractiveSlideOverlay.tsx`:

### 2a. Add iOS detection constant

```text
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
```

### 2b. Update `FallbackImg` to default to fallback on iOS

Change the initial `useState` from `false` to `isIOS` — on iOS devices, the Lucide SVG renders immediately without ever attempting the PNG.

```text
const [failed, setFailed] = useState(isIOS);  // was: useState(false)
```

### 2c. Remove `ICON_CACHE_BUSTER`

Delete `const ICON_CACHE_BUSTER = "?v=2";` and revert `src` from `` `${src}${ICON_CACHE_BUSTER}` `` back to plain `src`. No longer needed since iOS skips PNGs entirely.

## 3. Result

- **iOS Safari**: All 6 hotspot icon types render as Lucide SVG line icons (always visible, correct colors).
- **Desktop / Android**: Custom PNG icons render as before; `onError` fallback remains as safety net.
- **No database or schema changes.**

## 4. File Changed

| # | File | Change |
|---|------|--------|
| 1 | `src/components/InteractiveSlideOverlay.tsx` | Add `isIOS` const; set `FallbackImg` default state to `isIOS`; remove `ICON_CACHE_BUSTER` and `?v=2` from src |
