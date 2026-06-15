import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DataTemplateEditor } from "@/components/DataTemplateEditor";
import { EditorErrorBoundary } from "@/components/EditorErrorBoundary";
import { Hotspot } from "@/types/viralTemplates";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import type { Json } from "@/integrations/supabase/types";

export default function TemplateEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isNewTemplate = id === "new";
  // Track the actual saved ID — starts as the URL param for existing templates
  const [savedId, setSavedId] = useState<string | undefined>(isNewTemplate ? undefined : id);

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
      if (savedId) {
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
          .eq("id", savedId);

        if (error) throw error;
        return savedId;
      } else {
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
      }
    },
    onSuccess: (returnedId) => {
      queryClient.invalidateQueries({ queryKey: ["interactive-templates"] });
      queryClient.invalidateQueries({ queryKey: ["template-detail", id] });
      toast({
        title: "Saved",
        description: "Template saved successfully",
      });
      
      // Store the ID so subsequent saves are updates, not inserts
      if (returnedId && !savedId) {
        setSavedId(returnedId);
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

  // Save As Copy — duplicates the current template into a new row and navigates to it
  const handleSaveAs = async (data: {
    hotspots: Hotspot[];
    imageUrl: string;
    name: string;
    slug: string;
    description?: string;
  }): Promise<void> => {
    // Resolve a unique slug by appending -2, -3, … if needed
    const base = data.slug;
    const { data: existing, error: lookupErr } = await supabase
      .from("viral_slide_configs")
      .select("slug")
      .like("slug", `${base}%`);
    if (lookupErr) {
      toast({ variant: "destructive", title: "Error", description: lookupErr.message });
      throw lookupErr;
    }
    const taken = new Set((existing ?? []).map((r) => r.slug));
    let finalSlug = base;
    let n = 2;
    while (taken.has(finalSlug)) {
      finalSlug = `${base}-${n}`.slice(0, 80);
      n += 1;
    }

    const { data: inserted, error } = await supabase
      .from("viral_slide_configs")
      .insert({
        name: data.name,
        slug: finalSlug,
        description: data.description,
        image_url: data.imageUrl,
        hotspots: data.hotspots as unknown as Json,
        template_type: template?.template_type || "stats_page",
      })
      .select("id")
      .single();

    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
      throw error;
    }

    queryClient.invalidateQueries({ queryKey: ["interactive-templates"] });
    toast({
      title: "Copy saved",
      description: `Created "${data.name}" (slug: ${finalSlug})`,
    });
    navigate(`/template-editor/${inserted.id}`);
  };

  const handleCancel = () => {
    window.close();
  };

  const handleBack = () => {
    navigate("/deck-management?tab=templates");
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
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/deck-management?tab=templates">Template Repository</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="font-semibold text-accent-foreground">
                {isNewTemplate ? "New Template" : (template?.name || "Template")}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      {/* Editor */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <DataTemplateEditor
          key={id}
          initialHotspots={(template?.hotspots as unknown as Hotspot[]) || undefined}
          initialImageUrl={template?.image_url}
          templateName={template?.name || ""}
          templateSlug={template?.slug || ""}
          templateDescription={template?.description || ""}
          templateId={savedId}
          onSave={handleSave}
          onSaveAs={savedId ? handleSaveAs : undefined}
          onCancel={handleCancel}
          mode={isNewTemplate ? "create" : "edit"}
        />
      </div>
    </div>
  );
}
