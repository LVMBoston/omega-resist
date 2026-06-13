import React from "react";

/**
 * Static visual key matching the symbols drawn by MapHotspotRenderer.
 * Reused inside live_number hotspots when metricKey === "map_legend".
 * Colors mirror MapHotspotRenderer's CHANNEL_COLORS exactly.
 */
export const MAP_LEGEND_ITEMS: Array<{
  label: string;
  color: string;
  ring?: boolean;
  whiteBorder?: boolean;
}> = [
  { label: "QR code", color: "#000099" },
  { label: "Email", color: "#0066ff" },
  { label: "Text / SMS", color: "#99ccff" },
  { label: "Message opened, not yet shared", color: "#64748b", whiteBorder: true },
  { label: "Message shared with others", color: "#64748b", ring: true },
];

export const MAP_LEGEND_TITLE_LINE1 = "Map Legend";
export const MAP_LEGEND_TITLE_LINE2 = "Messages received via:";

interface MapLegendProps {
  fontSize?: number; // px
  color?: string;
  fontFamily?: string;
  fontWeight?: string | number;
}

export function MapLegend({
  fontSize = 18,
  color = "#1a1a1a",
  fontFamily,
  fontWeight = 600,
}: MapLegendProps) {
  const swatch = Math.round(fontSize * 0.9);
  const gap = Math.max(4, Math.round(fontSize * 0.45));
  const rowGap = Math.max(2, Math.round(fontSize * 0.25));

  const titleRowH = Math.round(fontSize * 1.3);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: `${rowGap}px`,
        width: "100%",
        height: "100%",
        overflow: "hidden",
        fontSize: `${fontSize}px`,
        color,
        fontFamily,
        fontWeight,
        lineHeight: 1.2,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: `${rowGap}px`,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            height: `${titleRowH}px`,
            fontWeight: 700,
            lineHeight: 1.2,
          }}
        >
          {MAP_LEGEND_TITLE_LINE1}
        </div>
        <div
          style={{
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            height: `${titleRowH}px`,
            fontWeight: 700,
            lineHeight: 1.2,
          }}
        >
          {MAP_LEGEND_TITLE_LINE2}
        </div>
      </div>
      {MAP_LEGEND_ITEMS.map((item) => (
        <div
          key={item.label}
          style={{ display: "flex", alignItems: "center", gap: `${gap}px` }}
        >
          <span
            style={{
              flexShrink: 0,
              width: `${swatch}px`,
              height: `${swatch}px`,
              borderRadius: "50%",
              backgroundColor: item.color,
              border: item.ring
                ? `${Math.max(2, Math.round(swatch * 0.18))}px solid #22c55e`
                : item.whiteBorder
                  ? `${Math.max(2, Math.round(swatch * 0.18))}px solid #ffffff`
                  : "none",
              boxSizing: "border-box",
            }}
          />
          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}
