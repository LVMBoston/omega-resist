import React from "react";

/**
 * Static visual key matching the symbols drawn by MapHotspotRenderer.
 * Reused inside live_number hotspots when metricKey === "map_legend".
 */

export type LegendRow =
  | { kind: "subhead"; label: string }
  | {
      kind: "item";
      label: string;
      color: string;
      hollow?: boolean; // hollow circle (white fill, dark border)
    };

export const MAP_LEGEND_TITLE = "Map Legend";

export const MAP_LEGEND_ROWS: LegendRow[] = [
  { kind: "subhead", label: "Message received via:" },
  { kind: "item", label: "QR code", color: "#000099" },
  { kind: "item", label: "Email", color: "#000099" },
  { kind: "item", label: "Text / SMS", color: "#000099" },
  { kind: "subhead", label: "Message viewed:" },
  { kind: "item", label: "Not shared", color: "#ffffff", hollow: true },
  { kind: "item", label: "Shared with others", color: "#ffffff", hollow: true },
];

interface MapLegendProps {
  fontSize?: number;
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
  const indent = Math.round(fontSize * 1.2);
  const borderW = Math.max(2, Math.round(swatch * 0.18));

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
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          fontWeight: 700,
        }}
      >
        {MAP_LEGEND_TITLE}
      </div>
      {MAP_LEGEND_ROWS.map((row, idx) => {
        if (row.kind === "subhead") {
          return (
            <div
              key={`s-${idx}`}
              style={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                fontWeight: 700,
                marginTop: idx === 0 ? 0 : `${rowGap}px`,
              }}
            >
              {row.label}
            </div>
          );
        }
        return (
          <div
            key={`i-${idx}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: `${gap}px`,
              paddingLeft: `${indent}px`,
            }}
          >
            <span
              style={{
                flexShrink: 0,
                width: `${swatch}px`,
                height: `${swatch}px`,
                borderRadius: "50%",
                backgroundColor: row.color,
                border: row.hollow ? `${borderW}px solid ${color}` : "none",
                boxSizing: "border-box",
              }}
            />
            <span
              style={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {row.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// Back-compat export (some files may import this)
export const MAP_LEGEND_ITEMS = MAP_LEGEND_ROWS;
