import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";

interface DiffRow {
  token: string;
  eoa_id: string;
  utm_campaign: string;
  mobilize_code: string | null;
  utm_id: string | null;
  old_medium: string | null;
  new_medium: string;
  short_urls_updated: number;
  applied: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Limit the back-fix to a single campaign code (e.g. "framing"). Omit for all campaigns. */
  campaignCode?: string | null;
  /** Optional callback after a successful Apply so callers can refresh their views. */
  onApplied?: () => void;
}

export function RecomputeUtmMediumDialog({
  open,
  onOpenChange,
  campaignCode = null,
  onApplied,
}: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [diff, setDiff] = useState<DiffRow[] | null>(null);
  const [appliedRows, setAppliedRows] = useState<DiffRow[] | null>(null);

  const runDryRun = async () => {
    setLoading(true);
    setAppliedRows(null);
    try {
      const { data, error } = await supabase.rpc("recompute_l00_utm_medium" as any, {
        _campaign_code: campaignCode,
        _dry_run: true,
      });
      if (error) throw error;
      setDiff((data ?? []) as DiffRow[]);
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Could not preview changes",
        description: err.message ?? String(err),
      });
    } finally {
      setLoading(false);
    }
  };

  const apply = async () => {
    setApplying(true);
    try {
      const { data, error } = await supabase.rpc("recompute_l00_utm_medium" as any, {
        _campaign_code: campaignCode,
        _dry_run: false,
      });
      if (error) throw error;
      const rows = (data ?? []) as DiffRow[];
      setAppliedRows(rows);
      setDiff(null);
      toast({
        title: "Channel values corrected",
        description: `Updated ${rows.length} L00 token${rows.length === 1 ? "" : "s"}.`,
      });
      onApplied?.();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Could not apply changes",
        description: err.message ?? String(err),
      });
    } finally {
      setApplying(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setDiff(null);
      setAppliedRows(null);
    }
    onOpenChange(next);
  };

  const rowsToShow = appliedRows ?? diff;
  const scopeLabel = campaignCode ? `campaign "${campaignCode}"` : "every campaign";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Recompute channel (utm_medium) for L00 tokens</DialogTitle>
          <DialogDescription>
            Looks at every organizer seed (L00) token in {scopeLabel}, figures out the
            correct channel from the event's <code>utm_id</code> (for example{" "}
            <code>tst-mail</code> → email), and rewrites the channel value on the
            token, its long URL, and any matching short URL. Token strings stay the
            same, so QR codes, printed cards, and shared links keep working.
          </DialogDescription>
        </DialogHeader>

        {rowsToShow === null && !loading && (
          <div className="flex flex-col items-center gap-3 py-8 text-center text-sm text-muted-foreground">
            <AlertCircle className="h-8 w-8" />
            <p>
              Click <strong>Preview changes</strong> to see what would be updated.
              Nothing is written until you click <strong>Apply</strong>.
            </p>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {rowsToShow !== null && !loading && (
          <>
            {appliedRows && (
              <div className="flex items-center gap-2 rounded-md border border-green-500/30 bg-green-500/10 p-3 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>
                  Applied. {appliedRows.length} token
                  {appliedRows.length === 1 ? "" : "s"} updated.
                </span>
              </div>
            )}
            {rowsToShow.length === 0 ? (
              <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                Nothing to change — every L00 token in {scopeLabel} already has the
                correct channel value.
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Mobilize code</TableHead>
                      <TableHead>utm_id</TableHead>
                      <TableHead>Old channel</TableHead>
                      <TableHead>New channel</TableHead>
                      <TableHead className="text-right">Short URLs</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rowsToShow.map((r) => (
                      <TableRow key={r.token}>
                        <TableCell className="font-mono text-xs">
                          {r.utm_campaign}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {r.mobilize_code ?? "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {r.utm_id ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{r.old_medium ?? "—"}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge>{r.new_medium}</Badge>
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {r.short_urls_updated}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={runDryRun}
            disabled={loading || applying}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {diff === null && appliedRows === null ? "Preview changes" : "Re-check"}
          </Button>
          <Button
            onClick={apply}
            disabled={
              applying ||
              loading ||
              diff === null ||
              diff.length === 0 ||
              !!appliedRows
            }
          >
            {applying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Apply {diff && diff.length > 0 ? `(${diff.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
