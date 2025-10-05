import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import JSZip from "jszip";
import imageCompression from "browser-image-compression";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

const formSchema = z
  .object({
    slug: z.string()
      .min(1, "Deck slug is required")
      .max(60, "Slug must be less than 60 characters")
      .regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and dashes allowed"),
    file: z.instanceof(FileList).optional(),
    googleSlidesUrl: z.string().optional(),
    compress: z.boolean().default(true),
  })
  .refine(
    (data) => (data.file && data.file.length > 0) || (data.googleSlidesUrl && data.googleSlidesUrl.length > 0),
    {
      message: "Either upload a file or provide a Google Slides URL",
      path: ["file"],
    }
  );

type FormValues = z.infer<typeof formSchema>;

export default function DeckBuilder() {
  const navigate = useNavigate();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState("");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      slug: "",
      googleSlidesUrl: "",
      compress: true,
    },
  });

  const compressImage = async (file: File): Promise<Blob> => {
    try {
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      };
      return await imageCompression(file, options);
    } catch (error) {
      console.error("Compression failed:", error);
      return file;
    }
  };

  const handleZipUpload = async (zipFile: File, slug: string, compress: boolean) => {
    setProgress("Reading ZIP file...");
    
    const zip = await JSZip.loadAsync(zipFile);
    
    // Extract PNG/JPG files
    const imageFiles: { name: string; data: Blob }[] = [];
    const filePromises: Promise<void>[] = [];

    zip.forEach((relativePath, file) => {
      if (!file.dir && /\.(png|jpg|jpeg)$/i.test(relativePath)) {
        filePromises.push(
          file.async("blob").then((blob) => {
            imageFiles.push({ name: relativePath, data: blob });
          })
        );
      }
    });

    await Promise.all(filePromises);
    
    if (imageFiles.length === 0) {
      throw new Error("No PNG or JPG images found in ZIP file");
    }

    // Sort files by name
    imageFiles.sort((a, b) => a.name.localeCompare(b.name));

    setProgress(`Found ${imageFiles.length} images. Creating deck...`);

    // Create deck record
    const { error: deckError } = await supabase
      .from("decks")
      .insert({ slug });

    if (deckError) {
      if (deckError.code === "23505") {
        throw new Error("A deck with this slug already exists");
      } else {
        throw new Error(`Failed to create deck: ${deckError.message}`);
      }
    }

    // Upload slides
    for (let i = 0; i < imageFiles.length; i++) {
      const { name, data } = imageFiles[i];
      setProgress(`Uploading slide ${i + 1} of ${imageFiles.length}...`);

      let uploadBlob = data;
      let isCompressed = false;

      // Compress if enabled
      if (compress && /\.(png|jpg|jpeg)$/i.test(name)) {
        setProgress(`Compressing slide ${i + 1}...`);
        uploadBlob = await compressImage(new File([data], name));
        isCompressed = true;
      }

      const fileName = `${slug}/${i.toString().padStart(3, "0")}-${name}`;
      
      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("slides")
        .upload(fileName, uploadBlob, {
          contentType: uploadBlob.type,
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Failed to upload ${name}: ${uploadError.message}`);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("slides")
        .getPublicUrl(fileName);

      // Create slide_item record
      await supabase.from("slide_items").insert({
        deck_slug: slug,
        position: i,
        type: "image",
        content_url: urlData.publicUrl,
        is_compressed: isCompressed,
      });
    }
  };

  const handlePptxUpload = async (file: File, slug: string, compress: boolean) => {
    setProgress("Processing PowerPoint file...");
    toast.info("PPTX conversion coming soon! For now, please export your presentation as PNG images and upload as ZIP.");
    throw new Error("PPTX support coming soon");
  };

  const handlePdfUpload = async (file: File, slug: string, compress: boolean) => {
    setProgress("Processing PDF file...");
    toast.info("PDF conversion coming soon! For now, please export your PDF pages as PNG images and upload as ZIP.");
    throw new Error("PDF support coming soon");
  };

  const handleGoogleSlidesUpload = async (url: string, slug: string, compress: boolean) => {
    setProgress("Fetching Google Slides...");
    toast.info("Google Slides import coming soon! For now, please export your presentation as PNG images and upload as ZIP.");
    throw new Error("Google Slides support coming soon");
  };

  const onSubmit = async (values: FormValues) => {
    setUploading(true);

    try {
      // Determine source type
      if (values.googleSlidesUrl && values.googleSlidesUrl.length > 0) {
        await handleGoogleSlidesUpload(values.googleSlidesUrl, values.slug, values.compress);
      } else if (values.file && values.file.length > 0) {
        const file = values.file[0];
        const fileType = file.name.split('.').pop()?.toLowerCase();
        
        if (fileType === 'zip') {
          await handleZipUpload(file, values.slug, values.compress);
        } else if (fileType === 'pptx') {
          await handlePptxUpload(file, values.slug, values.compress);
        } else if (fileType === 'pdf') {
          await handlePdfUpload(file, values.slug, values.compress);
        } else {
          throw new Error(`Unsupported file type: ${fileType}`);
        }
      }
      
      toast.success("Deck created successfully!");
      navigate("/");
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Failed to create deck");
    } finally {
      setUploading(false);
      setProgress("");
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-4xl font-bold mb-2">Deck Builder</h1>
          <p className="text-muted-foreground">
            Upload slides as ZIP, PowerPoint, PDF, or import from Google Slides
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create New Deck</CardTitle>
            <CardDescription>
              Choose a unique slug and provide your slide content
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="file"
                  render={({ field: { onChange, value, ...field } }) => (
                    <FormItem>
                      <FormLabel>Upload File</FormLabel>
                      <FormControl>
                        <Input
                          type="file"
                          accept=".zip,.pptx,.pdf"
                          onChange={(e) => onChange(e.target.files)}
                          disabled={uploading}
                          {...field}
                        />
                      </FormControl>
                      <p className="text-sm text-muted-foreground">
                        Accepts ZIP (with PNG/JPG images), PowerPoint (.pptx), or PDF files
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Or</span>
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="googleSlidesUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Google Slides URL</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="https://docs.google.com/presentation/d/..."
                          {...field}
                          disabled={uploading}
                        />
                      </FormControl>
                      <p className="text-sm text-muted-foreground">
                        Paste a sharing link (must be "viewable by anyone with link")
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="slug"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Deck Slug</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="my-deck-2024"
                          {...field}
                          disabled={uploading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="compress"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={uploading}
                        />
                      </FormControl>
                      <FormLabel className="!mt-0 cursor-pointer">
                        Compress images for faster loading
                      </FormLabel>
                    </FormItem>
                  )}
                />

                {progress && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {progress}
                  </div>
                )}

                <Button type="submit" disabled={uploading} className="w-full">
                  {uploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating Deck...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Create Deck
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
