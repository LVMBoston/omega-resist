/**
 * Composes a printable letter-size PNG containing one large QR code plus
 * short instructions. Pure browser-side (canvas + the `qrcode` npm package).
 *
 * Rationale for client-side composition: a single 1275×1650 canvas (letter
 * @ 150 DPI) uses ~8MB of memory — safely within iOS Safari limits even on
 * older devices. Avoids a round-trip and an extra edge function dependency.
 */
import QRCode from "qrcode";

interface ComposeOptions {
  /** Full URL the QR will encode (the /fridge/:token landing page). */
  landingUrl: string;
  /** Human-readable campaign title to print at the top of the sheet. */
  campaignTitle: string;
  /** Optional short subtitle (e.g. deck slug). */
  subtitle?: string;
}

const PAGE_W = 1275; // 8.5" @ 150 DPI
const PAGE_H = 1650; // 11"  @ 150 DPI
const QR_SIZE = 850; // ~5.67" — readable arms-length on old phones

export async function composeRefrigSheetPng({
  landingUrl,
  campaignTitle,
  subtitle,
}: ComposeOptions): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = PAGE_W;
  canvas.height = PAGE_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  // White background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);

  // Title (top)
  ctx.fillStyle = "#0a0a0a";
  ctx.textAlign = "center";
  ctx.font = "bold 60px system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
  wrapText(ctx, campaignTitle, PAGE_W / 2, 130, PAGE_W - 120, 72);

  if (subtitle) {
    ctx.font = "32px system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
    ctx.fillStyle = "#525252";
    ctx.fillText(subtitle, PAGE_W / 2, 230);
  }

  // Render QR on a temp canvas at QR_SIZE then draw centered
  const qrCanvas = document.createElement("canvas");
  await QRCode.toCanvas(qrCanvas, landingUrl, {
    width: QR_SIZE,
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#000000", light: "#ffffff" },
  });
  const qrX = (PAGE_W - QR_SIZE) / 2;
  const qrY = 310;
  ctx.drawImage(qrCanvas, qrX, qrY, QR_SIZE, QR_SIZE);

  // Instructions (below QR)
  ctx.fillStyle = "#0a0a0a";
  ctx.font = "bold 56px system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Scan with your phone camera", PAGE_W / 2, qrY + QR_SIZE + 90);

  ctx.font = "36px system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
  ctx.fillStyle = "#404040";
  ctx.fillText("Then tap View, Email, or Text to share", PAGE_W / 2, qrY + QR_SIZE + 150);

  // Printed URL (small, for accessibility)
  ctx.font = "22px ui-monospace, 'SF Mono', Menlo, Consolas, monospace";
  ctx.fillStyle = "#737373";
  ctx.fillText(landingUrl, PAGE_W / 2, PAGE_H - 60);

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
    // Open the PNG in a new tab. User can long-press to save / print.
    const w = window.open(url, "_blank");
    if (!w) {
      // Popup blocked — fall back to same-tab navigation
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
  // Defer revoke to ensure the download is committed
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
