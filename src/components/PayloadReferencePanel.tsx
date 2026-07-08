import { ALL_LEVELS, COLOR_LEGEND, type ColorRole, type LevelTemplate, type Segment } from "@/lib/virality/payloadTemplates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const roleStyle: Record<ColorRole, string> = {
  campaign: "text-[hsl(var(--payload-campaign))]",
  eoa: "text-[hsl(var(--payload-eoa))]",
  level: "text-[hsl(var(--payload-level))]",
  medium: "text-[hsl(var(--payload-medium))]",
  content: "text-[hsl(var(--payload-content))]",
  "self-token": "text-[hsl(var(--payload-self-token))]",
  "parent-token": "text-[hsl(var(--payload-parent-token))]",
  static: "text-muted-foreground",
};

const roleSwatch: Record<ColorRole, string> = {
  campaign: "bg-[hsl(var(--payload-campaign))]",
  eoa: "bg-[hsl(var(--payload-eoa))]",
  level: "bg-[hsl(var(--payload-level))]",
  medium: "bg-[hsl(var(--payload-medium))]",
  content: "bg-[hsl(var(--payload-content))]",
  "self-token": "bg-[hsl(var(--payload-self-token))]",
  "parent-token": "bg-[hsl(var(--payload-parent-token))]",
  static: "bg-muted",
};

function SegmentLine({ segment }: { segment: Segment }) {
  const span = (
    <span className="font-mono text-sm break-all">
      <span className="text-muted-foreground">{segment.key}</span>
      <span className={`font-medium ${roleStyle[segment.colorRole]}`}>
        {segment.value}
      </span>
    </span>
  );
  if (!segment.note) return <div>{span}</div>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="cursor-help hover:bg-muted/50 rounded px-1 -mx-1">{span}</div>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-sm text-xs">
        {segment.note}
      </TooltipContent>
    </Tooltip>
  );
}

function LevelBlock({ level }: { level: LevelTemplate }) {
  return (
    <div className="border border-border rounded-md p-3 bg-card">
      <div className="mb-2">
        <div className="font-semibold text-sm">{level.label}</div>
        <div className="text-xs text-muted-foreground">{level.description}</div>
      </div>
      <div className="space-y-0.5">
        {level.segments.map((s, i) => (
          <SegmentLine key={i} segment={s} />
        ))}
      </div>
    </div>
  );
}

export default function PayloadReferencePanel() {
  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">URL Payload Reference</CardTitle>
        <p className="text-xs text-muted-foreground">
          Generic templates mirrored from <code>mint_l00</code> and <code>mint_share</code>.
          Placeholders in <code>{"{braces}"}</code> are filled at mint time.
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 pt-2">
          {COLOR_LEGEND.map((l) => (
            <div key={l.role} className="flex items-center gap-1.5 text-xs">
              <span className={`inline-block w-3 h-3 rounded ${roleSwatch[l.role]}`} />
              <span className="text-muted-foreground">{l.label}</span>
            </div>
          ))}
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {ALL_LEVELS.map((lvl) => (
          <LevelBlock key={lvl.id} level={lvl} />
        ))}
      </CardContent>
    </Card>
  );
}
