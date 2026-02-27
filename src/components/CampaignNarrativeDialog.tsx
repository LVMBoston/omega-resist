import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Download, Loader2, BookOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fetchNarrativeData, generateCampaignNarrative, CampaignNarrativeResult } from "@/lib/campaignNarrative";

interface CampaignNarrativeDialogProps {
  campaignCode: string;
  campaignId: string;
  campaignTitle: string;
}

export function CampaignNarrativeButton({ campaignCode, campaignId, campaignTitle }: CampaignNarrativeDialogProps) {
  const [open, setOpen] = useState(false);
  const [narrative, setNarrative] = useState<CampaignNarrativeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { toast } = useToast();

  const handleOpen = async () => {
    setOpen(true);
    setNarrative(null);
    setExpanded(false);
    setLoading(true);
    try {
      const data = await fetchNarrativeData(campaignCode, campaignId);
      setNarrative(generateCampaignNarrative(data));
    } catch (err) {
      console.error("Narrative generation failed:", err);
      setNarrative({ headline: "Unable to generate narrative.", fullStory: "Unable to generate narrative. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!narrative) return;
    const plain = narrative.fullStory
      .split("\n")
      .map((line) => {
        if (line.startsWith("__TITLE__") && line.endsWith("__TITLE__")) {
          return line.replace(/__TITLE__/g, "");
        }
        return line;
      })
      .join("\n");
    await navigator.clipboard.writeText(plain);
    toast({ title: "Copied!", description: "Full story copied to clipboard." });
  };

  const handleDownload = () => {
    if (!narrative) return;
    const markdown = narrative.fullStory
      .split("\n")
      .map((line) => {
        if (line.startsWith("__TITLE__") && line.endsWith("__TITLE__")) {
          return `# ${line.replace(/__TITLE__/g, "")}`;
        }
        return line;
      })
      .join("\n");
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${campaignCode}-story.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderFullStoryLine = (line: string, i: number) => {
    if (line.startsWith("__TITLE__") && line.endsWith("__TITLE__")) {
      const title = line.replace(/__TITLE__/g, "");
      return <p key={i} className="text-xl font-bold">{title}</p>;
    }
    return <p key={i} className="whitespace-pre-wrap">{line || "\u00A0"}</p>;
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleOpen}>
        <BookOpen className="h-4 w-4 mr-2" />
        Story
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Campaign Story</DialogTitle>
          </DialogHeader>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : narrative ? (
            <>
              <div className="text-sm leading-relaxed max-h-[60vh] overflow-y-auto space-y-1">
                {!expanded ? (
                  <>
                    {narrative.headline.split("\n").map((line, i) => (
                      <p key={i} className="whitespace-pre-wrap">{line || "\u00A0"}</p>
                    ))}
                    <button
                      onClick={() => setExpanded(true)}
                      className="text-primary text-xs font-medium hover:underline mt-2 block"
                    >
                      More...
                    </button>
                  </>
                ) : (
                  <>
                    {narrative.fullStory.split("\n").map((line, i) => renderFullStoryLine(line, i))}
                    <button
                      onClick={() => setExpanded(false)}
                      className="text-primary text-xs font-medium hover:underline mt-2 block"
                    >
                      Less
                    </button>
                  </>
                )}
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={handleCopy} className="flex-1">
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownload} className="flex-1">
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
