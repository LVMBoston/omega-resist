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

const formSchema = z.object({
  slug: z.string()
    .min(1, "Deck slug is required")
    .max(60, "Slug must be less than 60 characters")
    .regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and dashes allowed"),
  zipFile: z.instanceof(FileList).refine((files) => files.length > 0, "ZIP file is required"),
  compress: z.boolean().default(true),
});

type FormValues = z.infer<typeof formSchema>;

export default function DeckBuilder() {
  const navigate = useNavigate();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState("");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      slug: "",
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

  const onSubmit = async (values: FormValues) => {
    setUploading(true);
    setProgress("Reading ZIP file...");

    try {
      const zipFile = values.zipFile[0];
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
        toast.error("No PNG or JPG images found in ZIP file");
        setUploading(false);
        return;
      }

      // Sort files by name
      imageFiles.sort((a, b) => a.name.localeCompare(b.name));

      setProgress(`Found ${imageFiles.length} images. Creating deck...`);

      // Create deck record
      const { error: deckError } = await supabase
        .from("decks")
        .insert({ slug: values.slug });

      if (deckError) {
        if (deckError.code === "23505") {
          toast.error("A deck with this slug already exists");
        } else {
          toast.error(`Failed to create deck: ${deckError.message}`);
        }
        setUploading(false);
        return;
      }

      // Upload slides
      for (let i = 0; i < imageFiles.length; i++) {
        const { name, data } = imageFiles[i];
        setProgress(`Uploading slide ${i + 1} of ${imageFiles.length}...`);

        let uploadBlob = data;
        let isCompressed = false;

        // Compress if enabled
        if (values.compress && /\.(png|jpg|jpeg)$/i.test(name)) {
          setProgress(`Compressing slide ${i + 1}...`);
          uploadBlob = await compressImage(new File([data], name));
          isCompressed = true;
        }

        const fileName = `${values.slug}/${i.toString().padStart(3, "0")}-${name}`;
        
        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from("slides")
          .upload(fileName, uploadBlob, {
            contentType: uploadBlob.type,
            upsert: false,
          });

        if (uploadError) {
          toast.error(`Failed to upload ${name}: ${uploadError.message}`);
          continue;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from("slides")
          .getPublicUrl(fileName);

        // Create slide_item record
        await supabase.from("slide_items").insert({
          deck_slug: values.slug,
          position: i,
          type: "image",
          content_url: urlData.publicUrl,
          is_compressed: isCompressed,
        });
      }

      toast.success(`Deck created with ${imageFiles.length} slides!`);
      navigate("/");
    } catch (error) {
      console.error("Upload failed:", error);
      toast.error("Failed to create deck. Please try again.");
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
          <p className="text-muted-foreground">Upload a ZIP file of PNG or JPG images to create a slide deck</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create New Deck</CardTitle>
            <CardDescription>
              Choose a unique slug and upload your slides as a ZIP file
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                  name="zipFile"
                  render={({ field: { onChange, value, ...field } }) => (
                    <FormItem>
                      <FormLabel>ZIP File</FormLabel>
                      <FormControl>
                        <Input
                          type="file"
                          accept=".zip"
                          onChange={(e) => onChange(e.target.files)}
                          disabled={uploading}
                          {...field}
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
