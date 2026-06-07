import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CheckCircle2, XCircle, PlayCircle, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CheckResult {
  id: string;
  suite: string;
  name: string;
  guards: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

interface RunResponse {
  summary: {
    total: number;
    passed: number;
    failed: number;
    durationMs: number;
    runAt: string;
  };
  results: CheckResult[];
}

export default function RegressionTests() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<RunResponse | null>(null);
  const { toast } = useToast();

  const runChecks = async () => {
    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke(
        "run-regression-tests",
        { body: {} },
      );
      if (error) throw error;
      setData(result as RunResponse);
      const r = result as RunResponse;
      toast({
        title: r.summary.failed === 0 ? "All checks passed" : "Some checks failed",
        description: `${r.summary.passed}/${r.summary.total} passed in ${r.summary.durationMs}ms`,
        variant: r.summary.failed === 0 ? "default" : "destructive",
      });
    } catch (e) {
      toast({
        title: "Couldn't run checks",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Group results by suite
  const grouped = data
    ? data.results.reduce<Record<string, CheckResult[]>>((acc, r) => {
        (acc[r.suite] ||= []).push(r);
        return acc;
      }, {})
    : {};

  return (
    <div className="container max-w-5xl py-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Regression Tests</h1>
          <p className="text-muted-foreground mt-2">
            One-click checks that guard against bugs we've already fixed.
            Run these after big changes to confirm nothing slipped back.
          </p>
        </div>
        <Button onClick={runChecks} disabled={loading} size="lg">
          {loading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <PlayCircle className="h-4 w-4 mr-2" />
          )}
          {loading ? "Running…" : "Run checks"}
        </Button>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>What this page runs</AlertTitle>
        <AlertDescription>
          These are the snapshot-renderer checks (canvas orientation and map
          zoom math) — the pieces that broke in the 2026-06-07 snapshot bug.
          Frontend component tests and database tests still need to be run
          from a developer terminal; see{" "}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">
            docs/REGRESSION_TESTS.md
          </code>
          .
        </AlertDescription>
      </Alert>

      {data && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Summary</span>
              <div className="flex gap-2">
                <Badge variant="outline" className="text-base">
                  {data.summary.passed} / {data.summary.total} passed
                </Badge>
                {data.summary.failed > 0 && (
                  <Badge variant="destructive" className="text-base">
                    {data.summary.failed} failed
                  </Badge>
                )}
              </div>
            </CardTitle>
            <CardDescription>
              Ran at {new Date(data.summary.runAt).toLocaleString()} ·{" "}
              {data.summary.durationMs}ms
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {Object.entries(grouped).map(([suite, results]) => (
        <Card key={suite}>
          <CardHeader>
            <CardTitle className="text-lg font-mono">{suite}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {results.map((r) => (
              <div
                key={r.id}
                className="flex items-start gap-3 p-3 rounded-md border bg-card"
              >
                {r.passed ? (
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-muted-foreground">
                      {r.id}
                    </span>
                    <span className="font-medium">{r.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {r.durationMs}ms
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {r.guards}
                  </p>
                  {!r.passed && r.error && (
                    <pre className="mt-2 text-xs bg-destructive/10 text-destructive p-2 rounded overflow-auto">
                      {r.error}
                    </pre>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {!data && !loading && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Click <strong>Run checks</strong> to see results.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tests not yet runnable from here</CardTitle>
          <CardDescription>
            These have automated tests but need a developer terminal to run.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <div className="font-medium">Frontend tests (Vitest)</div>
            <p className="text-muted-foreground">
              Hotspot overlap detection, slide auto-classification, Vimeo
              player. Run with{" "}
              <code className="bg-muted px-1 py-0.5 rounded text-xs">npm test</code>
              .
            </p>
          </div>
          <div>
            <div className="font-medium">Backlog</div>
            <p className="text-muted-foreground">
              See <code className="bg-muted px-1 py-0.5 rounded text-xs">docs/REGRESSION_TESTS.md</code>{" "}
              for the full catalog and what's still on the to-write list
              (token mint level cap, RLS tripwires, template delete protection,
              etc.).
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
