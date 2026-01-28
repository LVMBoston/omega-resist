import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Star, Image as ImageIcon, Info, Eye, FolderKanban, MousePointerClick, BarChart3 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FullResolutionHotspotEditor, generateAndUploadThumbnail } from "@/components/FullResolutionHotspotEditor";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TemplateType, Hotspot } from "@/types/viralTemplates";
import { detectOverlaps, detectOutOfBounds } from "@/lib/hotspotValidation";
import { DataTemplateDialog } from "@/components/DataTemplateDialog";
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

const isValidInteractiveTemplate = (template: Template): boolean => {
  if (!template.image_url) return false;
  
  // Display-only templates don't need hotspots
  if (template.template_type === 'display_only') return true;
  
  // Stats page templates just need an image
  if (template.template_type === 'stats_page') return true;
  
  // Interactive templates need hotspots
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

// Determine if a template is Action or Data type
const isActionTemplate = (template: Template): boolean => {
  return template.template_type === 'interactive_share' || template.template_type === 'display_only' || !template.template_type;
};

const isDataTemplate = (template: Template): boolean => {
  return template.template_type === 'stats_page';
};

export default function InteractiveTemplates() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [showingHotspots, setShowingHotspots] = useState<string | null>(null);
  const [viewingCampaigns, setViewingCampaigns] = useState<string | null>(null);
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false);
  const [isPowerPointImporting, setIsPowerPointImporting] = useState(false);
  const [powerPointSlides, setPowerPointSlides] = useState<Array<{index: number, imageData: string, fileName: string}>>([]);
  const [showPowerPointPicker, setShowPowerPointPicker] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"all" | "action" | "data">("all");
  
  // Data template dialog state
  const [isDataDialogOpen, setIsDataDialogOpen] = useState(false);
  const [dataDialogMode, setDataDialogMode] = useState<"create" | "edit">("create");
  const [editingDataTemplate, setEditingDataTemplate] = useState<Template | null>(null);
  
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

  const { data: templates, isLoading } = useQuery({
    queryKey: ["interactive-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("viral_slide_configs")
        .select("*")
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      // Sort Data templates (stats_page) to the top
      const sorted = (data as Template[]).sort((a, b) => {
        const aIsData = a.template_type === 'stats_page';
        const bIsData = b.template_type === 'stats_page';
        if (aIsData && !bIsData) return -1;
        if (!aIsData && bIsData) return 1;
        return 0; // Preserve existing order within groups
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
      
      // Step 2: Find deck_eoa_assignments for these decks
      const { data: assignments, error: assignError } = await supabase
        .from("deck_eoa_assignments")
        .select("eoa_id")
        .in("deck_slug", deckSlugs);
      
      if (assignError) throw assignError;
      if (!assignments || assignments.length === 0) return [];
      
      const eoaIds = [...new Set(assignments.map(a => a.eoa_id))];
      
      // Step 3: Find events_actions for these EOAs
      const { data: eventsActions, error: eaError } = await supabase
        .from("events_actions")
        .select("campaign_id")
        .in("id", eoaIds);
      
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

  // Filter templates based on active tab
  const actionTemplates = templates?.filter(isActionTemplate) || [];
  const dataTemplates = templates?.filter(isDataTemplate) || [];

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
    mutationFn: async ({ id, data, cleanupDuplicates }: { id: string; data: Partial<typeof formData>; cleanupDuplicates?: boolean }) => {
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
      
      // Clean up duplicate templates with the same name (created during interim saves)
      if (cleanupDuplicates && data.name) {
        const { error: cleanupError } = await supabase
          .from("viral_slide_configs")
          .delete()
          .eq("name", data.name)
          .neq("id", id);
        
        if (cleanupError) {
          console.warn("Failed to cleanup duplicate templates:", cleanupError);
          // Non-fatal - don't throw
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["interactive-templates"] });
      setEditingTemplate(null);
      setEditingDataTemplate(null);
      resetForm();
      toast({
        title: "Success",
        description: "Template updated - changes will cascade to all decks using this template",
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

  const handlePowerPointUpload = async (file: File) => {
    setIsPowerPointImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-powerpoint`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (!data.success) throw new Error(data.error);

      setPowerPointSlides(data.slides);
      setShowPowerPointPicker(true);
      toast({
        title: "PowerPoint Imported",
        description: data.message,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Import Failed",
        description: error.message || "Failed to import PowerPoint file",
      });
    } finally {
      setIsPowerPointImporting(false);
    }
  };

  const handleSlideSelection = async (slide: {index: number, imageData: string, fileName: string}) => {
    try {
      // Convert base64 to blob
      const response = await fetch(slide.imageData);
      const blob = await response.blob();
      
      // Upload to storage
      const fileName = `${crypto.randomUUID()}.${slide.fileName.split('.').pop()}`;
      const filePath = `interactive-templates/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('slides')
        .upload(filePath, blob);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('slides')
        .getPublicUrl(filePath);

      // Generate name and slug from original filename
      const baseName = slide.fileName.replace(/\.[^/.]+$/, ""); // Remove extension
      const defaultName = baseName || `Slide ${slide.index + 1}`;
      const defaultSlug = defaultName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

      setFormData(prev => ({ 
        ...prev, 
        image_url: publicUrl,
        name: prev.name || defaultName,
        slug: prev.slug || defaultSlug
      }));
      setShowPowerPointPicker(false);
      setPowerPointSlides([]);
      
      toast({
        title: "Slide Selected",
        description: "Image uploaded successfully",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: error.message || "Failed to upload slide",
      });
    }
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
    // Check if it's a data template - use data dialog
    if (isDataTemplate(template)) {
      setEditingDataTemplate(template);
      setDataDialogMode("edit");
      setIsDataDialogOpen(true);
      return;
    }
    
    // Action template - use existing dialog
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      slug: template.slug,
      description: template.description || "",
      image_url: template.image_url,
      thumbnail_url: template.thumbnail_url || undefined,
      hotspots: template.hotspots,
      is_default: template.is_default,
      template_type: template.template_type || "interactive_share",
      config: template.config || {},
    });
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
    // Check if we're editing an existing template OR if we've already created one in this session
    const existingId = editingDataTemplate?.id || createdDataTemplateIdRef.current;
    
    if (existingId) {
      // Update existing template - exclude slug to avoid unique constraint violation
      // Pass cleanupDuplicates: true to remove older versions with the same name
      const updateData = {
        name: data.name,
        description: data.description || "",
        image_url: data.imageUrl,
        thumbnail_url: undefined,
        hotspots: data.hotspots,
        is_default: false,
        template_type: "stats_page" as TemplateType,
        config: { type: "stats_page" },
      };
      await updateTemplate.mutateAsync({ id: existingId, data: updateData, cleanupDuplicates: true });
      return existingId;
    } else {
      // Create new template - use direct insert to get the ID back
      // Generate a unique slug by appending timestamp to avoid collisions
      const uniqueSlug = `${data.slug}-${Date.now()}`;
      
      const { data: inserted, error } = await supabase
        .from("viral_slide_configs")
        .insert([{
          name: data.name,
          slug: uniqueSlug,
          description: data.description || "",
          image_url: data.imageUrl,
          hotspots: data.hotspots as unknown as Json,
          is_default: false,
          template_type: "stats_page",
          config: { type: "stats_page" } as Json,
        }])
        .select("id")
        .single();
      
      if (error) throw error;
      
      // Store the ID in ref immediately (synchronous) to prevent race conditions
      if (inserted) {
        createdDataTemplateIdRef.current = inserted.id;
      }
      
      // Invalidate queries to refresh the list
      queryClient.invalidateQueries({ queryKey: ["interactive-templates"] });
      
      // Update the editingDataTemplate state (async, but ref already captures it)
      if (inserted) {
        const templateData = {
          name: data.name,
          slug: data.slug,
          description: data.description || "",
          image_url: data.imageUrl,
          hotspots: data.hotspots,
          is_default: false,
          template_type: "stats_page" as TemplateType,
          config: { type: "stats_page" },
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
    const templateType = template.template_type || 'interactive_share';
    
    // Color scheme based on template type
    const badgeClasses = isAction 
      ? "bg-blue-100 text-blue-800 border-blue-300" 
      : "bg-green-100 text-green-800 border-green-300";
    const borderClasses = isAction 
      ? "border-l-4 border-l-blue-500" 
      : "border-l-4 border-l-green-500";
    const typeLabel = isAction 
      ? (templateType === 'interactive_share' ? 'Interactive' : 'Display Only')
      : 'Data';
    const TypeIcon = isAction ? MousePointerClick : BarChart3;
    
    return (
      <Card 
        key={template.id} 
        className={`relative ${borderClasses} ${
          !isValidInteractiveTemplate(template) 
            ? 'bg-red-50 dark:bg-red-950/30' 
            : ''
        }`}
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
                    isAction ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'
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
                {template.slug}
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
            {showingHotspots === template.id && template.hotspots.map((hotspot: any, idx: number) => (
              <div
                key={idx}
                className={`absolute border-2 pointer-events-none ${
                  isAction ? 'border-blue-400 bg-blue-400/20' : 'border-green-400 bg-green-400/20'
                }`}
                style={{
                  left: `${hotspot.x}%`,
                  top: `${hotspot.y}%`,
                  width: `${hotspot.width}%`,
                  height: `${hotspot.height}%`,
                }}
              />
            ))}
          </div>
          <div className="text-sm text-muted-foreground mb-3 text-center font-medium">
            {template.hotspots.length} hotspot{template.hotspots.length !== 1 ? 's' : ''}
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
              onClick={() => setViewingCampaigns(template.id)}
            >
              <FolderKanban className="h-4 w-4 mr-2" />
              Campaigns
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleEdit(template)}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (confirm("Delete this template? This will not affect decks already using it.")) {
                  deleteTemplate.mutate(template.id);
                }
              }}
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
          <Dialog open={isCreateOpen || !!editingTemplate} onOpenChange={(open) => {
            if (!open) {
              setIsCreateOpen(false);
              setEditingTemplate(null);
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button 
                onClick={() => {
                  resetForm();
                  setFormData(prev => ({ ...prev, template_type: "interactive_share" }));
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

                <div>
                  <Label htmlFor="image">
                    {formData.image_url ? "Replace Template Image" : "Template Image"}
                  </Label>
                  {formData.image_url && (
                    <div className="mb-3 p-3 border rounded-lg bg-muted">
                      <p className="text-sm text-muted-foreground mb-2">Current image:</p>
                      <div className="aspect-[9/16] w-full max-w-[160px] mx-auto">
                        <img src={formData.image_url} alt="Current template" className="w-full h-full object-contain rounded" />
                      </div>
                    </div>
                  )}
                  
                  <div className="space-y-2">
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
                    
                    <div>
                      <Label htmlFor="powerpoint-upload" className="text-sm font-medium">
                        Upload PowerPoint File (.pptx)
                      </Label>
                      <Input
                        id="powerpoint-upload"
                        type="file"
                        accept=".pptx"
                        disabled={isPowerPointImporting}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handlePowerPointUpload(file);
                        }}
                      />
                      {isPowerPointImporting && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Extracting slides from PowerPoint...
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {!formData.image_url && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Upload a portrait/mobile sized image (9:16 aspect ratio recommended)
                    </p>
                  )}
                </div>

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
              setDataDialogMode("create");
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
        onOpenChange={(open) => {
          setIsDataDialogOpen(open);
          if (!open) {
            setEditingDataTemplate(null);
          }
        }}
        onSave={handleDataTemplateSave}
        mode={dataDialogMode}
        initialData={editingDataTemplate ? {
          id: editingDataTemplate.id,
          hotspots: editingDataTemplate.hotspots,
          imageUrl: editingDataTemplate.image_url,
          name: editingDataTemplate.name,
          slug: editingDataTemplate.slug,
          description: editingDataTemplate.description || undefined,
        } : undefined}
      />

      {/* PowerPoint Slide Picker Dialog */}
      <Dialog open={showPowerPointPicker} onOpenChange={setShowPowerPointPicker}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Select a Slide</DialogTitle>
            <DialogDescription>
              Choose which slide image to use for your template
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 overflow-y-auto max-h-[60vh] p-4">
            {powerPointSlides.map((slide) => (
              <Card 
                key={slide.index} 
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => handleSlideSelection(slide)}
              >
                <CardContent className="p-4">
                  <div className="aspect-[9/16] w-full mb-2">
                    <img 
                      src={slide.imageData} 
                      alt={`Slide ${slide.index + 1}`} 
                      className="w-full h-full object-contain rounded"
                    />
                  </div>
                  <p className="text-sm text-center font-medium">
                    Image {slide.index + 1}
                  </p>
                  <p className="text-xs text-center text-muted-foreground">
                    {slide.fileName}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Filter Tabs and Template Grid */}
      <Tabs value={activeFilter} onValueChange={(val) => setActiveFilter(val as "all" | "action" | "data")} className="mt-6">
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
          </>
        )}
      </Tabs>

      {/* Campaign Usage Dialog */}
      <Dialog open={!!viewingCampaigns} onOpenChange={(open) => !open && setViewingCampaigns(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Campaigns Using This Template</DialogTitle>
            <DialogDescription>
              {templates?.find(t => t.id === viewingCampaigns)?.name || 'Template'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {!templateCampaigns ? (
              <div className="text-center py-8 text-muted-foreground">Loading campaigns...</div>
            ) : templateCampaigns.length === 0 ? (
              <div className="text-center py-8">
                <FolderKanban className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">This template is not currently used in any campaigns</p>
              </div>
            ) : (
              <div className="space-y-2">
                {templateCampaigns.map((campaign: any) => (
                  <Card key={campaign.id}>
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
    </div>
  );
}
