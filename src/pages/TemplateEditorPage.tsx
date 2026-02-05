import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DataTemplateEditor } from "@/components/DataTemplateEditor";
import { Hotspot } from "@/types/viralTemplates";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Json } from "@/integrations/supabase/types";

export default function TemplateEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isNewTemplate = id === "new";

  // Fetch existing template if editing
  const { data: template, isLoading } = useQuery({
    queryKey: ["template-detail", id],
    enabled: !isNewTemplate && !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("viral_slide_configs")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: {
      hotspots: Hotspot[];
      imageUrl: string;
      name: string;
      slug: string;
      description?: string;
    }) => {
      if (isNewTemplate) {
        // Create new template
        const { data: inserted, error } = await supabase
          .from("viral_slide_configs")
          .insert({
            name: data.name,
            slug: data.slug,
            description: data.description,
            image_url: data.imageUrl,
            hotspots: data.hotspots as unknown as Json,
            template_type: "stats_page",
          })
          .select("id")
          .single();

        if (error) throw error;
        return inserted.id;
      } else {
        // Update existing template
        const { error } = await supabase
          .from("viral_slide_configs")
          .update({
            name: data.name,
            slug: data.slug,
            description: data.description,
            image_url: data.imageUrl,
            hotspots: data.hotspots as unknown as Json,
          })
          .eq("id", id);

        if (error) throw error;
        return id;
      }
    },
    onSuccess: (returnedId) => {
      queryClient.invalidateQueries({ queryKey: ["interactive-templates"] });
      queryClient.invalidateQueries({ queryKey: ["template-detail", id] });
      toast({
        title: "Saved",
        description: "Template saved successfully",
      });
      
      // If this was a new template, update URL to the new ID
      if (isNewTemplate && returnedId) {
        window.history.replaceState(null, "", `/template-editor/${returnedId}`);
      }
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const handleSave = async (data: {
    hotspots: Hotspot[];
    imageUrl: string;
    name: string;
    slug: string;
    description?: string;
  }): Promise<string | void> => {
    return await saveMutation.mutateAsync(data);
  };

  const handleCancel = () => {
    window.close();
  };

  const handleBack = () => {
    navigate("/interactive-templates");
  };

  if (isLoading && !isNewTemplate) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center gap-4 px-4 py-3 border-b bg-accent">
        <Button variant="ghost" size="sm" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Repository
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-accent-foreground">
            {isNewTemplate ? "Create Data Template" : `Edit: ${template?.name || "Template"}`}
          </h1>
        </div>
      </header>

      {/* Editor */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <DataTemplateEditor
          key={id}
          initialHotspots={(template?.hotspots as unknown as Hotspot[]) || undefined}
          initialImageUrl={template?.image_url}
          templateName={template?.name || ""}
          templateSlug={template?.slug || ""}
          templateDescription={template?.description || ""}
          templateId={isNewTemplate ? undefined : id}
          onSave={handleSave}
          onCancel={handleCancel}
          mode={isNewTemplate ? "create" : "edit"}
        />
      </div>
    </div>
  );
}
