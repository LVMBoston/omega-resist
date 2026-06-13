import React from "react";

/**
 * Static visual key matching MapHotspotRenderer markers exactly.
 * Channel fills match MEDIUM_COLORS; every marker has a white border;
 * "Shared with others" uses the green spawn-ring border.
 */

export type LegendRow =
  | { kind: "subhead"; label: string }
  | {
      kind: "item";
      label: string;
      fill: string;
      borderColor: string; // marker stroke
    };

export const MAP_LEGEND_TITLE = "Map Legend";

const WHITE = "#ffffff";
const SPAWN_GREEN = "#22c55e";
const SLATE = "#64748b";

export const MAP_LEGEND_ROWS: LegendRow[] = [
  { kind: "subhead", label: "Message received via:" },
  { kind: "item", label: "QR code", fill: "#000099", borderColor: WHITE },
  { kind: "item", label: "Email", fill: "#0066ff", borderColor: WHITE },
  { kind: "item", label: "Text / SMS", fill: "#99ccff", borderColor: WHITE },
  { kind: "subhead", label: "Message viewed:" },
  { kind: "item", label: "Not shared", fill: SLATE, borderColor: WHITE },
  { kind: "item", label: "Shared with others", fill: SLATE, borderColor: SPAWN_GREEN },
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
                backgroundColor: row.fill,
                border: `${borderW}px solid ${row.borderColor}`,
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

// Back-compat alias
export const MAP_LEGEND_ITEMS = MAP_LEGEND_ROWS;
