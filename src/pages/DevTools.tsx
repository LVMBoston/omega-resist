import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Copy, GitBranch, GitMerge, Upload } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";

const DevTools = () => {
  const [repoUrl, setRepoUrl] = useState("");
  const [targetBranch, setTargetBranch] = useState("main");

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const commands = {
    addRemote: `git remote add origin ${repoUrl || "<your-github-repo-url>"}`,
    checkRemote: `git remote -v`,
    pushWork: `git push origin work`,
    checkoutTarget: `git checkout ${targetBranch}`,
    mergeWork: `git merge work`,
    pushTarget: `git push origin ${targetBranch}`,
    fullSequence: `# Add remote (skip if already configured)
git remote add origin ${repoUrl || "<your-github-repo-url>"}

# Verify remote
git remote -v

# Push work branch
git push origin work

# Optional: Merge into ${targetBranch} for Lovable visibility
git checkout ${targetBranch}
git merge work
git push origin ${targetBranch}`
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Developer Tools</h1>
        <p className="text-muted-foreground">
          Push Codex's local work branch to GitHub
        </p>
      </div>

      <Alert>
        <AlertDescription>
          <strong>Context:</strong> Codex's documentation files exist in a local workspace on the <code className="bg-muted px-1 rounded">work</code> branch 
          without a configured Git remote. Use these commands to push them to GitHub so both you and Lovable can see them.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
          <CardDescription>
            Set your repository details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="repoUrl">GitHub Repository URL</Label>
            <Input
              id="repoUrl"
              placeholder="https://github.com/username/repo.git"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="targetBranch">Target Branch (for Lovable)</Label>
            <Input
              id="targetBranch"
              placeholder="main"
              value={targetBranch}
              onChange={(e) => setTargetBranch(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              The branch your Lovable project is connected to
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Quick Push (Recommended)
          </CardTitle>
          <CardDescription>
            Copy and run this complete sequence in your terminal
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted p-4 rounded-lg font-mono text-sm whitespace-pre-wrap break-all">
            {commands.fullSequence}
          </div>
          <Button
            onClick={() => copyToClipboard(commands.fullSequence)}
            className="w-full"
          >
            <Copy className="mr-2 h-4 w-4" />
            Copy All Commands
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step-by-Step Commands</CardTitle>
          <CardDescription>
            Execute these commands individually if needed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2 font-semibold">
              <GitBranch className="h-4 w-4" />
              Step 1: Add Remote
            </div>
            <div className="bg-muted p-3 rounded font-mono text-sm break-all">
              {commands.addRemote}
            </div>
            <Button
              onClick={() => copyToClipboard(commands.addRemote)}
              variant="outline"
              size="sm"
            >
              <Copy className="mr-2 h-3 w-3" />
              Copy
            </Button>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center gap-2 font-semibold">
              <Upload className="h-4 w-4" />
              Step 2: Push Work Branch
            </div>
            <div className="bg-muted p-3 rounded font-mono text-sm">
              {commands.pushWork}
            </div>
            <Button
              onClick={() => copyToClipboard(commands.pushWork)}
              variant="outline"
              size="sm"
            >
              <Copy className="mr-2 h-3 w-3" />
              Copy
            </Button>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center gap-2 font-semibold">
              <GitMerge className="h-4 w-4" />
              Step 3: Merge to Target (Optional)
            </div>
            <p className="text-sm text-muted-foreground">
              Required if Lovable is watching <code className="bg-muted px-1 rounded">{targetBranch}</code> branch
            </p>
            <div className="bg-muted p-3 rounded font-mono text-sm space-y-1">
              <div>{commands.checkoutTarget}</div>
              <div>{commands.mergeWork}</div>
              <div>{commands.pushTarget}</div>
            </div>
            <Button
              onClick={() => copyToClipboard(`${commands.checkoutTarget}\n${commands.mergeWork}\n${commands.pushTarget}`)}
              variant="outline"
              size="sm"
            >
              <Copy className="mr-2 h-3 w-3" />
              Copy
            </Button>
          </div>
        </CardContent>
      </Card>

      <Alert>
        <AlertDescription>
          <strong>After pushing:</strong> Lovable's bidirectional sync should automatically detect the changes. 
          If using experimental branch switching, you may need to switch to the <code className="bg-muted px-1 rounded">work</code> branch in Lovable settings.
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default DevTools;
