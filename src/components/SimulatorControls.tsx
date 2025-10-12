import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { mintL00, mintShare } from "@/lib/virality/mint";
import { getL00Location, getLocationForLevel, logEventWithLocation } from "@/lib/virality/simulator";
import { Loader2, Trash2, StopCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface EoA {
  id: string;
  title: string;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  assigned_deck_slug: string | null;
}

interface SimulatorControlsProps {
  campaignId: string;
  onSimulationComplete?: () => void;
}

export function SimulatorControls({ campaignId, onSimulationComplete }: SimulatorControlsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedEoaIds, setSelectedEoaIds] = useState<Set<string>>(new Set());
  const [l00Count, setL00Count] = useState(10);
  const [l01Factor, setL01Factor] = useState(3);
  const [l02Factor, setL02Factor] = useState(2);
  const [l03Factor, setL03Factor] = useState(1);
  const [isSimulating, setIsSimulating] = useState(false);
  const [progress, setProgress] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const { data: eoas, isLoading: eoasLoading } = useQuery({
    queryKey: ["eoas", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events_actions")
        .select("id, title, city, state, zip_code, assigned_deck_slug")
        .eq("campaign_id", campaignId)
        .order("title");
      if (error) throw error;
      return data as EoA[];
    },
    enabled: !!campaignId,
  });

  const toggleEoaSelection = (eoaId: string) => {
    const newSelection = new Set(selectedEoaIds);
    if (newSelection.has(eoaId)) {
      newSelection.delete(eoaId);
    } else {
      newSelection.add(eoaId);
    }
    setSelectedEoaIds(newSelection);
  };

  const selectAllEoas = () => {
    if (!eoas) return;
    setSelectedEoaIds(new Set(eoas.map(e => e.id)));
  };

  const deselectAllEoas = () => {
    setSelectedEoaIds(new Set());
  };

  const stopSimulation = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      toast({ title: "Simulation stopped", description: "The simulation has been aborted." });
    }
  };

  const clearSimulationData = async () => {
    try {
      await supabase.from('url_events').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('tokens').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      queryClient.invalidateQueries({ queryKey: ["url_events"] });
      queryClient.invalidateQueries({ queryKey: ["tokens"] });

      toast({ title: "Data cleared", description: "All simulation data has been deleted." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to clear simulation data.", variant: "destructive" });
    }
  };

  const runSimulation = async () => {
    if (selectedEoaIds.size === 0) {
      toast({ title: "No EOAs selected", description: "Please select at least one event/action.", variant: "destructive" });
      return;
    }

    abortControllerRef.current = new AbortController();
    setIsSimulating(true);
    setProgress(0);

    const selectedEoas = eoas?.filter(e => selectedEoaIds.has(e.id)) || [];
    const totalSteps = selectedEoas.length;
    let completedSteps = 0;

    try {
      for (const eoa of selectedEoas) {
        if (abortControllerRef.current.signal.aborted) throw new Error("Simulation aborted");

        if (!eoa.zip_code || !eoa.assigned_deck_slug) {
          completedSteps++;
          setProgress((completedSteps / totalSteps) * 100);
          continue;
        }

        const l00Location = getL00Location(eoa.zip_code, eoa.city || undefined, eoa.state || undefined);
        if (!l00Location) {
          completedSteps++;
          setProgress((completedSteps / totalSteps) * 100);
          continue;
        }

        const { data: existingL00 } = await supabase.from('tokens').select('token').eq('eoa_id', eoa.id).eq('level', 0).single();

        let l00Token: string;
        if (existingL00) {
          l00Token = existingL00.token;
        } else {
          const result = await mintL00({ eoaId: eoa.id, deckSlug: eoa.assigned_deck_slug, utmMedium: "qr" });
          l00Token = result.token;
          await supabase.from('tokens').update({ is_simulated: true }).eq('token', l00Token);
        }

        for (let i = 0; i < l00Count; i++) {
          if (abortControllerRef.current.signal.aborted) throw new Error("Simulation aborted");

          await logEventWithLocation(l00Token, "scan", l00Location);

          for (let j = 0; j < l01Factor; j++) {
            const l01Location = getLocationForLevel(1, l00Location);
            const { token: l01Token } = await mintShare({ parentToken: l00Token, utmMedium: "social" });
            await supabase.from('tokens').update({ is_simulated: true }).eq('token', l01Token);
            await logEventWithLocation(l01Token, "share", l01Location);

            for (let k = 0; k < l02Factor; k++) {
              const l02Location = getLocationForLevel(2, l01Location);
              const { token: l02Token } = await mintShare({ parentToken: l01Token, utmMedium: "social" });
              await supabase.from('tokens').update({ is_simulated: true }).eq('token', l02Token);
              await logEventWithLocation(l02Token, "share", l02Location);

              for (let m = 0; m < l03Factor; m++) {
                const l03Location = getLocationForLevel(3, l02Location);
                const { token: l03Token } = await mintShare({ parentToken: l02Token, utmMedium: "p2p" });
                await supabase.from('tokens').update({ is_simulated: true }).eq('token', l03Token);
                await logEventWithLocation(l03Token, "share", l03Location);
              }
            }
          }
        }

        completedSteps++;
        setProgress((completedSteps / totalSteps) * 100);
      }

      // Invalidate all analytics queries to refresh data
      await queryClient.invalidateQueries();

      toast({ 
        title: "Simulation complete!", 
        description: `Generated data for ${selectedEoas.length} EOAs. Switch to "Simulated" or "Both" data source in Filters to view.`,
        duration: 8000
      });
      
      if (onSimulationComplete) onSimulationComplete();
    } catch (error: any) {
      if (error.message !== "Simulation aborted") {
        toast({ title: "Simulation failed", description: error.message, variant: "destructive" });
      }
    } finally {
      setIsSimulating(false);
      setProgress(0);
      abortControllerRef.current = null;
    }
  };

  const totalTokensPerEoa = l00Count * (1 + l01Factor + l01Factor * l02Factor + l01Factor * l02Factor * l03Factor);

  if (!campaignId) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Please select a campaign in the Filters tab to use the simulator.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Select Events/Actions</CardTitle>
          <CardDescription>Choose which EOAs to simulate</CardDescription>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={selectAllEoas}>Select All</Button>
            <Button variant="outline" size="sm" onClick={deselectAllEoas}>Deselect All</Button>
          </div>
        </CardHeader>
        <CardContent>
          {eoasLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading events...</span>
            </div>
          ) : (
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {eoas?.map((eoa) => (
                <div key={eoa.id} className="flex items-center gap-3 p-2 border rounded">
                  <Checkbox checked={selectedEoaIds.has(eoa.id)} onCheckedChange={() => toggleEoaSelection(eoa.id)} />
                  <div className="flex-1">
                    <div className="font-medium">{eoa.title}</div>
                    <div className="text-sm text-muted-foreground">
                      {eoa.city}, {eoa.state} {eoa.zip_code} • Deck: {eoa.assigned_deck_slug || "None"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configure Simulation</CardTitle>
          <CardDescription>Each EOA will generate ~{totalTokensPerEoa} tokens</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="l00-count">L00 Tokens per EOA</Label>
              <Input id="l00-count" type="number" min={1} max={100} value={l00Count} onChange={(e) => setL00Count(parseInt(e.target.value) || 1)} />
            </div>
            <div>
              <Label htmlFor="l01-factor">L01 per L00</Label>
              <Input id="l01-factor" type="number" min={0} max={10} value={l01Factor} onChange={(e) => setL01Factor(parseInt(e.target.value) || 0)} />
            </div>
            <div>
              <Label htmlFor="l02-factor">L02 per L01</Label>
              <Input id="l02-factor" type="number" min={0} max={10} value={l02Factor} onChange={(e) => setL02Factor(parseInt(e.target.value) || 0)} />
            </div>
            <div>
              <Label htmlFor="l03-factor">L03 per L02</Label>
              <Input id="l03-factor" type="number" min={0} max={10} value={l03Factor} onChange={(e) => setL03Factor(parseInt(e.target.value) || 0)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Run Simulation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-muted rounded-lg">
            <div className="text-sm space-y-1">
              <div>Selected EOAs: <strong>{selectedEoaIds.size}</strong></div>
              <div>Tokens per EOA: <strong>{totalTokensPerEoa}</strong></div>
              <div>Total tokens: <strong>{selectedEoaIds.size * totalTokensPerEoa}</strong></div>
            </div>
          </div>

          {isSimulating && (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-sm text-muted-foreground text-center">Simulating... {Math.round(progress)}%</p>
            </div>
          )}

          <Button onClick={runSimulation} disabled={isSimulating || selectedEoaIds.size === 0} className="w-full" size="lg">
            {isSimulating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Simulating...</> : "Run Simulation"}
          </Button>

          {isSimulating && (
            <Button onClick={stopSimulation} variant="destructive" className="w-full" size="lg">
              <StopCircle className="mr-2 h-4 w-4" />Stop Simulation
            </Button>
          )}

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="w-full" disabled={isSimulating}>
                <Trash2 className="mr-2 h-4 w-4" />Clear All Simulation Data
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete ALL tokens and events from ALL campaigns. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={clearSimulationData} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete Everything
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
