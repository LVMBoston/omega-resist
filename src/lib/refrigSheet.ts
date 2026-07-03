/**
 * Composes a 3" x 5" (landscape) printable PNG containing three QR codes
 * under a campaign title. Designed to be taped to a refrigerator door.
 *
 *   +---------------------------------------------------------+
 *   |                   {Campaign Title}                      |
 *   |  [QR: Story]     [QR: Text Deck]   [QR: Email Deck]     |
 *   |  Display Status     Text Deck          Email Deck       |
 *   +---------------------------------------------------------+
 *
 * Sheet is 5" wide x 3" tall @ 300 DPI = 1500 x 900 px. Pure browser-side
 * canvas rendering; no server round-trip.
 */
import QRCode from "qrcode";

interface QrSpec {
  /** Absolute URL the QR encodes. */
  url: string;
  /** Label printed under the QR. */
  label: string;
}

interface ComposeOptions {
  campaignTitle: string;
  /** Three QR codes rendered left → right. */
  qrs: [QrSpec, QrSpec, QrSpec];
}

const PAGE_W = 1500; // 5" @ 300 DPI
const PAGE_H = 900;  // 3" @ 300 DPI
const BG = "#2d2d2d";     // dark charcoal, matches mockup
const FG_TITLE = "#f5d20a"; // yellow, matches mockup
const FG_LABEL = "#f5d20a";
const QR_SIZE = 380;
const QR_FRAME_PAD = 20;

export async function composeRefrigSheetPng({
  campaignTitle,
  qrs,
}: ComposeOptions): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = PAGE_W;
  canvas.height = PAGE_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  // Background
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);

  // Title
  ctx.fillStyle = FG_TITLE;
  ctx.textAlign = "center";
  ctx.font = "bold 56px system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
  wrapText(ctx, campaignTitle, PAGE_W / 2, 90, PAGE_W - 120, 64);

  // Column layout: 3 evenly-spaced columns
  const columnW = PAGE_W / 3;
  const qrTop = 180;

  for (let i = 0; i < 3; i++) {
    const spec = qrs[i];
    const cx = columnW * i + columnW / 2;

    // White frame behind QR (so black modules stand out on dark bg)
    const frameSize = QR_SIZE + QR_FRAME_PAD * 2;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(cx - frameSize / 2, qrTop - QR_FRAME_PAD, frameSize, frameSize);

    // QR itself
    const qrCanvas = document.createElement("canvas");
    await QRCode.toCanvas(qrCanvas, spec.url, {
      width: QR_SIZE,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#000000", light: "#ffffff" },
    });
    ctx.drawImage(qrCanvas, cx - QR_SIZE / 2, qrTop, QR_SIZE, QR_SIZE);

    // Label under the QR
    ctx.fillStyle = FG_LABEL;
    ctx.textAlign = "center";
    ctx.font = "bold 38px system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
    ctx.fillText(spec.label, cx, qrTop + QR_SIZE + 70);
  }

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Canvas toBlob returned null"))),
      "image/png",
    );
  });
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(/\s+/);
  let line = "";
  let cursorY = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cursorY);
      line = word;
      cursorY += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, cursorY);
}

/**
 * Delivers the PNG to the user.
 *
 * - On desktop browsers: triggers a normal file download via `<a download>`.
 * - On iOS Safari: `<a download>` is silently ignored and the OS share sheet
 *   pops up instead. Instead we open the blob in a new tab so the user
 *   actually sees the PNG and can long-press → "Save to Photos" or print.
 */
export function triggerPngDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isIOS = /iPad|iPhone|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && typeof document !== "undefined" && "ontouchend" in document);

  if (isIOS) {
    const w = window.open(url, "_blank");
    if (!w) {
      window.location.href = url;
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
