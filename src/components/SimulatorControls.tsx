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
import { clearShortUrlCache } from "@/lib/virality/shortener";
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
  mobilize_code: string | null;
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
        .select("id, title, city, state, zip_code, assigned_deck_slug, mobilize_code")
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
      console.log("Starting simulation data cleanup...");
      
      // Count before deletion
      const { count: eventsBefore, error: eventsCountError } = await supabase
        .from("url_events")
        .select("*", { count: "exact", head: true })
        .eq("is_simulated", true);
      
      if (eventsCountError) {
        console.error("Error counting events:", eventsCountError);
        throw eventsCountError;
      }
      
      const { count: tokensBefore, error: tokensCountError } = await supabase
        .from("tokens")
        .select("*", { count: "exact", head: true })
        .eq("is_simulated", true);
      
      if (tokensCountError) {
        console.error("Error counting tokens:", tokensCountError);
        throw tokensCountError;
      }
      
      console.log(`Found ${eventsBefore} simulated events and ${tokensBefore} simulated tokens to delete`);

      // Delete simulated URL events FIRST (before tokens, to avoid FK constraint issues)
      console.log("Attempting to delete simulated events...");
      const { error: eventsError, count: eventsDeleted } = await supabase
        .from("url_events")
        .delete({ count: "exact" })
        .eq("is_simulated", true);

      if (eventsError) {
        console.error("Failed to delete events:", eventsError);
        toast({
          title: "Error deleting events",
          description: `${eventsError.message}`,
          variant: "destructive"
        });
        throw eventsError;
      }
      console.log(`Successfully deleted ${eventsDeleted} simulated events`);

      // Delete simulated tokens SECOND (after events are gone)
      console.log("Attempting to delete simulated tokens...");
      const { error: tokensError, count: tokensDeleted } = await supabase
        .from("tokens")
        .delete({ count: "exact" })
        .eq("is_simulated", true);

      if (tokensError) {
        console.error("Failed to delete tokens:", tokensError);
        toast({
          title: "Error deleting tokens",
          description: `${tokensError.message}`,
          variant: "destructive"
        });
        throw tokensError;
      }
      console.log(`Successfully deleted ${tokensDeleted} simulated tokens`);

      // Verify deletion
      const { count: eventsAfter } = await supabase
        .from("url_events")
        .select("*", { count: "exact", head: true })
        .eq("is_simulated", true);
      
      const { count: tokensAfter } = await supabase
        .from("tokens")
        .select("*", { count: "exact", head: true })
        .eq("is_simulated", true);
      
      console.log(`After deletion: ${eventsAfter} events and ${tokensAfter} tokens remaining`);

      // Force refresh all relevant queries
      await queryClient.invalidateQueries({ queryKey: ["url_events"] });
      await queryClient.invalidateQueries({ queryKey: ["tokens"] });
      await queryClient.invalidateQueries({ queryKey: ["eventCounts"] });
      await queryClient.invalidateQueries({ queryKey: ["viralityMetrics"] });
      await queryClient.refetchQueries();

      toast({ 
        title: "Data cleared successfully", 
        description: `Deleted ${eventsDeleted} events and ${tokensDeleted} tokens. Refreshing dashboard...` 
      });
      
      // Trigger callback to refresh parent components
      if (onSimulationComplete) {
        setTimeout(() => onSimulationComplete(), 500);
      }
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
    let lastRefreshTime = Date.now();

    const selectedEoas = eoas?.filter(e => selectedEoaIds.has(e.id)) || [];
    const totalSteps = selectedEoas.length;
    let completedSteps = 0;

    try {
      for (const eoa of selectedEoas) {
        if (abortControllerRef.current.signal.aborted) throw new Error("Simulation aborted");

        try {
          if (!eoa.zip_code || !eoa.assigned_deck_slug || !eoa.mobilize_code) {
            const reason = !eoa.zip_code ? "Missing zip code" : !eoa.assigned_deck_slug ? "No deck assigned" : "Missing mobilize code";
            toast({
              title: "Skipped EoA",
              description: `${eoa.title}: ${reason}`,
              variant: "destructive",
            });
            completedSteps++;
            setProgress((completedSteps / totalSteps) * 100);
            continue;
          }

          const l00Location = await getL00Location(eoa.zip_code, eoa.city || undefined, eoa.state || undefined);
          if (!l00Location) {
            toast({
              title: "Skipped EoA",
              description: `${eoa.title}: Zip code ${eoa.zip_code} not found in simulator database`,
              variant: "destructive",
            });
            completedSteps++;
            setProgress((completedSteps / totalSteps) * 100);
            continue;
          }

          // Check if L00 token already exists for this EOA
          const { data: existingL00 } = await supabase
            .from('tokens')
            .select('token')
            .eq('eoa_id', eoa.id)
            .eq('level', 0)
            .maybeSingle();

          let l00Token: string;
          
          if (existingL00) {
            // Use existing L00 token and mark as simulated
            l00Token = existingL00.token;
            await supabase.from('tokens').update({ is_simulated: true }).eq('token', l00Token);
            console.log(`Using existing L00 token for ${eoa.title}: ${l00Token}`);
          } else {
            // Mint new L00 token and mark as simulated
            const result = await mintL00({ eoaId: eoa.id, deckSlug: eoa.assigned_deck_slug, utmMedium: "qr" });
            l00Token = result.token;
            await supabase.from('tokens').update({ is_simulated: true }).eq('token', l00Token);
            console.log(`Minted new simulated L00 token for ${eoa.title}: ${l00Token}`);
          }
          
          // Log multiple scan/view events for this L00 based on l00Count
          for (let i = 0; i < l00Count; i++) {
            await logEventWithLocation(l00Token, "scan", l00Location);
            await logEventWithLocation(l00Token, "view", l00Location);
          }

          // Generate L01 tokens (shares from L00)
          for (let j = 0; j < l01Factor; j++) {
            if (abortControllerRef.current.signal.aborted) throw new Error("Simulation aborted");
            
            const l01Location = await getLocationForLevel(1, l00Location);
            const { token: l01Token } = await mintShare({ parentToken: l00Token, utmMedium: "social" });
            await supabase.from('tokens').update({ is_simulated: true }).eq('token', l01Token);
            await logEventWithLocation(l01Token, "view", l01Location);
            await logEventWithLocation(l01Token, "share", l01Location);

            // Generate L02 tokens (shares from L01)
            for (let k = 0; k < l02Factor; k++) {
              if (abortControllerRef.current.signal.aborted) throw new Error("Simulation aborted");
              
              const l02Location = await getLocationForLevel(2, l01Location);
              const { token: l02Token } = await mintShare({ parentToken: l01Token, utmMedium: "social" });
              await supabase.from('tokens').update({ is_simulated: true }).eq('token', l02Token);
              await logEventWithLocation(l02Token, "view", l02Location);
              await logEventWithLocation(l02Token, "share", l02Location);

              // Generate L03 tokens (shares from L02)
              for (let m = 0; m < l03Factor; m++) {
                if (abortControllerRef.current.signal.aborted) throw new Error("Simulation aborted");
                
                const l03Location = await getLocationForLevel(3, l02Location);
                const { token: l03Token } = await mintShare({ parentToken: l02Token, utmMedium: "p2p" });
                await supabase.from('tokens').update({ is_simulated: true }).eq('token', l03Token);
                await logEventWithLocation(l03Token, "view", l03Location);
                await logEventWithLocation(l03Token, "share", l03Location);
              }
            }
          }

          console.log(`✓ Successfully completed ${eoa.title}`);
        } catch (eoaError: any) {
          console.error(`Error processing ${eoa.title}:`, eoaError);
          toast({
            title: "EoA Processing Error",
            description: `${eoa.title}: ${eoaError.message}`,
            variant: "destructive",
          });
        }

        completedSteps++;
        setProgress((completedSteps / totalSteps) * 100);
        
        // Trigger periodic refresh every 5 seconds
        const now = Date.now();
        if (now - lastRefreshTime >= 5000) {
          if (onSimulationComplete) onSimulationComplete();
          lastRefreshTime = now;
        }
      }

      // Final refresh at completion
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

  const totalTokensPerEoa = 1 + l01Factor + l01Factor * l02Factor + l01Factor * l02Factor * l03Factor;
  const expectedScansPerEoa = l00Count;
  const expectedViewsPerEoa = l00Count + l01Factor + l01Factor * l02Factor + l01Factor * l02Factor * l03Factor;
  const expectedSharesPerEoa = l01Factor + l01Factor * l02Factor + l01Factor * l02Factor * l03Factor;

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
              <Label htmlFor="l00-count">L00 Scan/View Events</Label>
              <Input id="l00-count" type="number" min={1} max={100} value={l00Count} onChange={(e) => setL00Count(parseInt(e.target.value) || 1)} />
              <p className="text-xs text-muted-foreground mt-1">Number of scan+view events for the L00 token</p>
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
          <div className="p-4 bg-muted rounded-lg space-y-3">
            <div className="text-sm space-y-1">
              <div>Selected EOAs: <strong>{selectedEoaIds.size}</strong></div>
              <div>Tokens per EOA: <strong>{totalTokensPerEoa}</strong></div>
              <div>Total tokens: <strong>{selectedEoaIds.size * totalTokensPerEoa}</strong></div>
            </div>
            
            <div className="border-t pt-3">
              <div className="text-sm font-medium mb-2">Expected Events per EOA:</div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="p-2 bg-blue-500/10 rounded border border-blue-500/20">
                  <div className="text-blue-600 font-medium">Scans</div>
                  <div className="text-lg font-bold text-blue-700">{expectedScansPerEoa}</div>
                  <div className="text-[10px] text-muted-foreground">L00 only</div>
                </div>
                <div className="p-2 bg-green-500/10 rounded border border-green-500/20">
                  <div className="text-green-600 font-medium">Views</div>
                  <div className="text-lg font-bold text-green-700">{expectedViewsPerEoa}</div>
                  <div className="text-[10px] text-muted-foreground">All levels</div>
                </div>
                <div className="p-2 bg-purple-500/10 rounded border border-purple-500/20">
                  <div className="text-purple-600 font-medium">Shares</div>
                  <div className="text-lg font-bold text-purple-700">{expectedSharesPerEoa}</div>
                  <div className="text-[10px] text-muted-foreground">L01-L03</div>
                </div>
              </div>
            </div>
            
            <div className="border-t pt-3">
              <div className="text-sm font-medium mb-2">Total Expected Events ({selectedEoaIds.size} EOAs):</div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="p-2 bg-background rounded border">
                  <div className="text-muted-foreground">Total Scans</div>
                  <div className="text-lg font-bold">{expectedScansPerEoa * selectedEoaIds.size}</div>
                </div>
                <div className="p-2 bg-background rounded border">
                  <div className="text-muted-foreground">Total Views</div>
                  <div className="text-lg font-bold">{expectedViewsPerEoa * selectedEoaIds.size}</div>
                </div>
                <div className="p-2 bg-background rounded border">
                  <div className="text-muted-foreground">Total Shares</div>
                  <div className="text-lg font-bold">{expectedSharesPerEoa * selectedEoaIds.size}</div>
                </div>
              </div>
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
                  This will permanently delete ALL tokens and events from ALL campaigns, and clear the short URL cache. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={() => {
                    clearShortUrlCache();
                    clearSimulationData();
                  }} 
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
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
