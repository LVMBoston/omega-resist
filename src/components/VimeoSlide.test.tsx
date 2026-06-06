/**
 * Automated portion of the Vimeo carousel test plan.
 *
 * What this file covers:
 *   - Embed URL: preserves `h=` privacy hash, sets controls=1, autoplay=1, muted=1
 *   - Player lifecycle: creates iframe when isActive becomes true, idle->playing-muted on 'ready'
 *   - Tap state machine: muted -> unmuted -> paused -> resumed
 *   - Swipe detection: horizontal swipe fires carousel prev/next button click
 *   - Swipe suppresses the trailing synthetic click (no accidental pause)
 *   - Swipe-away (isActive=false) pauses; swipe-back (isActive=true) resumes (and restores unmuted state)
 *   - Escape key destroys the player
 *   - 15% bottom band is NOT covered by the tap-zone (Vimeo native controls reachable)
 *
 * What this file CANNOT cover (requires a real iPhone in Safari):
 *   - Vimeo iframe actually renders / plays / honors postMessage
 *   - iOS fullscreen via Vimeo's native fullscreen button
 *   - Real audio output, autoplay policy quirks, picture-in-picture
 *   - True multi-touch / gesture conflicts with the OS
 * Those items remain in the manual test plan.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act, cleanup, fireEvent } from "@testing-library/react";
import { VimeoSlide } from "@/components/VimeoSlide";

/** Dispatch a fake 'ready' message from the Vimeo origin so the component
 *  transitions idle -> playing-muted (same path the real iframe takes). */
function fireVimeoReady() {
  const ev = new MessageEvent("message", {
    data: JSON.stringify({ event: "ready" }),
    origin: "https://player.vimeo.com",
  });
  window.dispatchEvent(ev);
}

/** Get the single full-frame tap/swipe zone rendered inside the portal. */
function getTapZone(): HTMLElement {
  const zone = document.querySelector<HTMLElement>(
    '[aria-label="Tap to pause/resume, swipe to change slide"]',
  );
  if (!zone) throw new Error("tap-zone not found — player not open?");
  return zone;
}

function getIframe(): HTMLIFrameElement | null {
  return document.querySelector<HTMLIFrameElement>('iframe[src*="player.vimeo.com"]');
}

/** Spy on every postMessage sent to the iframe.contentWindow. */
function spyOnIframePost() {
  const iframe = getIframe();
  if (!iframe) throw new Error("iframe not created");
  // jsdom gives iframe.contentWindow as a real Window; spy on postMessage.
  const spy = vi.spyOn(iframe.contentWindow as Window, "postMessage");
  return spy;
}

/** Parse the JSON payload of a postMessage call. */
function payloadAt(spy: ReturnType<typeof spyOnIframePost>, i: number): any {
  const [data] = spy.mock.calls[i];
  return typeof data === "string" ? JSON.parse(data) : data;
}

/** Names of methods sent to the iframe, in order. */
function methodsSent(spy: ReturnType<typeof spyOnIframePost>): string[] {
  return spy.mock.calls
    .map(([data]) => (typeof data === "string" ? JSON.parse(data) : data))
    .map((m) => m?.method);
}

const VIMEO_URL = "https://vimeo.com/123456789?h=abcdef1234";

beforeEach(() => {
  // Carousel prev/next stubs the swipe handler dispatches a click on.
  const prev = document.createElement("button");
  prev.setAttribute("data-carousel-prev", "");
  const next = document.createElement("button");
  next.setAttribute("data-carousel-next", "");
  document.body.appendChild(prev);
  document.body.appendChild(next);
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("VimeoSlide — embed URL", () => {
  it("preserves the h= hash and sets autoplay/muted/controls flags", async () => {
    render(<VimeoSlide contentUrl="poster.jpg" mediaUrl={VIMEO_URL} isActive />);
    // requestAnimationFrame fires on next tick in our setup shim
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });
    const iframe = getIframe();
    expect(iframe).not.toBeNull();
    const src = iframe!.src;
    expect(src).toMatch(/player\.vimeo\.com\/video\/123456789\?/);
    expect(src).toContain("h=abcdef1234");
    expect(src).toContain("autoplay=1");
    expect(src).toContain("muted=1");
    expect(src).toContain("controls=1");
    expect(src).toContain("playsinline=1");
    expect(iframe!.allow).toContain("fullscreen");
    expect(iframe!.hasAttribute("allowfullscreen")).toBe(true);
  });
});

describe("VimeoSlide — tap state machine", () => {
  async function mountAndReady() {
    render(<VimeoSlide contentUrl="poster.jpg" mediaUrl={VIMEO_URL} isActive />);
    // Allow rAF -> createPlayer to run
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });
    const spy = spyOnIframePost();
    await act(async () => {
      fireVimeoReady();
    });
    return spy;
  }

  it("tap 1 unmutes (muted -> unmuted)", async () => {
    const spy = await mountAndReady();
    spy.mockClear();
    await act(async () => {
      fireEvent.click(getTapZone());
    });
    const setMutedCall = spy.mock.calls
      .map(([d]) => JSON.parse(d as string))
      .find((m) => m.method === "setMuted");
    expect(setMutedCall).toBeTruthy();
    expect(setMutedCall.value).toBe(false);
  });

  it("tap 2 pauses (unmuted -> paused)", async () => {
    const spy = await mountAndReady();
    await act(async () => {
      fireEvent.click(getTapZone()); // unmute
    });
    spy.mockClear();
    await act(async () => {
      fireEvent.click(getTapZone()); // pause
    });
    expect(methodsSent(spy)).toContain("pause");
  });

  it("tap 3 resumes from paused with audio on", async () => {
    const spy = await mountAndReady();
    await act(async () => { fireEvent.click(getTapZone()); }); // unmute
    await act(async () => { fireEvent.click(getTapZone()); }); // pause
    spy.mockClear();
    await act(async () => { fireEvent.click(getTapZone()); }); // resume
    const methods = methodsSent(spy);
    expect(methods).toContain("play");
    const setMutedCall = spy.mock.calls
      .map(([d]) => JSON.parse(d as string))
      .find((m) => m.method === "setMuted");
    expect(setMutedCall?.value).toBe(false);
  });
});

describe("VimeoSlide — swipe gestures", () => {
  async function mountAndReady() {
    render(<VimeoSlide contentUrl="poster.jpg" mediaUrl={VIMEO_URL} isActive />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });
    await act(async () => {
      fireVimeoReady();
    });
  }

  it("left swipe clicks [data-carousel-next]", async () => {
    await mountAndReady();
    const nextBtn = document.querySelector<HTMLButtonElement>("[data-carousel-next]")!;
    const clickSpy = vi.spyOn(nextBtn, "click");
    const zone = getTapZone();
    await act(async () => {
      fireEvent.touchStart(zone, { touches: [{ clientX: 300, clientY: 200 }] });
      fireEvent.touchEnd(zone, { changedTouches: [{ clientX: 100, clientY: 210 }] });
    });
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("right swipe clicks [data-carousel-prev]", async () => {
    await mountAndReady();
    const prevBtn = document.querySelector<HTMLButtonElement>("[data-carousel-prev]")!;
    const clickSpy = vi.spyOn(prevBtn, "click");
    const zone = getTapZone();
    await act(async () => {
      fireEvent.touchStart(zone, { touches: [{ clientX: 100, clientY: 200 }] });
      fireEvent.touchEnd(zone, { changedTouches: [{ clientX: 300, clientY: 195 }] });
    });
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("vertical drag does NOT trigger carousel navigation", async () => {
    await mountAndReady();
    const nextBtn = document.querySelector<HTMLButtonElement>("[data-carousel-next]")!;
    const prevBtn = document.querySelector<HTMLButtonElement>("[data-carousel-prev]")!;
    const ns = vi.spyOn(nextBtn, "click");
    const ps = vi.spyOn(prevBtn, "click");
    const zone = getTapZone();
    await act(async () => {
      fireEvent.touchStart(zone, { touches: [{ clientX: 200, clientY: 100 }] });
      fireEvent.touchEnd(zone, { changedTouches: [{ clientX: 210, clientY: 400 }] });
    });
    expect(ns).not.toHaveBeenCalled();
    expect(ps).not.toHaveBeenCalled();
  });

  it("a swipe suppresses the trailing synthetic click (no accidental pause)", async () => {
    await mountAndReady();
    const spy = spyOnIframePost();
    spy.mockClear();
    const zone = getTapZone();
    await act(async () => {
      fireEvent.touchStart(zone, { touches: [{ clientX: 300, clientY: 200 }] });
      fireEvent.touchEnd(zone, { changedTouches: [{ clientX: 100, clientY: 200 }] });
      // The browser fires a synthetic click after touchend — simulate it.
      fireEvent.click(zone);
    });
    // No pause / setMuted should have been sent because the click is suppressed.
    expect(methodsSent(spy)).not.toContain("pause");
    expect(methodsSent(spy)).not.toContain("setMuted");
  });
});

describe("VimeoSlide — isActive transitions (swipe away / back)", () => {
  it("pauses player when isActive flips to false, resumes (unmuted) when back to true", async () => {
    const { rerender } = render(
      <VimeoSlide contentUrl="poster.jpg" mediaUrl={VIMEO_URL} isActive />,
    );
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });
    await act(async () => {
      fireVimeoReady();
    });
    // Unmute first so we can verify resume restores unmuted state.
    await act(async () => {
      fireEvent.click(getTapZone());
    });
    const spy = spyOnIframePost();
    spy.mockClear();

    // Swipe away
    rerender(<VimeoSlide contentUrl="poster.jpg" mediaUrl={VIMEO_URL} isActive={false} />);
    await act(async () => {});
    expect(methodsSent(spy)).toContain("pause");

    spy.mockClear();
    // Swipe back
    rerender(<VimeoSlide contentUrl="poster.jpg" mediaUrl={VIMEO_URL} isActive />);
    await act(async () => {});
    const methods = methodsSent(spy);
    expect(methods).toContain("play");
    // Resume should restore unmuted state since wasUnmutedRef captured it.
    const setMutedCall = spy.mock.calls
      .map(([d]) => JSON.parse(d as string))
      .find((m) => m.method === "setMuted");
    expect(setMutedCall?.value).toBe(false);
  });
});

describe("VimeoSlide — Escape key", () => {
  it("Escape destroys the iframe", async () => {
    render(<VimeoSlide contentUrl="poster.jpg" mediaUrl={VIMEO_URL} isActive />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });
    await act(async () => {
      fireVimeoReady();
    });
    expect(getIframe()).not.toBeNull();
    await act(async () => {
      fireEvent.keyDown(window, { key: "Escape" });
    });
    expect(getIframe()).toBeNull();
  });
});

describe("VimeoSlide — native-controls reachability", () => {
  it("tap-zone leaves the bottom 15% uncovered (Vimeo controls reachable)", async () => {
    render(<VimeoSlide contentUrl="poster.jpg" mediaUrl={VIMEO_URL} isActive />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });
    await act(async () => {
      fireVimeoReady();
    });
    const zone = getTapZone();
    // Class-based check: the tap-zone is positioned bottom-[15%] so its bottom
    // edge stops 15% above the player's bottom edge.
    expect(zone.className).toContain("bottom-[15%]");
    expect(zone.className).toContain("top-0");
  });
});
