import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface DeploymentConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  eoaCount: number;
  campaigns: string[];
  isDeploying: boolean;
  deckSlug?: string;
}

export function DeploymentConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  eoaCount,
  campaigns,
  isDeploying,
  deckSlug,
}: DeploymentConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Deploy {deckSlug ? <span className="font-mono">{deckSlug}</span> : "this deck"}?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                This deck is used by <strong>{eoaCount} event{eoaCount !== 1 ? 's' : ''}</strong> across{' '}
                <strong>{campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}</strong>.
                Only events assigned to this deck will be re-published — other decks in the same campaign are unaffected.
              </p>

              {campaigns.length > 0 && (
                <div className="bg-muted rounded p-3 space-y-1">
                  <div className="font-semibold text-sm">Affected Campaigns:</div>
                  <ul className="list-disc list-inside text-sm text-muted-foreground">
                    {campaigns.slice(0, 3).map((campaign, i) => (
                      <li key={i}>{campaign}</li>
                    ))}
                    {campaigns.length > 3 && (
                      <li>...and {campaigns.length - 3} more</li>
                    )}
                  </ul>
                </div>
              )}

              <div className="border-l-2 border-primary pl-3 space-y-1 text-sm">
                <div className="font-semibold">What deploy does:</div>
                <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                  <li>Marks this deck as Live with the latest content</li>
                  <li>Re-renders snapshots for affected campaigns</li>
                  <li><strong>Existing QR codes and viral links keep working</strong> — no tokens are invalidated</li>
                  <li>Updates visible on next scan/view</li>
                </ul>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeploying}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isDeploying}>
            {isDeploying ? "Deploying..." : "Deploy Now"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
