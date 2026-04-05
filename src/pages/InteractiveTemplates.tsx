import React, { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Star, Image as ImageIcon, Info, Eye, FolderKanban, MousePointerClick, BarChart3, ExternalLink, Layers, ChevronsUpDown, LayoutGrid } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FullResolutionHotspotEditor, generateAndUploadThumbnail } from "@/components/FullResolutionHotspotEditor";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TemplateType, Hotspot } from "@/types/viralTemplates";
import { detectOverlaps, detectOutOfBounds } from "@/lib/hotspotValidation";
import { DataTemplateDialog } from "@/components/DataTemplateDialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAllTemplateDecks, useAllTemplateCampaignCounts } from "@/hooks/useTemplateDecks";
import type { Json } from "@/integrations/supabase/types";

interface Template {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string;
  thumbnail_url?: string | null;
  hotspots: any[];
  is_default: boolean;
  created_at: string;
  template_type?: TemplateType;
  config?: any;
}

const displaySlug = (slug: string) => slug.replace(/-\d{10,}$/, '');

const isValidInteractiveTemplate = (template: Template): boolean => {
  if (!template.image_url) return false;
  if (template.template_type === 'display_only') return true;
  if (template.template_type === 'stats_page') return true;
  if (template.template_type === 'hybrid') return true;
  if (!template.hotspots || template.hotspots.length === 0) return false;
  const hasValidHotspots = template.hotspots.every((hotspot: any) => {
    return (
      typeof hotspot.x === 'number' &&
      typeof hotspot.y === 'number' &&
      hotspot.type
    );
  });
  return hasValidHotspots;
};

const isActionTemplate = (template: Template): boolean => {
  return template.template_type === 'interactive_share' || template.template_type === 'display_only' || !template.template_type;
};

const isDataTemplate = (template: Template): boolean => {
  return template.template_type === 'stats_page';
};

const isHybridTemplate = (template: Template): boolean => {
  return template.template_type === 'hybrid';
};

export default function InteractiveTemplates() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [showingHotspots, setShowingHotspots] = useState<string | null>(null);
  const [viewingCampaigns, setViewingCampaigns] = useState<string | null>(null);
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"all" | "action" | "data" | "hybrid">("all");
  
  // Data template dialog state
  const [isDataDialogOpen, setIsDataDialogOpen] = useState(false);
  const [dataDialogMode, setDataDialogMode] = useState<"create" | "edit">("create");
  const [editingDataTemplate, setEditingDataTemplate] = useState<Template | null>(null);
  // Hybrid upgrade state
  const [hybridSourceTemplate, setHybridSourceTemplate] = useState<Template | null>(null);

  // Delete confirmation dialog state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTargetTemplate, setDeleteTargetTemplate] = useState<Template | null>(null);
  const [deleteLinkedDecks, setDeleteLinkedDecks] = useState<string[]>([]);
  const [deleteCheckLoading, setDeleteCheckLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    image_url: "",
    thumbnail_url: "" as string | undefined,
    hotspots: [] as any[],
    is_default: false,
    template_type: "interactive_share" as TemplateType,
    config: {},
  });

  // Unsaved changes guard
  const [formSnapshot, setFormSnapshot] = useState<string>("");
  const [pendingCloseAction, setPendingCloseAction] = useState<null | "action" | "data">(null);

  const isActionFormDirty = (): boolean => {
    if (!editingTemplate && !isCreateOpen) return false;
    return JSON.stringify(formData) !== formSnapshot;
  };

  const handleActionDialogClose = (open: boolean) => {
    if (!open && isActionFormDirty()) {
      setPendingCloseAction("action");
      return;
    }
    if (!open) {
      setIsCreateOpen(false);
      setEditingTemplate(null);
      resetForm();
    }
  };

  const confirmDiscardAction = () => {
    setPendingCloseAction(null);
    setIsCreateOpen(false);
    setEditingTemplate(null);
    resetForm();
  };

  // Data dialog unsaved guard
  const dataDialogDirtyRef = useRef(false);
  const handleDataDialogClose = (open: boolean) => {
    if (!open && dataDialogDirtyRef.current) {
      setPendingCloseAction("data");
      return;
    }
    setIsDataDialogOpen(open);
    if (!open) {
      setEditingDataTemplate(null);
      setHybridSourceTemplate(null);
      dataDialogDirtyRef.current = false;
    }
  };

  const confirmDiscardData = () => {
    setPendingCloseAction(null);
    dataDialogDirtyRef.current = false;
    setIsDataDialogOpen(false);
    setEditingDataTemplate(null);
    setHybridSourceTemplate(null);
  };

  // Pre-delete linkage check
  const handleDeleteClick = useCallback(async (template: Template) => {
    setDeleteTargetTemplate(template);
    setDeleteCheckLoading(true);
    setDeleteConfirmOpen(true);
    setDeleteLinkedDecks([]);

    try {
      const { data: linkedSlides, error } = await supabase
        .from("slide_items")
        .select("deck_slug")
        .eq("template_id", template.id);

      if (error) throw error;

      const uniqueDecks = [...new Set((linkedSlides || []).map(s => s.deck_slug))];
      setDeleteLinkedDecks(uniqueDecks);
    } catch (e) {
      console.error("Failed to check template linkage:", e);
      setDeleteLinkedDecks([]);
    } finally {
      setDeleteCheckLoading(false);
    }
  }, []);

  const { data: templates, isLoading } = useQuery({
    queryKey: ["interactive-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("viral_slide_configs")
        .select("*")
        .is("slide_id", null)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      // Sort: Hybrid first, then Data, then Action
      const sorted = (data as Template[]).sort((a, b) => {
        const aIsHybrid = a.template_type === 'hybrid';
        const bIsHybrid = b.template_type === 'hybrid';
        const aIsData = a.template_type === 'stats_page';
        const bIsData = b.template_type === 'stats_page';
        if (aIsHybrid && !bIsHybrid) return -1;
        if (!aIsHybrid && bIsHybrid) return 1;
        if (aIsData && !bIsData) return -1;
        if (!aIsData && bIsData) return 1;
        return 0;
      });
      
      return sorted;
    },
  });

  const { data: templateCampaigns } = useQuery({
    queryKey: ["template-campaigns", viewingCampaigns],
    enabled: !!viewingCampaigns,
    queryFn: async () => {
      if (!viewingCampaigns) return [];
      
      // Step 1: Find slide_items using this template
      const { data: slideItems, error: slideError } = await supabase
        .from("slide_items")
        .select("deck_slug")
        .eq("template_id", viewingCampaigns);
      
      if (slideError) throw slideError;
      if (!slideItems || slideItems.length === 0) return [];
      
      const deckSlugs = [...new Set(slideItems.map(item => item.deck_slug))];
      
      // Step 2: Find campaigns via events_actions.assigned_deck_slug
      const { data: eventsActions, error: eaError } = await supabase
        .from("events_actions")
        .select("campaign_id")
        .in("assigned_deck_slug", deckSlugs);
      
      if (eaError) throw eaError;
      if (!eventsActions || eventsActions.length === 0) return [];
      
      const campaignIds = [...new Set(eventsActions.map(ea => ea.campaign_id))];
      
      // Step 4: Get campaign details
      const { data: campaigns, error: campaignError } = await supabase
        .from("campaigns")
        .select("id, code, title, description")
        .in("id", campaignIds)
        .order("title");
      
      if (campaignError) throw campaignError;
      return campaigns || [];
    },
  });

  // Batch hooks for card indicators
  const templateIds = templates?.map(t => t.id) || [];
  const { data: templateDecksMap } = useAllTemplateDecks(templateIds);
  const { data: campaignCountsMap } = useAllTemplateCampaignCounts(templateIds);

  // Deck popover state
  const [deckPopoverOpen, setDeckPopoverOpen] = useState<string | null>(null);

  // Filter templates based on active tab
  const actionTemplates = templates?.filter(isActionTemplate) || [];
  const dataTemplates = templates?.filter(isDataTemplate) || [];
  const hybridTemplates = templates?.filter(isHybridTemplate) || [];

  const createTemplate = useMutation({
    mutationFn: async (data: typeof formData) => {
      // If setting as default, clear all other defaults first
      if (data.is_default) {
        const { error: clearError } = await supabase
          .from("viral_slide_configs")
          .update({ is_default: false })
          .eq("is_default", true);
        
        if (clearError) throw clearError;
      }

      const { error } = await supabase
        .from("viral_slide_configs")
        .insert({
          name: data.name,
          slug: data.slug,
          description: data.description,
          image_url: data.image_url,
          thumbnail_url: data.thumbnail_url,
          hotspots: data.hotspots,
          is_default: data.is_default,
          template_type: data.template_type,
          config: data.config,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["interactive-templates"] });
      setIsCreateOpen(false);
      resetForm();
      toast({
        title: "Success",
        description: "Template created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to create template: ${error.message}`,
      });
    },
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      // If setting as default, clear all other defaults first
      if (data.is_default) {
        const { error: clearError } = await supabase
          .from("viral_slide_configs")
          .update({ is_default: false })
          .neq("id", id)
          .eq("is_default", true);
        
        if (clearError) throw clearError;
      }

      const { error } = await supabase
        .from("viral_slide_configs")
        .update(data)
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["interactive-templates"] });
      setEditingTemplate(null);
      setEditingDataTemplate(null);
      resetForm();
      toast({
        title: "Success",
        description: "Template saved successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to update template: ${error.message}`,
      });
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("viral_slide_configs")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["interactive-templates"] });
      toast({
        title: "Success",
        description: "Template deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to delete template: ${error.message}`,
      });
    },
  });

  const handleImageUpload = async (file: File) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `interactive-templates/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('slides')
      .upload(filePath, file);

    if (uploadError) {
      toast({
        variant: "destructive",
        title: "Upload Error",
        description: uploadError.message,
      });
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('slides')
      .getPublicUrl(filePath);

    setFormData(prev => ({ ...prev, image_url: publicUrl }));
  };

  const resetForm = () => {
    setFormData({
      name: "",
      slug: "",
      description: "",
      image_url: "",
      thumbnail_url: undefined,
      hotspots: [],
      is_default: false,
      template_type: "interactive_share",
      config: {},
    });
  };

  const handleEdit = (template: Template) => {
    // Check if it's a data or hybrid template - use data dialog
    if (isDataTemplate(template) || isHybridTemplate(template)) {
      setEditingDataTemplate(template);
      setDataDialogMode("edit");
      setHybridSourceTemplate(null);
      dataDialogDirtyRef.current = true;
      setIsDataDialogOpen(true);
      return;
    }
    
    // Action template - use existing dialog
    const newFormData = {
      name: template.name,
      slug: template.slug,
      description: template.description || "",
      image_url: template.image_url,
      thumbnail_url: template.thumbnail_url || undefined,
      hotspots: template.hotspots,
      is_default: template.is_default,
      template_type: template.template_type || "interactive_share" as TemplateType,
      config: template.config || {},
    };
    setEditingTemplate(template);
    setFormData(newFormData);
    setFormSnapshot(JSON.stringify(newFormData));
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.slug || !formData.image_url) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Name, slug, and image are required",
      });
      return;
    }

    // Validate interactive templates have hotspots
    if (formData.template_type === "interactive_share" && (!formData.hotspots || formData.hotspots.length === 0)) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Interactive templates must have at least one hotspot",
      });
      return;
    }

    // CRITICAL: Block save if hotspots overlap
    if (formData.template_type === "interactive_share" && formData.hotspots.length > 0) {
      const overlaps = detectOverlaps(formData.hotspots);
      if (overlaps.size > 0) {
        const overlappingIds = Array.from(overlaps.keys());
        const overlappingHotspots = formData.hotspots.filter(h => overlappingIds.includes(h.id));
        const hotspotNames = overlappingHotspots.map(h => h.label).join(', ');
        
        toast({
          variant: "destructive",
          title: "Cannot Save - Hotspots Overlap",
          description: `${overlaps.size} hotspot${overlaps.size > 1 ? 's are' : ' is'} overlapping: ${hotspotNames}. Please reposition them so they don't touch.`,
          duration: 6000,
        });
        return;
      }
      
      // CRITICAL: Block save if hotspots are out of bounds
      const outOfBoundsIds = detectOutOfBounds(formData.hotspots);
      if (outOfBoundsIds.length > 0) {
        const outOfBoundsHotspots = formData.hotspots.filter(h => outOfBoundsIds.includes(h.id));
        const hotspotNames = outOfBoundsHotspots.map(h => h.label).join(', ');
        
        toast({
          variant: "destructive",
          title: "Cannot Save - Hotspots Out of Bounds",
          description: `${outOfBoundsIds.length} hotspot${outOfBoundsIds.length > 1 ? 's extend' : ' extends'} beyond the image boundaries: ${hotspotNames}. Please resize or reposition them to fit within the image.`,
          duration: 6000,
        });
        return;
      }
    }

    // Generate thumbnail for interactive templates with hotspots
    let thumbnailUrl = formData.thumbnail_url;
    if (formData.template_type === "interactive_share" && formData.hotspots.length > 0) {
      try {
        setIsGeneratingThumbnail(true);
        toast({
          title: "Generating thumbnail...",
          description: "Creating preview with hotspot icons",
        });
        thumbnailUrl = await generateAndUploadThumbnail(
          formData.image_url,
          formData.hotspots,
          formData.slug,
          () => {} // No selection to clear when creating from form
        );
      } catch (error: any) {
        console.error("Thumbnail generation failed:", error);
        toast({
          variant: "destructive",
          title: "Thumbnail generation failed",
          description: error.message || "Proceeding without thumbnail",
        });
        // Continue without thumbnail - not critical
      } finally {
        setIsGeneratingThumbnail(false);
      }
    }

    // CRITICAL: Display-only templates should never have a thumbnail_url
    const dataToSave = { 
      ...formData, 
      thumbnail_url: formData.template_type === 'display_only' ? null : thumbnailUrl 
    };

    if (editingTemplate) {
      updateTemplate.mutate({ id: editingTemplate.id, data: dataToSave });
    } else {
      createTemplate.mutate(dataToSave);
    }
  };
  // Track created template ID to avoid duplicate inserts during async state updates
  const createdDataTemplateIdRef = useRef<string | null>(null);
  
  // Reset the ref when dialog closes
  useEffect(() => {
    if (!isDataDialogOpen) {
      createdDataTemplateIdRef.current = null;
    }
  }, [isDataDialogOpen]);
  
  // Handle Data Template save
  const handleDataTemplateSave = async (data: {
    hotspots: Hotspot[];
    imageUrl: string;
    name: string;
    slug: string;
    description?: string;
  }): Promise<string | void> => {
    // Clear dirty flag on save
    dataDialogDirtyRef.current = false;
    // Determine the template type to save: hybrid if upgrading, else stats_page
    const saveType: TemplateType = hybridSourceTemplate ? "hybrid" : 
      (editingDataTemplate?.template_type === "hybrid" ? "hybrid" : "stats_page");
    const saveConfig = hybridSourceTemplate 
      ? { type: "hybrid", sourceActionTemplateId: hybridSourceTemplate.id }
      : (editingDataTemplate?.template_type === "hybrid" 
        ? (editingDataTemplate.config || { type: "hybrid" })
        : { type: "stats_page" });

    // Check if we're editing an existing template OR if we've already created one in this session
    const existingId = editingDataTemplate?.id || createdDataTemplateIdRef.current;
    
    if (existingId) {
      // Update existing template - exclude slug to avoid unique constraint violation
      const updateData = {
        name: data.name,
        description: data.description || "",
        image_url: data.imageUrl,
        thumbnail_url: undefined,
        hotspots: data.hotspots,
        is_default: false,
        template_type: saveType,
        config: saveConfig,
      };
      await updateTemplate.mutateAsync({ id: existingId, data: updateData });
      return existingId;
    } else {
      // Create new template - but first check if one with the same name already exists
      const { data: existingByName } = await supabase
        .from("viral_slide_configs")
        .select("id")
        .eq("name", data.name)
        .eq("template_type", saveType)
        .maybeSingle();
      
      if (existingByName) {
        const updateData = {
          name: data.name,
          description: data.description || "",
          image_url: data.imageUrl,
          hotspots: data.hotspots,
          is_default: false,
          template_type: saveType,
          config: saveConfig,
        };
        await updateTemplate.mutateAsync({ id: existingByName.id, data: updateData });
        createdDataTemplateIdRef.current = existingByName.id;
        return existingByName.id;
      }

      // Strip any existing timestamp suffixes before appending a fresh one
      const baseSlug = data.slug.replace(/-\d{10,}(-\d{10,})?$/g, '');
      const uniqueSlug = `${baseSlug}-${Date.now()}`;
      
      const { data: inserted, error } = await supabase
        .from("viral_slide_configs")
        .insert([{
          name: data.name,
          slug: uniqueSlug,
          description: data.description || "",
          image_url: data.imageUrl,
          hotspots: data.hotspots as unknown as Json,
          is_default: false,
          template_type: saveType,
          config: saveConfig as Json,
        }])
        .select("id")
        .single();
      
      if (error) throw error;
      
      if (inserted) {
        createdDataTemplateIdRef.current = inserted.id;
      }
      
      queryClient.invalidateQueries({ queryKey: ["interactive-templates"] });
      
      if (inserted) {
        const templateData = {
          name: data.name,
          slug: data.slug,
          description: data.description || "",
          image_url: data.imageUrl,
          hotspots: data.hotspots,
          is_default: false,
          template_type: saveType,
          config: saveConfig,
        };
        setEditingDataTemplate({ 
          ...templateData, 
          id: inserted.id, 
          created_at: new Date().toISOString() 
        } as Template);
        return inserted.id;
      }
    }
  };

  // Render a template card
  const renderTemplateCard = (template: Template) => {
    const isAction = isActionTemplate(template);
    const isData = isDataTemplate(template);
    const isHybrid = isHybridTemplate(template);
    const templateType = template.template_type || 'interactive_share';
    
    // Color scheme based on template type
    const badgeClasses = isHybrid
      ? "bg-purple-100 text-purple-800 border-purple-300"
      : isAction 
        ? "bg-blue-100 text-blue-800 border-blue-300" 
        : "bg-green-100 text-green-800 border-green-300";
    const borderClasses = isHybrid
      ? "border-l-4 border-l-purple-500"
      : isAction 
        ? "border-l-4 border-l-blue-500" 
        : "border-l-4 border-l-green-500";
    const typeLabel = isHybrid
      ? 'Hybrid'
      : isAction 
        ? (templateType === 'interactive_share' ? 'Interactive' : 'Display Only')
        : 'Data';
    const TypeIcon = isHybrid ? Layers : isAction ? MousePointerClick : BarChart3;
    const accentColor = isHybrid ? "purple" : isAction ? "blue" : "green";
    
    return (
      <Card 
        key={template.id} 
        className={`relative cursor-pointer hover:ring-2 hover:ring-primary/40 transition-shadow ${borderClasses} ${
          !isValidInteractiveTemplate(template) 
            ? 'bg-red-50 dark:bg-red-950/30' 
            : ''
        }`}
        onClick={() => handleEdit(template)}
      >
        {!isValidInteractiveTemplate(template) ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toast({
                      variant: "destructive",
                      title: "Invalid Interactive Slide",
                      description: "This template has no hotspots configured. Edit it and add at least one hotspot to make it functional.",
                    });
                  }}
                  className="absolute top-3 right-3 z-10 bg-red-500 text-white rounded-full p-1.5 shadow-lg hover:bg-red-600 transition-colors"
                >
                  <Info className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                Click to see why this template is invalid
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowingHotspots(showingHotspots === template.id ? null : template.id);
                  }}
                  className={`absolute top-3 right-3 z-10 text-white rounded-full p-1.5 shadow-lg transition-colors ${
                    isHybrid ? 'bg-purple-600 hover:bg-purple-700' : isAction ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  <Eye className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {showingHotspots === template.id ? "Hide" : "Show"} hotspot locations
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2">
                {template.name}
                {template.is_default && (
                  <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                )}
              </CardTitle>
              <CardDescription className="mt-1 flex items-center gap-2">
                {displaySlug(template.slug)}
                <Badge className={`${badgeClasses} border`}>
                  <TypeIcon className="h-3 w-3 mr-1" />
                  {typeLabel}
                </Badge>
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="aspect-[9/16] w-full max-w-[200px] mx-auto mb-4 relative">
            <img
              src={template.thumbnail_url || template.image_url}
              alt={template.name}
              className="w-full h-full object-contain rounded-lg bg-muted"
            />
            {template.thumbnail_url && (
              <Badge className="absolute bottom-2 right-2 bg-primary/80 text-xs">
                With Icons
              </Badge>
            )}
            {showingHotspots === template.id && template.hotspots.map((hotspot: any, idx: number) => {
              const ACTION_TYPES = new Set(["sms", "email", "social", "external_link"]);
              const isActionHotspot = ACTION_TYPES.has(hotspot.type);
              const hotspotColor = isActionHotspot ? 'blue' : 'green';
              return (
                <div
                  key={idx}
                  className={`absolute border-2 pointer-events-none border-${hotspotColor}-400 bg-${hotspotColor}-400/20`}
                  style={{
                    left: `${hotspot.x}%`,
                    top: `${hotspot.y}%`,
                    width: `${hotspot.width}%`,
                    height: `${hotspot.height}%`,
                  }}
                />
              );
            })}
          </div>
          <div className="text-sm text-muted-foreground mb-3 text-center font-medium">
            {isHybrid ? (
              <>
                {template.hotspots.filter((h: any) => ["sms","email","social","external_link"].includes(h.type)).length} action + {template.hotspots.filter((h: any) => !["sms","email","social","external_link"].includes(h.type)).length} data hotspots
              </>
            ) : (
              <>{template.hotspots.length} hotspot{template.hotspots.length !== 1 ? 's' : ''}</>
            )}
          </div>
          {template.description && (
            <p className="text-sm text-muted-foreground mb-4">
              {template.description}
            </p>
          )}
          <div className="flex gap-2 justify-center flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => { e.stopPropagation(); setViewingCampaigns(template.id); }}
            >
              <FolderKanban className="h-4 w-4 mr-2" />
              Campaigns ({campaignCountsMap?.[template.id] ?? 0})
            </Button>
            <Popover open={deckPopoverOpen === template.id} onOpenChange={(open) => setDeckPopoverOpen(open ? template.id : null)}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); }}
                >
                  <LayoutGrid className="h-4 w-4 mr-2" />
                  Decks ({templateDecksMap?.[template.id]?.length ?? 0})
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72" onClick={(e) => e.stopPropagation()}>
                <div className="space-y-1">
                  <p className="text-sm font-medium mb-2">Decks using this template</p>
                  {(!templateDecksMap?.[template.id] || templateDecksMap[template.id].length === 0) ? (
                    <p className="text-sm text-muted-foreground">Not used in any decks</p>
                  ) : (
                    templateDecksMap[template.id].map((deck) => (
                      <a
                        key={deck.slug}
                        href={`/deck-editor/${deck.slug}`}
                        className="flex items-center justify-between text-sm py-1.5 px-2 rounded hover:bg-muted transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="font-mono text-xs truncate">{displaySlug(deck.slug)}</span>
                        <Badge variant="secondary" className="ml-2 text-xs shrink-0">
                          {deck.eoaCount} EoA{deck.eoaCount !== 1 ? 's' : ''}
                        </Badge>
                      </a>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleEdit(template)}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
            {(isData || isHybrid) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`/template-editor/${template.id}`, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                New Tab
              </Button>
            )}
            {isAction && template.template_type === 'interactive_share' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setHybridSourceTemplate(template);
                  setEditingDataTemplate(null);
                   setDataDialogMode("create");
                   dataDialogDirtyRef.current = true;
                   setIsDataDialogOpen(true);
                }}
                className="border-purple-400 text-purple-600 hover:bg-purple-50"
              >
                <Layers className="h-4 w-4 mr-2" />
                Add Data Layer
              </Button>
            )}
            <Button
              variant="destructive"
              size="sm"
              onClick={() => handleDeleteClick(template)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Interactive Template Repository</h1>
          <p className="text-muted-foreground mt-2">
            Create reusable templates for interactive slides. Changes to templates cascade to all decks using them.
          </p>
        </div>
        
        {/* Dual Entry Buttons */}
        <div className="flex gap-3">
          <Dialog open={isCreateOpen || !!editingTemplate} onOpenChange={handleActionDialogClose}>
            <DialogTrigger asChild>
              <Button 
                onClick={() => {
                  resetForm();
                  const newForm = { ...formData, name: "", slug: "", description: "", image_url: "", thumbnail_url: undefined, hotspots: [] as any[], is_default: false, template_type: "interactive_share" as TemplateType, config: {} };
                  setFormData(newForm);
                  setFormSnapshot(JSON.stringify(newForm));
                  setIsCreateOpen(true);
                }}
                className="bg-blue-600 hover:bg-blue-700 gap-2"
              >
                <MousePointerClick className="h-4 w-4" />
                + New Action Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-blue-600 flex items-center justify-center">
                    <MousePointerClick className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <DialogTitle>{editingTemplate ? "Edit Action Template" : "Create Action Template"}</DialogTitle>
                    <DialogDescription>
                      {editingTemplate 
                        ? "Update this template. Changes will apply to all decks using it."
                        : "Create a reusable interactive slide template with navigation/share hotspots."
                      }
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              
              <div className="space-y-4">
                <div>
                  <Label>Template Type</Label>
                  <RadioGroup
                    value={formData.template_type}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, template_type: value as TemplateType }))}
                    className="flex gap-4 mt-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="interactive_share" id="interactive_share" />
                      <Label htmlFor="interactive_share" className="cursor-pointer">
                        Interactive Share
                        <p className="text-xs text-muted-foreground">With viral hotspots (L01-L03)</p>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="display_only" id="display_only" />
                      <Label htmlFor="display_only" className="cursor-pointer">
                        Display Only
                        <p className="text-xs text-muted-foreground">No interactivity</p>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div>
                  <Label htmlFor="name">Template Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Spread the Word - Blue Theme"
                  />
                </div>

                <div>
                  <Label htmlFor="slug">Slug (unique identifier)</Label>
                  <Input
                    id="slug"
                    value={formData.slug}
                    onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
                    placeholder="e.g., spread-word-blue"
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe this template..."
                  />
                </div>

                <Collapsible>
                  <CollapsibleTrigger className="flex items-center justify-between w-full py-1">
                    <Label htmlFor="image" className="cursor-pointer">
                      {formData.image_url ? "Replace Template Image, preserve hotspots" : "Template Image"}
                    </Label>
                    <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2 space-y-2">
                    {formData.image_url && (
                      <div className="p-3 border rounded-lg bg-muted">
                        <p className="text-sm text-muted-foreground mb-2">Current image:</p>
                        <div className="aspect-[9/16] w-full max-w-[160px] mx-auto">
                          <img src={formData.image_url} alt="Current template" className="w-full h-full object-contain rounded" />
                        </div>
                      </div>
                    )}
                    <div>
                      <Label htmlFor="image-upload" className="text-sm font-medium">Upload Image File</Label>
                      <Input
                        id="image-upload"
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageUpload(file);
                        }}
                      />
                    </div>
                    {!formData.image_url && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Upload a portrait/mobile sized image (9:16 aspect ratio recommended)
                      </p>
                    )}
                  </CollapsibleContent>
                </Collapsible>

                {formData.image_url && formData.template_type === 'interactive_share' && (
                  <div>
                    <Label>Configure Hotspots</Label>
                    <div className="border rounded-lg p-4 bg-muted">
                      <FullResolutionHotspotEditor
                        imageUrl={formData.image_url}
                        initialHotspots={formData.hotspots}
                        onSave={(hotspots) => setFormData(prev => ({ ...prev, hotspots }))}
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <Switch
                    id="default"
                    checked={formData.is_default}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_default: checked }))}
                  />
                  <Label htmlFor="default">Set as default template</Label>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => {
                    setIsCreateOpen(false);
                    setEditingTemplate(null);
                    resetForm();
                  }}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleSubmit} 
                    disabled={isGeneratingThumbnail}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {isGeneratingThumbnail 
                      ? "Generating Thumbnail..." 
                      : editingTemplate ? "Update Template" : "Create Template"
                    }
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          
          {/* New Data Template Button */}
          <Button 
            onClick={() => {
              setEditingDataTemplate(null);
              setHybridSourceTemplate(null);
              setDataDialogMode("create");
              dataDialogDirtyRef.current = true;
              setIsDataDialogOpen(true);
            }}
            className="bg-green-600 hover:bg-green-700 gap-2"
          >
            <BarChart3 className="h-4 w-4" />
            + New Data Template
          </Button>
        </div>
      </div>

      {/* Data Template Dialog */}
      <DataTemplateDialog
        open={isDataDialogOpen}
        onOpenChange={handleDataDialogClose}
        onSave={handleDataTemplateSave}
        mode={dataDialogMode}
        isHybrid={!!hybridSourceTemplate || editingDataTemplate?.template_type === 'hybrid'}
        lockedHotspots={hybridSourceTemplate?.hotspots}
        initialData={editingDataTemplate ? {
          id: editingDataTemplate.id,
          hotspots: editingDataTemplate.hotspots,
          imageUrl: editingDataTemplate.image_url,
          name: editingDataTemplate.name,
          slug: editingDataTemplate.slug,
          description: editingDataTemplate.description || undefined,
        } : hybridSourceTemplate ? {
          hotspots: [],
          imageUrl: hybridSourceTemplate.image_url,
          name: `${hybridSourceTemplate.name} + Data`,
          slug: `${hybridSourceTemplate.slug}-hybrid`,
          description: hybridSourceTemplate.description || undefined,
        } : undefined}
      />

      {/* Unsaved Changes Confirmation */}
      <AlertDialog open={!!pendingCloseAction} onOpenChange={(open) => { if (!open) setPendingCloseAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes to this template. Are you sure you want to discard them?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingCloseAction(null)}>Keep Editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingCloseAction === "data" ? confirmDiscardData() : confirmDiscardAction()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Discard Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Filter Tabs and Template Grid */}
      <Tabs value={activeFilter} onValueChange={(val) => setActiveFilter(val as "all" | "action" | "data" | "hybrid")} className="mt-6">
        <TabsList className="mb-6">
          <TabsTrigger value="all">All Templates</TabsTrigger>
          <TabsTrigger value="action" className="data-[state=active]:text-blue-600 data-[state=active]:border-b-blue-600">
            <MousePointerClick className="h-4 w-4 mr-1" />
            Action ({actionTemplates.length})
          </TabsTrigger>
          <TabsTrigger value="data" className="data-[state=active]:text-green-600 data-[state=active]:border-b-green-600">
            <BarChart3 className="h-4 w-4 mr-1" />
            Data ({dataTemplates.length})
          </TabsTrigger>
          <TabsTrigger value="hybrid" className="data-[state=active]:text-purple-600 data-[state=active]:border-b-purple-600">
            <Layers className="h-4 w-4 mr-1" />
            Hybrid ({hybridTemplates.length})
          </TabsTrigger>
        </TabsList>

        {isLoading ? (
          <div className="text-center py-8">Loading templates...</div>
        ) : !templates || templates.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ImageIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No templates yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first template using the buttons above
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <TabsContent value="all" className="space-y-8">
              {/* Data Templates Section - Displayed First */}
              {dataTemplates.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-6 w-1 bg-green-500 rounded-full" />
                    <h2 className="text-lg font-semibold text-green-900 dark:text-green-100">
                      DATA TEMPLATES
                    </h2>
                    <Badge variant="outline" className="ml-2 text-green-600 border-green-300">
                      {dataTemplates.length}
                    </Badge>
                  </div>
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {dataTemplates.map(renderTemplateCard)}
                  </div>
                </div>
              )}

              {/* Action Templates Section */}
              {actionTemplates.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-6 w-1 bg-blue-500 rounded-full" />
                    <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                      ACTION TEMPLATES
                    </h2>
                    <Badge variant="outline" className="ml-2 text-blue-600 border-blue-300">
                      {actionTemplates.length}
                    </Badge>
                  </div>
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {actionTemplates.map(renderTemplateCard)}
                  </div>
                </div>
              )}

              {/* Hybrid Templates Section */}
              {hybridTemplates.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-6 w-1 bg-purple-500 rounded-full" />
                    <h2 className="text-lg font-semibold text-purple-900 dark:text-purple-100">
                      HYBRID TEMPLATES
                    </h2>
                    <Badge variant="outline" className="ml-2 text-purple-600 border-purple-300">
                      {hybridTemplates.length}
                    </Badge>
                  </div>
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {hybridTemplates.map(renderTemplateCard)}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="action">
              {actionTemplates.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <MousePointerClick className="h-12 w-12 mx-auto mb-4 text-blue-400" />
                    <h3 className="text-lg font-semibold mb-2">No Action Templates</h3>
                    <p className="text-muted-foreground mb-4">
                      Create your first action template for navigation and sharing
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {actionTemplates.map(renderTemplateCard)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="data">
              {dataTemplates.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <BarChart3 className="h-12 w-12 mx-auto mb-4 text-green-400" />
                    <h3 className="text-lg font-semibold mb-2">No Data Templates</h3>
                    <p className="text-muted-foreground mb-4">
                      Create your first data template for live campaign metrics
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {dataTemplates.map(renderTemplateCard)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="hybrid">
              {hybridTemplates.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Layers className="h-12 w-12 mx-auto mb-4 text-purple-400" />
                    <h3 className="text-lg font-semibold mb-2">No Hybrid Templates</h3>
                    <p className="text-muted-foreground mb-4">
                      Promote an action template to hybrid by clicking "Add Data Layer"
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {hybridTemplates.map(renderTemplateCard)}
                </div>
              )}
            </TabsContent>
          </>
        )}
      </Tabs>

      {/* Campaign Usage Dialog */}
      <Dialog open={!!viewingCampaigns} onOpenChange={(open) => !open && setViewingCampaigns(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Campaigns using: {templates?.find(t => t.id === viewingCampaigns)?.name || 'Template'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {!templateCampaigns ? (
              <div className="text-center py-8 text-muted-foreground">Loading campaigns...</div>
            ) : templateCampaigns.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-muted-foreground">Not currently used in any campaigns</p>
              </div>
            ) : (
              <div className="space-y-2">
                {templateCampaigns.map((campaign: any) => (
                  <Card
                    key={campaign.id}
                    className="cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => window.open(`/campaign/${campaign.id}`, '_blank')}
                  >
                    <CardHeader className="py-3">
                      <CardTitle className="text-base">{campaign.title}</CardTitle>
                      <CardDescription className="text-sm">
                        Code: {campaign.code}
                        {campaign.description && ` • ${campaign.description}`}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template: {deleteTargetTemplate?.name}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                {deleteCheckLoading ? (
                  <p>Checking for linked slides…</p>
                ) : deleteLinkedDecks.length > 0 ? (
                  <div className="space-y-2">
                    <p className="font-semibold text-destructive">
                      ⚠️ This template is used by {deleteLinkedDecks.length} deck{deleteLinkedDecks.length > 1 ? 's' : ''}. Deleting it will break those slides.
                    </p>
                    <ul className="list-disc pl-5 text-sm">
                      {deleteLinkedDecks.map(slug => (
                        <li key={slug}>{slug}</li>
                      ))}
                    </ul>
                    <p className="text-sm">The affected slides will show a "data is null" error until re-linked to a new template.</p>
                  </div>
                ) : (
                  <p>No decks are currently using this template. Safe to delete.</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteCheckLoading}
              onClick={() => {
                if (deleteTargetTemplate) {
                  deleteTemplate.mutate(deleteTargetTemplate.id);
                }
                setDeleteConfirmOpen(false);
                setDeleteTargetTemplate(null);
              }}
            >
              {deleteLinkedDecks.length > 0 ? "Delete Anyway" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
