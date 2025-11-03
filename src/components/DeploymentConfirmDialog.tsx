import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface DeploymentConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  eoaCount: number;
  campaigns: string[];
  isDeploying: boolean;
}

export function DeploymentConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  eoaCount,
  campaigns,
  isDeploying
}: DeploymentConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Deploy Deck Changes?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                This deck is used by <strong>{eoaCount} event{eoaCount !== 1 ? 's' : ''}</strong> across{' '}
                <strong>{campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}</strong>.
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
                <div className="font-semibold">What happens when you deploy:</div>
                <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                  <li>New content will be live immediately</li>
                  <li>Existing QR codes continue to work</li>
                  <li>New tokens generated for all {eoaCount} event{eoaCount !== 1 ? 's' : ''}</li>
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
