import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, ArrowLeft, Pencil, GripVertical, Eye } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Link, useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
interface Campaign {
  id: string;
  code: string;
  title: string;
  description: string | null;
  created_at: string;
}
interface EventAction {
  id: string;
  campaign_id: string;
  type: string;
  start_date: string | null;
  end_date: string | null;
  mobilize_code: string | null;
  assigned_deck_slug: string | null;
}
interface CampaignStats {
  totalEvents: number;
  totalActions: number;
  activeEvents: number;
  activeActions: number;
  earliestActive: string | null;
  latestActive: string | null;
  totalEventsActions: number;
  // New stats
  realDataRows: number;
  simDataRows: number;
  l0Count: number;
  l1Count: number;
  l2Count: number;
  l3PlusCount: number;
  chaptersCount: number;
}

interface DeploymentState {
  ready: boolean;
  hasExistingTokens: boolean;
  readyEoas: number;
  totalEoas: number;
  lastDeployed: string | null;
  deckSlugs: string[];
}
const codeSchema = z.string().min(1, "Code is required").regex(/^[a-z0-9_-]+$/, "Code must contain only lowercase letters, numbers, hyphens, and underscores");
export default function CampaignManager() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [eoas, setEoas] = useState<EventAction[]>([]);
  const [campaignStats, setCampaignStats] = useState<Map<string, CampaignStats>>(new Map());
  const [deploymentStates, setDeploymentStates] = useState<Map<string, DeploymentState>>(new Map());
  const [loading, setLoading] = useState(true);
  const {
    userRole
  } = useAuth();
  const {
    toast
  } = useToast();

  // Campaign form state
  const [campaignForm, setCampaignForm] = useState({
    code: "",
    title: "",
    description: ""
  });
  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [codeError, setCodeError] = useState<string>("");
  const [campaignToDelete, setCampaignToDelete] = useState<Campaign | null>(null);
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
  const [showStatsMap, setShowStatsMap] = useState<Map<string, boolean>>(new Map());
  
  // Initialize showStatsMap to true for all campaigns when campaigns load
  useEffect(() => {
    if (campaigns.length > 0) {
      setShowStatsMap(prev => {
        const next = new Map(prev);
        for (const campaign of campaigns) {
          // Only set to true if not already in the map (preserve user preferences)
          if (!next.has(campaign.id)) {
            next.set(campaign.id, true);
          }
        }
        return next;
      });
    }
  }, [campaigns]);
  
  useEffect(() => {
    fetchData();
  }, []);
  useEffect(() => {
    if (campaigns.length > 0 || eoas.length > 0) {
      calculateCampaignStats();
      calculateDeploymentStates();
    }
  }, [campaigns, eoas]);
  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchCampaigns(), fetchEoas()]);
    setLoading(false);
  };
  const fetchCampaigns = async () => {
    const {
      data,
      error
    } = await supabase.from("campaigns").select("*").order("display_order", {
      ascending: true
    });
    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch campaigns: " + error.message
      });
    } else {
      setCampaigns(data || []);
    }
  };
  const fetchEoas = async () => {
    const {
      data,
      error
    } = await supabase.from("events_actions").select("id, campaign_id, type, start_date, end_date, mobilize_code, assigned_deck_slug").order("created_at", {
      ascending: false
    });
    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch events/actions: " + error.message
      });
    } else {
      setEoas(data || []);
    }
  };
  const calculateCampaignStats = async () => {
    const stats = new Map<string, CampaignStats>();
    const now = new Date();
    
    // Calculate EoA-based stats locally (fast, in-memory)
    const campaignEoaStats = new Map<string, {
      totalEvents: number;
      totalActions: number;
      activeEvents: number;
      activeActions: number;
      chaptersCount: number;
      totalEventsActions: number;
    }>();
    
    for (const campaign of campaigns) {
      const campaignEoas = eoas.filter(e => e.campaign_id === campaign.id);
      const totalEvents = campaignEoas.filter(e => e.type === "event").length;
      const totalActions = campaignEoas.filter(e => e.type === "action").length;
      
      const activeEoas = campaignEoas.filter(eoa => {
        if (!eoa.end_date) return true;
        const endDate = new Date(eoa.end_date);
        const cutoffDate = new Date(endDate);
        cutoffDate.setDate(cutoffDate.getDate() + 14);
        return now <= cutoffDate;
      });
      const activeEvents = activeEoas.filter(e => e.type === "event").length;
      const activeActions = activeEoas.filter(e => e.type === "action").length;
      
      const uniqueMobilizeCodes = new Set(
        campaignEoas.map(e => e.mobilize_code).filter(Boolean)
      );
      
      campaignEoaStats.set(campaign.id, {
        totalEvents,
        totalActions,
        activeEvents,
        activeActions,
        chaptersCount: uniqueMobilizeCodes.size,
        totalEventsActions: campaignEoas.length
      });
    }
    
    // Fetch database stats in ONE RPC call for all campaigns
    const campaignCodes = campaigns.map(c => c.code);
    let dbStats: Record<string, {
      earliest_active: string | null;
      latest_active: string | null;
      real_data_rows: number;
      sim_data_rows: number;
      l0_count: number;
      l1_count: number;
      l2_count: number;
      l3_plus_count: number;
    }> = {};
    
    if (campaignCodes.length > 0) {
      const { data, error } = await supabase.rpc("get_campaign_stats", {
        campaign_codes: campaignCodes
      });
      
      if (!error && data) {
        for (const row of data) {
          dbStats[row.campaign_code] = {
            earliest_active: row.earliest_active,
            latest_active: row.latest_active,
            real_data_rows: Number(row.real_data_rows) || 0,
            sim_data_rows: Number(row.sim_data_rows) || 0,
            l0_count: Number(row.l0_count) || 0,
            l1_count: Number(row.l1_count) || 0,
            l2_count: Number(row.l2_count) || 0,
            l3_plus_count: Number(row.l3_plus_count) || 0
          };
        }
      }
    }
    
    // Merge stats
    for (const campaign of campaigns) {
      const eoaStats = campaignEoaStats.get(campaign.id);
      const db = dbStats[campaign.code] || {
        earliest_active: null,
        latest_active: null,
        real_data_rows: 0,
        sim_data_rows: 0,
        l0_count: 0,
        l1_count: 0,
        l2_count: 0,
        l3_plus_count: 0
      };
      
      stats.set(campaign.id, {
        totalEvents: eoaStats?.totalEvents || 0,
        totalActions: eoaStats?.totalActions || 0,
        activeEvents: eoaStats?.activeEvents || 0,
        activeActions: eoaStats?.activeActions || 0,
        earliestActive: db.earliest_active,
        latestActive: db.latest_active,
        totalEventsActions: eoaStats?.totalEventsActions || 0,
        realDataRows: db.real_data_rows,
        simDataRows: db.sim_data_rows,
        l0Count: db.l0_count,
        l1Count: db.l1_count,
        l2Count: db.l2_count,
        l3PlusCount: db.l3_plus_count,
        chaptersCount: eoaStats?.chaptersCount || 0
      });
    }
    setCampaignStats(stats);
  };

  // Calculate deployment states for all campaigns in one batch
  const calculateDeploymentStates = async () => {
    const states = new Map<string, DeploymentState>();
    
    // Group EoAs by campaign and compute local stats
    const campaignEoaMap = new Map<string, EventAction[]>();
    for (const campaign of campaigns) {
      campaignEoaMap.set(campaign.id, eoas.filter(e => e.campaign_id === campaign.id));
    }
    
    // Collect all EoA IDs that are "ready" (have mobilize_code and deck)
    const allReadyEoaIds: string[] = [];
    for (const [campaignId, campaignEoas] of campaignEoaMap) {
      const readyEoas = campaignEoas.filter(e => e.mobilize_code && e.assigned_deck_slug);
      allReadyEoaIds.push(...readyEoas.map(e => e.id));
    }
    
    // Batch fetch latest L00 token per EoA in ONE query
    let tokensByEoaId = new Map<string, string>(); // eoa_id -> minted_at
    if (allReadyEoaIds.length > 0) {
      const { data: tokens, error } = await supabase
        .from("tokens")
        .select("eoa_id, minted_at")
        .eq("level", 0)
        .in("eoa_id", allReadyEoaIds);
      
      if (!error && tokens) {
        for (const token of tokens) {
          // Keep the latest minted_at per eoa_id
          const existing = tokensByEoaId.get(token.eoa_id);
          if (!existing || token.minted_at > existing) {
            tokensByEoaId.set(token.eoa_id, token.minted_at);
          }
        }
      }
    }
    
    // Build deployment state for each campaign
    for (const [campaignId, campaignEoas] of campaignEoaMap) {
      const readyEoas = campaignEoas.filter(e => e.mobilize_code && e.assigned_deck_slug);
      const allReady = readyEoas.length > 0 && readyEoas.length === campaignEoas.length;
      
      // Get unique deck slugs
      const deckSlugs = [...new Set(
        campaignEoas
          .map(e => e.assigned_deck_slug)
          .filter((slug): slug is string => slug !== null)
      )];
      
      // Find latest deployed token for this campaign
      let lastDeployed: string | null = null;
      for (const eoa of campaignEoas) {
        const mintedAt = tokensByEoaId.get(eoa.id);
        if (mintedAt && (!lastDeployed || mintedAt > lastDeployed)) {
          lastDeployed = mintedAt;
        }
      }
      
      const hasExistingTokens = campaignEoas.some(e => tokensByEoaId.has(e.id));
      
      states.set(campaignId, {
        ready: allReady,
        hasExistingTokens,
        readyEoas: readyEoas.length,
        totalEoas: campaignEoas.length,
        lastDeployed,
        deckSlugs
      });
    }
    
    setDeploymentStates(states);
  };

  const createCampaign = async () => {
    if (!campaignForm.code || !campaignForm.title) {
      toast({
        variant: "destructive",
        title: "Missing fields",
        description: "Code and title are required"
      });
      return;
    }
    const codeValidation = codeSchema.safeParse(campaignForm.code);
    if (!codeValidation.success) {
      toast({
        variant: "destructive",
        title: "Invalid code",
        description: codeValidation.error.errors[0].message
      });
      return;
    }
    const {
      error
    } = await supabase.from("campaigns").insert([campaignForm]);
    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create campaign: " + error.message
      });
    } else {
      toast({
        title: "Success",
        description: "Campaign created successfully"
      });
      setCampaignForm({
        code: "",
        title: "",
        description: ""
      });
      setCampaignDialogOpen(false);
      fetchCampaigns();
      fetchEoas();
    }
  };
  const updateCampaign = async () => {
    if (!editingCampaign) return;
    if (!campaignForm.code || !campaignForm.title) {
      toast({
        variant: "destructive",
        title: "Missing fields",
        description: "Code and title are required"
      });
      return;
    }
    const codeValidation = codeSchema.safeParse(campaignForm.code);
    if (!codeValidation.success) {
      toast({
        variant: "destructive",
        title: "Invalid code",
        description: codeValidation.error.errors[0].message
      });
      return;
    }
    const {
      error
    } = await supabase.from("campaigns").update(campaignForm).eq("id", editingCampaign.id);
    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update campaign: " + error.message
      });
    } else {
      toast({
        title: "Success",
        description: "Campaign updated successfully"
      });
      setCampaignForm({
        code: "",
        title: "",
        description: ""
      });
      setEditingCampaign(null);
      setCampaignDialogOpen(false);
      fetchCampaigns();
      fetchEoas();
    }
  };
  const handleEditCampaign = (campaign: Campaign) => {
    setEditingCampaign(campaign);
    setCampaignForm({
      code: campaign.code,
      title: campaign.title,
      description: campaign.description || ""
    });
    setCampaignDialogOpen(true);
  };
  const handleDialogClose = (open: boolean) => {
    setCampaignDialogOpen(open);
    if (!open) {
      setEditingCampaign(null);
      setCampaignForm({
        code: "",
        title: "",
        description: ""
      });
      setCodeError("");
    }
  };
  const handleCodeChange = (value: string) => {
    setCampaignForm({
      ...campaignForm,
      code: value
    });
    const validation = codeSchema.safeParse(value);
    if (!validation.success && value) {
      setCodeError(validation.error.errors[0].message);
    } else {
      setCodeError("");
    }
  };
  const handleDeleteClick = (campaign: Campaign) => {
    setCampaignToDelete(campaign);
    setDeleteStep(1);
  };
  const handleFirstConfirm = () => {
    setDeleteStep(2);
  };
  const handleSecondConfirm = async () => {
    if (!campaignToDelete) return;
    const {
      error
    } = await supabase.from("campaigns").delete().eq("id", campaignToDelete.id);
    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete campaign: " + error.message
      });
    } else {
      toast({
        title: "Success",
        description: "Campaign deleted"
      });
      fetchCampaigns();
      fetchEoas();
    }
    setCampaignToDelete(null);
    setDeleteStep(1);
  };
  const handleDeleteCancel = () => {
    setCampaignToDelete(null);
    setDeleteStep(1);
  };
  
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) {
      return;
    }
    
    const oldIndex = campaigns.findIndex((c) => c.id === active.id);
    const newIndex = campaigns.findIndex((c) => c.id === over.id);
    
    const reorderedCampaigns = arrayMove(campaigns, oldIndex, newIndex);
    setCampaigns(reorderedCampaigns);
    
    // Update display_order in database
    const updates = reorderedCampaigns.map((campaign, index) => ({
      id: campaign.id,
      display_order: index
    }));
    
    for (const update of updates) {
      await supabase
        .from('campaigns')
        .update({ display_order: update.display_order })
        .eq('id', update.id);
    }
  };
  const formatDate = (date: string | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };
  
  const formatDateWithTime = (date: string | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZoneName: "short"
    });
  };
  
  interface SortableCardProps {
    campaign: Campaign;
    stats: CampaignStats | undefined;
    showStats: boolean;
    onToggleStats: (checked: boolean) => void;
    deploymentState: DeploymentState;
    onRefreshDeployment: () => void;
  }
  
  const SortableCard = ({ campaign, stats, showStats, onToggleStats, deploymentState, onRefreshDeployment }: SortableCardProps) => {
    const [deckDialogOpen, setDeckDialogOpen] = useState(false);
    const [deckSlides, setDeckSlides] = useState<any[]>([]);
    const [loadingDeck, setLoadingDeck] = useState(false);
    const [selectedDeckSlug, setSelectedDeckSlug] = useState<string | null>(null);
    const [deploying, setDeploying] = useState(false);

    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: campaign.id });

    const handleDeploy = async (e: React.MouseEvent) => {
      e.stopPropagation();
      setDeploying(true);

      try {
        // Get all EoAs for campaign
        const { data: eoas } = await supabase
          .from("events_actions")
          .select("*")
          .eq("campaign_id", campaign.id)
          .not("mobilize_code", "is", null)
          .not("assigned_deck_slug", "is", null);

        if (!eoas || eoas.length === 0) {
          toast({
            variant: "destructive",
            title: "No EoAs to Deploy",
            description: "No events/actions found with required fields"
          });
          return;
        }

        let successCount = 0;
        let errorCount = 0;

        // Bulk mint all L00 tokens
        for (const eoa of eoas) {
          try {
            // Import mintL00 function
            const { mintL00 } = await import("@/lib/virality/mint");
            await mintL00(
              {
                eoaId: eoa.id,
                deckSlug: eoa.assigned_deck_slug!,
                utmMedium: "qr"
              },
              { lazy: false }
            );
            successCount++;
          } catch (error) {
            console.error(`Failed to mint L00 for ${eoa.title}:`, error);
            errorCount++;
          }
        }

        // Show appropriate toast based on deployment state
        if (deploymentState.hasExistingTokens) {
          toast({
            title: "Campaign Updated Successfully",
            description: "All existing QR codes and links will continue to work. They now point to your updated decks/content.",
            duration: 6000,
          });
        } else {
          toast({
            title: "Campaign Deployed",
            description: `Successfully minted ${successCount} L00 tokens`,
          });
        }

        if (errorCount > 0) {
          toast({
            variant: "destructive",
            title: "Partial Deployment",
            description: `${errorCount} tokens failed to generate`,
          });
        }

        // Refresh deployment state via parent
        onRefreshDeployment();
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Deployment Failed",
          description: error.message,
        });
      } finally {
        setDeploying(false);
      }
    };
    
    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };

    // Use deckSlugs from deploymentState prop
    const deckSlugs = deploymentState.deckSlugs;

    const handleViewDeck = async (e: React.MouseEvent, slug?: string) => {
      e.stopPropagation();
      const targetSlug = slug || deckSlugs[0];
      
      if (!targetSlug) {
        toast({
          variant: "destructive",
          title: "No deck assigned",
          description: "This campaign doesn't have an assigned deck yet."
        });
        return;
      }

      setSelectedDeckSlug(targetSlug);
      setDeckDialogOpen(true);
      setLoadingDeck(true);

      try {
        // Fetch slides for the deck
        const { data: slidesData, error: slidesError } = await supabase
          .from("slide_items")
          .select("*")
          .eq("deck_slug", targetSlug)
          .order("position", { ascending: true });

        if (slidesError) throw slidesError;

        setDeckSlides(slidesData || []);
      } catch (error) {
        console.error("Error loading deck:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load deck"
        });
      } finally {
        setLoadingDeck(false);
      }
    };
    
    return (
      <>
        <Card 
          ref={setNodeRef} 
          style={style}
          className="cursor-pointer hover:shadow-lg transition-shadow" 
          onClick={() => navigate(`/campaign/${campaign.id}`)}
        >
          <CardHeader>
            <div className="flex justify-between items-start">
              <div 
                className="cursor-grab active:cursor-grabbing mr-2 touch-none" 
                {...attributes} 
                {...listeners}
                onClick={(e) => e.stopPropagation()}
              >
                <GripVertical className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <CardTitle>{campaign.title}</CardTitle>
                <CardDescription>utm_campaign: {campaign.code}</CardDescription>
              </div>
              <div className="flex gap-1 items-center">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div 
                        className="flex items-center justify-center h-8 w-8"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox 
                          checked={showStats} 
                          onCheckedChange={onToggleStats}
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Display stats</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <Button variant="ghost" size="sm" onClick={e => {
                  e.stopPropagation();
                  handleEditCampaign(campaign);
                }}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={e => {
                  e.stopPropagation();
                  handleDeleteClick(campaign);
                }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {campaign.description && <p className="text-sm text-muted-foreground mt-2">
              {campaign.description}
            </p>}
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm">
              <div className="flex flex-wrap justify-between gap-x-4 gap-y-2">
                <div>
                  <p className="text-sm text-muted-foreground">Data Rows: Real / Sim</p>
                  <p className="font-semibold text-lg">
                    {showStats 
                      ? `${(stats?.realDataRows || 0).toLocaleString()} / ${(stats?.simDataRows || 0).toLocaleString()}`
                      : "-nm-"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Viral Depth: L0 / L1 / L2 / L3+</p>
                  <p className="font-semibold text-lg">
                    {showStats 
                      ? `${(stats?.l0Count || 0).toLocaleString()} / ${(stats?.l1Count || 0).toLocaleString()} / ${(stats?.l2Count || 0).toLocaleString()} / ${(stats?.l3PlusCount || 0).toLocaleString()}`
                      : "-nm-"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground"># Chapters</p>
                  <p className="font-semibold text-lg">
                    {showStats 
                      ? (stats?.chaptersCount || 0).toLocaleString()
                      : "-nm-"}
                  </p>
                </div>
              </div>
              <div className="flex justify-between gap-4">
                <div>
                  <p className="text-muted-foreground">Earliest Active</p>
                  <p className="font-medium">{showStats ? formatDateWithTime(stats?.earliestActive || null) : "-nm-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Latest Active</p>
                  <p className="font-medium">{showStats ? formatDateWithTime(stats?.latestActive || null) : "-nm-"}</p>
                </div>
              </div>
              <div className="space-y-2">
                {deckSlugs.length === 0 ? (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    disabled
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    No Deck Assigned
                  </Button>
                ) : deckSlugs.length === 1 ? (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={handleViewDeck}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    View {deckSlugs[0]}
                  </Button>
                ) : (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full"
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        View {deckSlugs.length} Slide Decks
                        <ChevronDown className="ml-2 h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56">
                      {deckSlugs.map((slug) => (
                        <DropdownMenuItem 
                          key={slug} 
                          onClick={(e) => handleViewDeck(e as unknown as React.MouseEvent, slug)}
                        >
                          {slug}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                
                {deploymentState.ready ? (
                  deploymentState.lastDeployed ? (
                    <div className="text-sm text-muted-foreground text-center py-2">
                      Status: Deployed {new Date(deploymentState.lastDeployed).toLocaleString('en-US', {
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric', 
                        hour: 'numeric', 
                        minute: '2-digit',
                        hour12: true 
                      })}
                    </div>
                  ) : (
                    <Button
                      variant="default"
                      size="sm"
                      className="w-full"
                      onClick={handleDeploy}
                      disabled={deploying}
                    >
                      {deploying ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Deploying...
                        </>
                      ) : (
                        "Status: Ready to Deploy"
                      )}
                    </Button>
                  )
                ) : (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            disabled
                          >
                            Status: Not Ready to Deploy
                          </Button>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{deploymentState.readyEoas} of {deploymentState.totalEoas} EoAs ready</p>
                        <p className="text-xs">Missing Mobilize Code or Deck</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Dialog open={deckDialogOpen} onOpenChange={setDeckDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Deck Thumbnail View</DialogTitle>
              <DialogDescription>
                {selectedDeckSlug ? `Deck: ${selectedDeckSlug}` : "Loading deck..."}
              </DialogDescription>
            </DialogHeader>
            {loadingDeck ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : deckSlides.length === 0 ? (
              <div className="text-center p-8 text-muted-foreground">
                No slides found in this deck
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4">
                {deckSlides.map((slide, index) => (
                  <div key={slide.id} className="relative group">
                    <div className="aspect-video bg-muted rounded-lg overflow-hidden border">
                      <img
                        src={slide.content_url}
                        alt={`Slide ${index + 1}`}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="absolute bottom-2 right-2 bg-background/80 backdrop-blur-sm px-2 py-0.5 rounded text-xs">
                      {index + 1}
                    </div>
                    {slide.type === "spread-word" && (
                      <div className="absolute top-2 left-2 bg-primary/90 text-primary-foreground px-2 py-0.5 rounded text-xs font-medium">
                        Interactive
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {selectedDeckSlug && !loadingDeck && (
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" asChild>
                  <Link to={`/deck/${selectedDeckSlug}`} target="_blank">
                    Open Full Deck
                  </Link>
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </>
    );
  };
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>;
  }
  return <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold">Campaign Orchestration</h1>
              <p className="text-muted-foreground">
                Manage campaigns, events, and actions
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-4">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Campaigns</h2>
            <Dialog open={campaignDialogOpen} onOpenChange={handleDialogClose}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    New Campaign
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingCampaign ? "Edit Campaign" : "Create Campaign"}</DialogTitle>
                    <DialogDescription>
                      {editingCampaign ? "Update the campaign details." : "Add a new campaign to organize your events and actions."}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Title *</Label>
                      <Input value={campaignForm.title} onChange={e => setCampaignForm({
                      ...campaignForm,
                      title: e.target.value
                    })} placeholder="e.g., 'No Kings Nationwide Protests', 'Citizens Bank Events and Actions'" />
                    </div>
                    <div>
                      <Label>Code *</Label>
                      <Input value={campaignForm.code} onChange={e => handleCodeChange(e.target.value)} placeholder="e.g. 'no-kings', 'citizens-bank'" className={codeError ? "border-destructive" : ""} />
                      {codeError && <p className="text-sm text-destructive mt-1">{codeError}</p>}
                      <p className="text-xs text-muted-foreground mt-1">
                        Only lowercase a-z, 0-9, "-", "_"
                      </p>
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Textarea value={campaignForm.description} onChange={e => setCampaignForm({
                      ...campaignForm,
                      description: e.target.value
                    })} placeholder="Optional description..." />
                    </div>
                    <Button onClick={editingCampaign ? updateCampaign : createCampaign} className="w-full">
                      {editingCampaign ? "Update Campaign" : "Create Campaign"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <DndContext 
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext 
                items={campaigns.map(c => c.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {campaigns.map(campaign => {
                    const stats = campaignStats.get(campaign.id);
                    const depState = deploymentStates.get(campaign.id) || {
                      ready: false,
                      hasExistingTokens: false,
                      readyEoas: 0,
                      totalEoas: 0,
                      lastDeployed: null,
                      deckSlugs: []
                    };
                    return (
                      <SortableCard 
                        key={campaign.id} 
                        campaign={campaign} 
                        stats={stats}
                        showStats={showStatsMap.get(campaign.id) ?? false}
                        onToggleStats={(checked) => {
                          setShowStatsMap(prev => {
                            const next = new Map(prev);
                            next.set(campaign.id, checked);
                            return next;
                          });
                        }}
                        deploymentState={depState}
                        onRefreshDeployment={calculateDeploymentStates}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        </main>

      <AlertDialog open={campaignToDelete !== null && deleteStep === 1}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
            <AlertDialogDescription>
              Deleting a campaign will remove {campaignStats.get(campaignToDelete?.id || "")?.totalEventsActions || 0} events. Do you want to delete "{campaignToDelete?.title}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDeleteCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleFirstConfirm}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={campaignToDelete !== null && deleteStep === 2} onOpenChange={open => !open && handleDeleteCancel()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Deleting "{campaignToDelete?.title}" is irreversible. Proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDeleteCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSecondConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Campaign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>;
}