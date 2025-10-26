import { useState } from "react";
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
import { Plus, Edit, Trash2, Star, Image as ImageIcon, Check, X, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FullResolutionHotspotEditor } from "@/components/FullResolutionHotspotEditor";

interface Template {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string;
  hotspots: any[];
  is_default: boolean;
  created_at: string;
}

const isValidInteractiveTemplate = (template: Template): boolean => {
  if (!template.image_url) return false;
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

export default function InteractiveTemplates() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    image_url: "",
    hotspots: [] as any[],
    is_default: false,
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
      return data as Template[];
    },
  });

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
          hotspots: data.hotspots,
          is_default: data.is_default,
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

  const resetForm = () => {
    setFormData({
      name: "",
      slug: "",
      description: "",
      image_url: "",
      hotspots: [],
      is_default: false,
    });
  };

  const handleEdit = (template: Template) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      slug: template.slug,
      description: template.description || "",
      image_url: template.image_url,
      hotspots: template.hotspots,
      is_default: template.is_default,
    });
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.slug || !formData.image_url) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Name, slug, and image are required",
      });
      return;
    }

    if (editingTemplate) {
      updateTemplate.mutate({ id: editingTemplate.id, data: formData });
    } else {
      createTemplate.mutate(formData);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Interactive Slide Templates</h1>
          <p className="text-muted-foreground mt-2">
            Create reusable templates for interactive slides. Changes to templates cascade to all decks using them.
          </p>
        </div>
        <Dialog open={isCreateOpen || !!editingTemplate} onOpenChange={(open) => {
          if (!open) {
            setIsCreateOpen(false);
            setEditingTemplate(null);
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingTemplate ? "Edit Template" : "Create New Template"}</DialogTitle>
              <DialogDescription>
                {editingTemplate 
                  ? "Update this template. Changes will apply to all decks using it."
                  : "Create a reusable interactive slide template with hotspots."
                }
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
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
                <Input
                  id="image"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file);
                  }}
                />
                {!formData.image_url && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Upload a portrait/mobile sized image (9:16 aspect ratio recommended)
                  </p>
                )}
              </div>

              {formData.image_url && (
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
                <Button onClick={handleSubmit}>
                  {editingTemplate ? "Update Template" : "Create Template"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-8">Loading templates...</div>
      ) : !templates || templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ImageIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No templates yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first interactive slide template to get started
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id} className={`relative ${
              !isValidInteractiveTemplate(template) ? 'bg-red-100 dark:bg-red-950/30' : ''
            }`}>
              {!isValidInteractiveTemplate(template) && (
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
                    <CardDescription className="mt-1">
                      {template.slug}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="aspect-[9/16] w-full max-w-[200px] mx-auto mb-4 relative">
                  <img
                    src={template.image_url}
                    alt={template.name}
                    className="w-full h-full object-contain rounded-lg bg-muted"
                  />
                  {isValidInteractiveTemplate(template) && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="absolute top-2 right-2">
                            <div className="bg-green-500 text-white rounded-full p-1.5 shadow-lg">
                              <Check className="h-4 w-4" />
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          Valid interactive slide with {template.hotspots.length} hotspot(s)
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
                {template.description && (
                  <p className="text-sm text-muted-foreground mb-4">
                    {template.description}
                  </p>
                )}
                {template.hotspots.length > 0 && (
                  <div className="text-sm text-muted-foreground mb-4 p-2 bg-muted rounded">
                    To see the <span className="font-semibold">
                      {Array.from(new Set(template.hotspots.map((h: any) => h.label))).join(' and ')}
                    </span> icons and their placement, edit the slide and scroll to the bottom.
                  </div>
                )}
                <div className="flex gap-2">
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
          ))}
        </div>
      )}
    </div>
  );
}
