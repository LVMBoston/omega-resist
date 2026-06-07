/**
 * Inline-SVG diagrams for the Explainer page.
 * Intentionally no screenshots — these drawings stay accurate
 * even as the product UI evolves.
 *
 * All colors use semantic tokens (currentColor + opacity) so the
 * diagrams adapt to the page's theme.
 */

export const MessageTravelDiagram = () => (
  <svg
    viewBox="0 0 600 200"
    className="w-full h-auto text-foreground"
    role="img"
    aria-label="A card with a QR code is scanned by one phone, which then shares the message to two more phones."
  >
    {/* Card */}
    <g>
      <rect x="20" y="60" width="100" height="80" rx="6"
            fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="35" y="75" width="35" height="35" rx="2"
            fill="currentColor" opacity="0.15" />
      <rect x="40" y="80" width="6" height="6" fill="currentColor" />
      <rect x="58" y="80" width="6" height="6" fill="currentColor" />
      <rect x="40" y="98" width="6" height="6" fill="currentColor" />
      <rect x="49" y="89" width="6" height="6" fill="currentColor" />
      <line x1="80" y1="82" x2="110" y2="82" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <line x1="80" y1="92" x2="110" y2="92" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <line x1="80" y1="102" x2="105" y2="102" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <text x="70" y="160" textAnchor="middle" fontSize="11"
            fill="currentColor" opacity="0.7">a card</text>
    </g>

    {/* Arrow to first phone */}
    <g opacity="0.5">
      <line x1="130" y1="100" x2="195" y2="100" stroke="currentColor" strokeWidth="1.5" />
      <polyline points="188,95 195,100 188,105" fill="none"
                stroke="currentColor" strokeWidth="1.5" />
    </g>

    {/* First phone */}
    <g>
      <rect x="210" y="50" width="60" height="100" rx="8"
            fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="216" y="62" width="48" height="70" rx="2"
            fill="currentColor" opacity="0.1" />
      <circle cx="240" cy="142" r="3" fill="none"
              stroke="currentColor" strokeWidth="1" />
      <text x="240" y="170" textAnchor="middle" fontSize="11"
            fill="currentColor" opacity="0.7">you</text>
    </g>

    {/* Branching arrows to two phones */}
    <g opacity="0.5">
      <line x1="280" y1="100" x2="395" y2="60" stroke="currentColor" strokeWidth="1.5" />
      <polyline points="388,57 395,60 392,68" fill="none"
                stroke="currentColor" strokeWidth="1.5" />
      <line x1="280" y1="100" x2="395" y2="140" stroke="currentColor" strokeWidth="1.5" />
      <polyline points="388,143 395,140 392,132" fill="none"
                stroke="currentColor" strokeWidth="1.5" />
    </g>

    {/* Two more phones */}
    <g>
      <rect x="410" y="20" width="44" height="72" rx="6"
            fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="414" y="28" width="36" height="50" rx="2"
            fill="currentColor" opacity="0.1" />
      <rect x="410" y="108" width="44" height="72" rx="6"
            fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="414" y="116" width="36" height="50" rx="2"
            fill="currentColor" opacity="0.1" />
      <text x="475" y="60" fontSize="11" fill="currentColor" opacity="0.7">a friend</text>
      <text x="475" y="148" fontSize="11" fill="currentColor" opacity="0.7">another friend</text>
    </g>
  </svg>
);

export const CampaignAnatomyDiagram = () => (
  <svg
    viewBox="0 0 600 280"
    className="w-full h-auto text-foreground"
    role="img"
    aria-label="A campaign contains chapters. Each chapter contains actions. Each action hands out cards and links."
  >
    {/* Campaign */}
    <g>
      <rect x="220" y="15" width="160" height="44" rx="6"
            fill="currentColor" opacity="0.1" />
      <rect x="220" y="15" width="160" height="44" rx="6"
            fill="none" stroke="currentColor" strokeWidth="1.5" />
      <text x="300" y="35" textAnchor="middle" fontSize="13"
            fontWeight="600" fill="currentColor">Campaign</text>
      <text x="300" y="50" textAnchor="middle" fontSize="10"
            fill="currentColor" opacity="0.65">the whole effort</text>
    </g>

    {/* Lines down to chapters */}
    <g opacity="0.4">
      <line x1="300" y1="59" x2="300" y2="80" stroke="currentColor" />
      <line x1="120" y1="80" x2="480" y2="80" stroke="currentColor" />
      <line x1="120" y1="80" x2="120" y2="95" stroke="currentColor" />
      <line x1="300" y1="80" x2="300" y2="95" stroke="currentColor" />
      <line x1="480" y1="80" x2="480" y2="95" stroke="currentColor" />
    </g>

    {/* Chapters */}
    {[
      { x: 60, label: "Chapter" },
      { x: 240, label: "Chapter" },
      { x: 420, label: "Chapter" },
    ].map((c, i) => (
      <g key={i}>
        <rect x={c.x} y="95" width="120" height="40" rx="6"
              fill="currentColor" opacity="0.07" />
        <rect x={c.x} y="95" width="120" height="40" rx="6"
              fill="none" stroke="currentColor" strokeWidth="1.2" />
        <text x={c.x + 60} y="113" textAnchor="middle" fontSize="12"
              fontWeight="500" fill="currentColor">{c.label}</text>
        <text x={c.x + 60} y="126" textAnchor="middle" fontSize="9"
              fill="currentColor" opacity="0.6">a local group</text>
      </g>
    ))}

    {/* Line down from middle chapter to actions */}
    <g opacity="0.4">
      <line x1="300" y1="135" x2="300" y2="160" stroke="currentColor" />
      <line x1="200" y1="160" x2="400" y2="160" stroke="currentColor" />
      <line x1="200" y1="160" x2="200" y2="175" stroke="currentColor" />
      <line x1="300" y1="160" x2="300" y2="175" stroke="currentColor" />
      <line x1="400" y1="160" x2="400" y2="175" stroke="currentColor" />
    </g>

    {/* Actions */}
    {[
      { x: 160, label: "Action" },
      { x: 260, label: "Action" },
      { x: 360, label: "Action" },
    ].map((a, i) => (
      <g key={i}>
        <rect x={a.x} y="175" width="80" height="34" rx="5"
              fill="none" stroke="currentColor" strokeWidth="1.2" />
        <text x={a.x + 40} y="190" textAnchor="middle" fontSize="11"
              fontWeight="500" fill="currentColor">{a.label}</text>
        <text x={a.x + 40} y="202" textAnchor="middle" fontSize="9"
              fill="currentColor" opacity="0.6">an event</text>
      </g>
    ))}

    {/* Line down to cards & links */}
    <g opacity="0.4">
      <line x1="300" y1="209" x2="300" y2="232" stroke="currentColor" />
    </g>

    {/* Cards & links */}
    <g>
      <rect x="230" y="232" width="140" height="36" rx="5"
            fill="currentColor" opacity="0.1" />
      <rect x="230" y="232" width="140" height="36" rx="5"
            fill="none" stroke="currentColor" strokeWidth="1.2" />
      <text x="300" y="248" textAnchor="middle" fontSize="11"
            fontWeight="500" fill="currentColor">Cards &amp; links</text>
      <text x="300" y="261" textAnchor="middle" fontSize="9"
            fill="currentColor" opacity="0.6">what reaches people</text>
    </g>
  </svg>
);

export const PrivacyDiagram = () => (
  <svg
    viewBox="0 0 600 200"
    className="w-full h-auto text-foreground"
    role="img"
    aria-label="A scan comes in carrying an IP address. The system keeps the approximate zip code and discards the IP."
  >
    {/* Incoming scan */}
    <g>
      <rect x="20" y="70" width="130" height="60" rx="6"
            fill="none" stroke="currentColor" strokeWidth="1.5" />
      <text x="85" y="92" textAnchor="middle" fontSize="12"
            fontWeight="600" fill="currentColor">A scan</text>
      <text x="85" y="108" textAnchor="middle" fontSize="10"
            fill="currentColor" opacity="0.65">carries an IP</text>
      <text x="85" y="122" textAnchor="middle" fontSize="10"
            fill="currentColor" opacity="0.65">address</text>
    </g>

    {/* Arrow */}
    <g opacity="0.5">
      <line x1="160" y1="100" x2="235" y2="100" stroke="currentColor" strokeWidth="1.5" />
      <polyline points="228,95 235,100 228,105" fill="none"
                stroke="currentColor" strokeWidth="1.5" />
    </g>

    {/* System */}
    <g>
      <rect x="245" y="60" width="120" height="80" rx="6"
            fill="currentColor" opacity="0.08" />
      <rect x="245" y="60" width="120" height="80" rx="6"
            fill="none" stroke="currentColor" strokeWidth="1.5"
            strokeDasharray="4 3" />
      <text x="305" y="92" textAnchor="middle" fontSize="11"
            fontWeight="500" fill="currentColor">Look up</text>
      <text x="305" y="107" textAnchor="middle" fontSize="11"
            fontWeight="500" fill="currentColor">approximate</text>
      <text x="305" y="122" textAnchor="middle" fontSize="11"
            fontWeight="500" fill="currentColor">zip code</text>
    </g>

    {/* Kept */}
    <g>
      <line x1="365" y1="85" x2="430" y2="60" stroke="currentColor"
            strokeWidth="1.5" opacity="0.5" />
      <polyline points="423,58 430,60 426,67" fill="none"
                stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
      <rect x="435" y="35" width="145" height="50" rx="6"
            fill="currentColor" opacity="0.15" />
      <rect x="435" y="35" width="145" height="50" rx="6"
            fill="none" stroke="currentColor" strokeWidth="1.5" />
      <text x="507" y="55" textAnchor="middle" fontSize="11"
            fontWeight="600" fill="currentColor">Kept</text>
      <text x="507" y="72" textAnchor="middle" fontSize="10"
            fill="currentColor" opacity="0.7">rough zip code</text>
    </g>

    {/* Discarded */}
    <g>
      <line x1="365" y1="115" x2="430" y2="140" stroke="currentColor"
            strokeWidth="1.5" opacity="0.5" />
      <polyline points="423,142 430,140 426,133" fill="none"
                stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
      <rect x="435" y="115" width="145" height="50" rx="6"
            fill="none" stroke="currentColor" strokeWidth="1.5"
            strokeDasharray="4 3" opacity="0.7" />
      <text x="507" y="135" textAnchor="middle" fontSize="11"
            fontWeight="600" fill="currentColor" opacity="0.8">Discarded</text>
      <text x="507" y="152" textAnchor="middle" fontSize="10"
            fill="currentColor" opacity="0.6">the IP address</text>
      <line x1="455" y1="148" x2="490" y2="125" stroke="currentColor"
            strokeWidth="1" opacity="0.4" />
    </g>
  </svg>
);
