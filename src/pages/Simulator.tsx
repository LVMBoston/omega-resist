import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { mintL00, mintShare } from "@/lib/virality/mint";
import { 
  getL00Location, 
  getLocationForLevel, 
  instantiateSimulatedL00Token,
  logEventWithLocation,
  randomTimestampInRange,
  type LocationData 
} from "@/lib/virality/simulator";
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

type SimulatedShareMedium = "sms" | "em";
const SIMULATION_START_OFFSET_MS = 10 * 24 * 60 * 60 * 1000;
const SIMULATION_GENERATION_INTERVAL_MS = 12 * 60 * 60 * 1000;
const SIMULATION_EVENT_SPACING_MS = 60 * 1000;

const getSimulatedShareMedium = (index: number, parentMedium?: SimulatedShareMedium): SimulatedShareMedium => {
  const alternatingMedium: SimulatedShareMedium = index % 2 === 0 ? "sms" : "em";
  if (!parentMedium) return alternatingMedium;
  return parentMedium === "sms" ? "em" : "sms";
};

const getSimulationTimestamp = (baseTime: Date, generation: number, sequence: number): Date => {
  return new Date(baseTime.getTime() + generation * SIMULATION_GENERATION_INTERVAL_MS + sequence * SIMULATION_EVENT_SPACING_MS);
};

export default function Simulator() {
  const { toast } = useToast();
  
  // Load saved settings from localStorage
  const loadSavedSettings = () => {
    try {
      const saved = localStorage.getItem('simulator-settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          selectedEoaIds: new Set<string>(parsed.selectedEoaIds || []),
          l00Count: parsed.l00Count || 10,
          l01Factor: parsed.l01Factor || 3,
          l02Factor: parsed.l02Factor || 2,
          l03Factor: parsed.l03Factor || 1,
        };
      }
    } catch (e) {
      console.error('Failed to load simulator settings:', e);
    }
    return null;
  };

  const savedSettings = loadSavedSettings();
  
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");
  const [selectedEoaIds, setSelectedEoaIds] = useState<Set<string>>(savedSettings?.selectedEoaIds || new Set());
  const [l00Count, setL00Count] = useState(savedSettings?.l00Count || 10);
  const [l01Factor, setL01Factor] = useState(savedSettings?.l01Factor || 3);
  const [l02Factor, setL02Factor] = useState(savedSettings?.l02Factor || 2);
  const [l03Factor, setL03Factor] = useState(savedSettings?.l03Factor || 1);
  const [isSimulating, setIsSimulating] = useState(false);
  const [progress, setProgress] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch campaigns
  const { data: campaigns } = useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("id, code, title")
        .order("title");
      if (error) throw error;
      return data;
    },
  });

  // Fetch EOAs for selected campaign
  const { data: eoas, isLoading: eoasLoading } = useQuery({
    queryKey: ["eoas", selectedCampaignId],
    queryFn: async () => {
      if (!selectedCampaignId) return [];
      const { data, error } = await supabase
        .from("events_actions")
        .select("id, title, city, state, zip_code, assigned_deck_slug")
        .eq("campaign_id", selectedCampaignId)
        .order("title");
      if (error) throw error;
      return data as EoA[];
    },
    enabled: !!selectedCampaignId,
  });

  // Save settings to localStorage whenever they change
  const saveSettings = () => {
    try {
      localStorage.setItem('simulator-settings', JSON.stringify({
        selectedEoaIds: Array.from(selectedEoaIds),
        l00Count,
        l01Factor,
        l02Factor,
        l03Factor,
      }));
    } catch (e) {
      console.error('Failed to save simulator settings:', e);
    }
  };

  const toggleEoaSelection = (eoaId: string) => {
    const newSelection = new Set(selectedEoaIds);
    if (newSelection.has(eoaId)) {
      newSelection.delete(eoaId);
    } else {
      newSelection.add(eoaId);
    }
    setSelectedEoaIds(newSelection);
    // Save after state update
    setTimeout(() => saveSettings(), 0);
  };

  const selectAllEoas = () => {
    if (!eoas) return;
    setSelectedEoaIds(new Set(eoas.map(e => e.id)));
    setTimeout(() => saveSettings(), 0);
  };

  const deselectAllEoas = () => {
    setSelectedEoaIds(new Set());
    setTimeout(() => saveSettings(), 0);
  };

  const stopSimulation = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      toast({
        title: "Simulation stopped",
        description: "The simulation has been aborted.",
      });
    }
  };

  const clearSimulationData = async () => {
    try {
      // Delete all events first (due to foreign key constraints)
      const { error: eventsError } = await supabase
        .from('url_events')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
      
      if (eventsError) throw eventsError;

      // Delete all tokens
      const { error: tokensError } = await supabase
        .from('tokens')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
      
      if (tokensError) throw tokensError;

      // Reset all simulation settings to defaults
      setSelectedEoaIds(new Set());
      setL00Count(10);
      setL01Factor(3);
      setL02Factor(2);
      setL03Factor(1);
      
      // Clear saved settings
      localStorage.removeItem('simulator-settings');

      toast({
        title: "Data cleared",
        description: "All simulation data has been deleted and settings reset.",
      });
    } catch (error) {
      console.error("Error clearing data:", error);
      toast({
        title: "Error",
        description: "Failed to clear simulation data.",
        variant: "destructive",
      });
    }
  };

  const runSimulation = async () => {
    if (selectedEoaIds.size === 0) {
      toast({
        title: "No EOAs selected",
        description: "Please select at least one event/action to simulate.",
        variant: "destructive",
      });
      return;
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();
    setIsSimulating(true);
    setProgress(0);

    const selectedEoas = eoas?.filter(e => selectedEoaIds.has(e.id)) || [];
    const totalSteps = selectedEoas.length;
    let completedSteps = 0;

    try {
      for (const eoa of selectedEoas) {
        // Check if aborted
        if (abortControllerRef.current.signal.aborted) {
          throw new Error("Simulation aborted");
        }

        // Validate EOA has required data
        if (!eoa.zip_code || !eoa.assigned_deck_slug) {
          console.warn(`Skipping ${eoa.title}: missing zip_code or assigned_deck_slug`);
          completedSteps++;
          setProgress((completedSteps / totalSteps) * 100);
          continue;
        }

        const simulationBaseTime = new Date(Date.now() - SIMULATION_START_OFFSET_MS);
        const simulatedEventSequences = [0, 0, 0, 0];

        const { error: startDateError } = await supabase
          .from('events_actions')
          .update({ start_date: simulationBaseTime.toISOString() })
          .eq('id', eoa.id);

        if (startDateError) throw startDateError;

        // Get L00 base location
        const l00Location = await getL00Location(eoa.zip_code, eoa.city || undefined, eoa.state || undefined);
        if (!l00Location) {
          console.warn(`Skipping ${eoa.title}: zip_code ${eoa.zip_code} not in simulator cities`);
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
          .single();

        let l00Token: string;
        
        if (existingL00) {
          // Use existing L00 token and mark as simulated
          l00Token = existingL00.token;
          await supabase.from('tokens').update({ is_simulated: true }).eq('token', l00Token);
          console.log(`Using existing L00 token for ${eoa.title}: ${l00Token}`);
        } else {
          // Mint new L00 token and mark as simulated
          const result = await mintL00({
            eoaId: eoa.id,
            deckSlug: eoa.assigned_deck_slug,
            utmMedium: "qr",
          });
          l00Token = result.token;
          
          // Mark the token as simulated
          await supabase
            .from('tokens')
            .update({ is_simulated: true })
            .eq('token', l00Token);
          
          console.log(`Minted new simulated L00 token for ${eoa.title}: ${l00Token}`);
        }

        const l00EventToken = await instantiateSimulatedL00Token(l00Token);

        // Mint L00 shares (simulate multiple people scanning the same QR code)
        for (let i = 0; i < l00Count; i++) {
          // Check if aborted
          if (abortControllerRef.current.signal.aborted) {
            throw new Error("Simulation aborted");
          }

          // Log L00 scan event with location
          await logEventWithLocation(l00EventToken, "scan", l00Location, getSimulationTimestamp(simulationBaseTime, 0, simulatedEventSequences[0]++));

            // Mint L01 tokens
            for (let j = 0; j < l01Factor; j++) {
              const l01Location = await getLocationForLevel(1, l00Location);
              const l01Medium = getSimulatedShareMedium(j);
              const { token: l01Token } = await mintShare({
                parentToken: l00EventToken,
                utmMedium: l01Medium,
              });
              
              // Mark as simulated
              await supabase.from('tokens').update({ is_simulated: true }).eq('token', l01Token);
              await logEventWithLocation(l01Token, "share", l01Location, getSimulationTimestamp(simulationBaseTime, 1, simulatedEventSequences[1]++));

              // Mint L02 tokens
              for (let k = 0; k < l02Factor; k++) {
                const l02Location = await getLocationForLevel(2, l01Location);
                const l02Medium = getSimulatedShareMedium(k, l01Medium);
                const { token: l02Token } = await mintShare({
                  parentToken: l01Token,
                  utmMedium: l02Medium,
                });
                
                // Mark as simulated
                await supabase.from('tokens').update({ is_simulated: true }).eq('token', l02Token);
                await logEventWithLocation(l02Token, "share", l02Location, getSimulationTimestamp(simulationBaseTime, 2, simulatedEventSequences[2]++));

                // Mint L03 tokens
                for (let m = 0; m < l03Factor; m++) {
                  const l03Location = await getLocationForLevel(3, l02Location);
                  const l03Medium = getSimulatedShareMedium(m);
                  const { token: l03Token } = await mintShare({
                    parentToken: l02Token,
                    utmMedium: l03Medium,
                  });
                  
                  // Mark as simulated
                  await supabase.from('tokens').update({ is_simulated: true }).eq('token', l03Token);
                  await logEventWithLocation(l03Token, "share", l03Location, getSimulationTimestamp(simulationBaseTime, 3, simulatedEventSequences[3]++));
                }
              }
            }
        }

        completedSteps++;
        setProgress((completedSteps / totalSteps) * 100);
      }

      toast({
        title: "Simulation complete",
        description: `Generated tokens and events for ${selectedEoas.length} EOAs`,
      });
    } catch (error: any) {
      console.error("Simulation error:", error);
      if (error.message === "Simulation aborted") {
        // Don't show error toast for user-initiated abort
        return;
      }
      toast({
        title: "Simulation failed",
        description: error.message || "An error occurred during simulation",
        variant: "destructive",
      });
    } finally {
      setIsSimulating(false);
      setProgress(0);
      abortControllerRef.current = null;
    }
  };

  const totalTokensPerEoa = l00Count * (1 + l01Factor + l01Factor * l02Factor + l01Factor * l02Factor * l03Factor);

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-4xl font-bold mb-2">Viral Token Simulator</h1>
          <p className="text-muted-foreground">
            Generate synthetic viral tokens and events with realistic location data
          </p>
        </div>

        {/* Campaign Selection */}
        <Card>
          <CardHeader>
            <CardTitle>1. Select Campaign</CardTitle>
            <CardDescription>Choose the campaign to simulate</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a campaign" />
              </SelectTrigger>
              <SelectContent>
                {campaigns?.map((campaign) => (
                  <SelectItem key={campaign.id} value={campaign.id}>
                    {campaign.title} ({campaign.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* EOA Selection */}
        {selectedCampaignId && (
          <Card>
            <CardHeader>
              <CardTitle>2. Select Events/Actions</CardTitle>
              <CardDescription>Choose which EOAs to simulate (uses EOA zip codes for L00 locations)</CardDescription>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={selectAllEoas}>
                  Select All
                </Button>
                <Button variant="outline" size="sm" onClick={deselectAllEoas}>
                  Deselect All
                </Button>
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
                      <Checkbox
                        checked={selectedEoaIds.has(eoa.id)}
                        onCheckedChange={() => toggleEoaSelection(eoa.id)}
                      />
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
        )}

        {/* Simulation Parameters */}
        {selectedCampaignId && (
          <Card>
            <CardHeader>
              <CardTitle>3. Configure Simulation</CardTitle>
              <CardDescription>
                Set branching factors (each EOA will generate ~{totalTokensPerEoa} tokens)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border bg-muted/50 p-3 text-sm text-muted-foreground">
                Simulated shares use map-visible real channels: Text/SMS triangles and Email squares. Each selected EoA starts 10 days ago, then each share generation advances 12 hours.
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="l00-count">L00 Tokens per EOA</Label>
                  <Input
                    id="l00-count"
                    type="number"
                    min={1}
                    max={100}
                    value={l00Count}
                    onChange={(e) => {
                      setL00Count(parseInt(e.target.value) || 1);
                      setTimeout(() => saveSettings(), 0);
                    }}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Base location from EOA zip code
                  </p>
                </div>
                <div>
                  <Label htmlFor="l01-factor">L01 per L00</Label>
                  <Input
                    id="l01-factor"
                    type="number"
                    min={0}
                    max={10}
                    value={l01Factor}
                    onChange={(e) => {
                      setL01Factor(parseInt(e.target.value) || 0);
                      setTimeout(() => saveSettings(), 0);
                    }}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    ±3-5 miles from L00
                  </p>
                </div>
                <div>
                  <Label htmlFor="l02-factor">L02 per L01</Label>
                  <Input
                    id="l02-factor"
                    type="number"
                    min={0}
                    max={10}
                    value={l02Factor}
                    onChange={(e) => {
                      setL02Factor(parseInt(e.target.value) || 0);
                      setTimeout(() => saveSettings(), 0);
                    }}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    ±15-20 miles from L01
                  </p>
                </div>
                <div>
                  <Label htmlFor="l03-factor">L03 per L02</Label>
                  <Input
                    id="l03-factor"
                    type="number"
                    min={0}
                    max={10}
                    value={l03Factor}
                    onChange={(e) => {
                      setL03Factor(parseInt(e.target.value) || 0);
                      setTimeout(() => saveSettings(), 0);
                    }}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    ±50-70 miles from L02
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Run Simulation */}
        {selectedCampaignId && (
          <Card>
            <CardHeader>
              <CardTitle>4. Run Simulation</CardTitle>
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
                  <p className="text-sm text-muted-foreground text-center">
                    Simulating... {Math.round(progress)}%
                  </p>
                </div>
              )}

              <Button
                onClick={runSimulation}
                disabled={isSimulating || selectedEoaIds.size === 0}
                className="w-full"
                size="lg"
              >
                {isSimulating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Simulating...
                  </>
                ) : (
                  "Run Simulation"
                )}
              </Button>

              {isSimulating && (
                <Button
                  onClick={stopSimulation}
                  variant="destructive"
                  className="w-full"
                  size="lg"
                >
                  <StopCircle className="mr-2 h-4 w-4" />
                  Stop Simulation
                </Button>
              )}

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full"
                    size="lg"
                    disabled={isSimulating}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear All Data
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear all simulation data?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete all tokens and events from the database. This action cannot be undone.
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
        )}
      </div>
    </div>
  );
}
