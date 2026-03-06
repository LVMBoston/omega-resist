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
import { Upload, Loader2, FileDown, Images } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
const zipFormSchema = z.object({
  slug: z.string().min(1, "Deck slug is required").max(60, "Slug must be less than 60 characters").regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and dashes allowed"),
  file: z.instanceof(FileList).refine(files => files.length > 0, "ZIP file is required"),
  compress: z.boolean().default(true)
});
const imagesFormSchema = z.object({
  slug: z.string().min(1, "Deck slug is required").max(60, "Slug must be less than 60 characters").regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and dashes allowed"),
  files: z.instanceof(FileList).refine(files => files.length > 0, "At least one image is required"),
  compress: z.boolean().default(true)
});
const googleSlidesFormSchema = z.object({
  slug: z.string().min(1, "Deck slug is required").max(60, "Slug must be less than 60 characters").regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and dashes allowed"),
  slidesUrl: z.string().min(1, "Google Slides URL is required")
});
type ZipFormValues = z.infer<typeof zipFormSchema>;
type ImagesFormValues = z.infer<typeof imagesFormSchema>;
type GoogleSlidesFormValues = z.infer<typeof googleSlidesFormSchema>;
export default function DeckBuilder() {
  const navigate = useNavigate();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState("");
  const zipForm = useForm<ZipFormValues>({
    resolver: zodResolver(zipFormSchema),
    defaultValues: {
      slug: "",
      compress: true
    }
  });
  const imagesForm = useForm<ImagesFormValues>({
    resolver: zodResolver(imagesFormSchema),
    defaultValues: {
      slug: "",
      compress: true
    }
  });
  const googleSlidesForm = useForm<GoogleSlidesFormValues>({
    resolver: zodResolver(googleSlidesFormSchema),
    defaultValues: {
      slug: "",
      slidesUrl: ""
    }
  });
  const compressImage = async (file: File): Promise<Blob> => {
    try {
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true
      };
      return await imageCompression(file, options);
    } catch (error) {
      console.error("Compression failed:", error);
      return file;
    }
  };
  const getMimeType = (filename: string): string => {
    const ext = filename.toLowerCase().split('.').pop();
    switch (ext) {
      case 'png':
        return 'image/png';
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'gif':
        return 'image/gif';
      default:
        return 'application/octet-stream';
    }
  };
  const handleZipUpload = async (zipFile: File, slug: string, compress: boolean) => {
    setProgress("Reading ZIP file...");
    const zip = await JSZip.loadAsync(zipFile);

    // Extract PNG/JPG files
    const imageFiles: {
      name: string;
      data: Blob;
      mimeType: string;
    }[] = [];
    const filePromises: Promise<void>[] = [];
    zip.forEach((relativePath, file) => {
      if (!file.dir && /\.(png|jpg|jpeg|gif)$/i.test(relativePath)) {
        filePromises.push(file.async("blob").then(blob => {
          const mimeType = getMimeType(relativePath);
          imageFiles.push({
            name: relativePath,
            data: blob,
            mimeType
          });
        }));
      }
    });
    await Promise.all(filePromises);
    if (imageFiles.length === 0) {
      throw new Error("No PNG, JPG, or GIF images found in ZIP file");
    }

    // Sort files by name
    imageFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
    setProgress(`Found ${imageFiles.length} images. Creating deck...`);

    // Check if deck exists and delete it if so
    const {
      data: existingDeck
    } = await supabase.from("decks").select("slug").eq("slug", slug).single();
    if (existingDeck) {
      setProgress("Deleting existing deck...");

      // Delete old slides from storage
      const {
        data: existingSlides
      } = await supabase.from("slide_items").select("content_url").eq("deck_slug", slug);
      if (existingSlides && existingSlides.length > 0) {
        const filePaths = existingSlides.map(slide => {
          const url = new URL(slide.content_url);
          return url.pathname.split('/slides/')[1];
        }).filter(path => path); // Remove any undefined/empty paths

        if (filePaths.length > 0) {
          const {
            error: removeError
          } = await supabase.storage.from("slides").remove(filePaths);
          if (removeError) {
            console.warn("Failed to remove some files:", removeError);
          }
        }
      }

      // Delete deck record (this will cascade delete slide_items)
      await supabase.from("decks").delete().eq("slug", slug);
    }

    // Create deck record
    const {
      error: deckError
    } = await supabase.from("decks").insert({
      slug
    });
    if (deckError) {
      throw new Error(`Failed to create deck: ${deckError.message}`);
    }

    // Upload slides
    for (let i = 0; i < imageFiles.length; i++) {
      const {
        name,
        data,
        mimeType
      } = imageFiles[i];
      setProgress(`Uploading slide ${i + 1} of ${imageFiles.length}...`);
      let uploadBlob: Blob = data;
      let isCompressed = false;
      const isGif = /\.gif$/i.test(name);

      // Compress if enabled (skip GIFs to preserve animation)
      if (compress && /\.(png|jpg|jpeg)$/i.test(name)) {
        setProgress(`Compressing slide ${i + 1}...`);
        const imageFile = new File([data], name, {
          type: mimeType
        });
        uploadBlob = await compressImage(imageFile);
        isCompressed = true;
      } else {
        // For GIFs and other non-compressed files, recreate blob with correct MIME type
        // JSZip returns blobs with type "application/octet-stream" regardless of actual file type
        uploadBlob = new Blob([data], { type: mimeType });
      }

      // GIFs are never compressed to preserve animation
      if (isGif) {
        isCompressed = false;
      }
      const fileName = `${slug}/${i.toString().padStart(3, "0")}-${name}`;

      // Upload to storage with correct mime type (upsert to overwrite if exists)
      const {
        error: uploadError
      } = await supabase.storage.from("slides").upload(fileName, uploadBlob, {
        contentType: mimeType,
        upsert: true
      });
      if (uploadError) {
        throw new Error(`Failed to upload ${name}: ${uploadError.message}`);
      }

      // Get public URL
      const {
        data: urlData
      } = supabase.storage.from("slides").getPublicUrl(fileName);

      // Create slide_item record
      await supabase.from("slide_items").insert({
        deck_slug: slug,
          position: i + 1,
        type: "image",
        content_url: urlData.publicUrl,
        is_compressed: isCompressed
      });
    }
  };
  const handleGoogleSlidesImport = async (slidesUrl: string, slug: string) => {
    setProgress("Extracting presentation ID...");

    // Extract presentation ID from URL
    const urlMatch = slidesUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    const presentationId = urlMatch ? urlMatch[1] : slidesUrl;
    if (!presentationId) {
      throw new Error("Invalid Google Slides URL");
    }
    setProgress("Creating deck...");

    // Check if deck exists, create only if it doesn't
    const {
      data: existingDeck
    } = await supabase.from("decks").select("slug").eq("slug", slug).maybeSingle();
    if (!existingDeck) {
      const {
        error: deckError
      } = await supabase.from("decks").insert({
        slug
      });
      if (deckError) throw deckError;
    }
    setProgress("Importing slides from Google...");

    // Call edge function to import slides
    const {
      data,
      error
    } = await supabase.functions.invoke("import-google-slides", {
      body: {
        presentationId,
        deckSlug: slug
      }
    });
    if (error) throw error;
    setProgress(`Successfully imported ${data.slidesCount} slides`);
  };
  const handleImagesUpload = async (fileList: FileList, slug: string, compress: boolean) => {
    const validExtensions = /\.(png|jpg|jpeg|gif|webp)$/i;
    const imageFiles: { name: string; file: File }[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (validExtensions.test(file.name)) {
        imageFiles.push({ name: file.name, file });
      }
    }

    if (imageFiles.length === 0) {
      throw new Error("No valid image files selected (PNG, JPG, GIF, or WebP)");
    }

    // Sort files by name using natural numeric sorting
    imageFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

    setProgress(`Found ${imageFiles.length} images. Creating deck...`);

    // Check if deck exists and delete it if so
    const { data: existingDeck } = await supabase.from("decks").select("slug").eq("slug", slug).single();
    if (existingDeck) {
      setProgress("Deleting existing deck...");
      const { data: existingSlides } = await supabase.from("slide_items").select("content_url").eq("deck_slug", slug);
      if (existingSlides && existingSlides.length > 0) {
        const filePaths = existingSlides.map(slide => {
          const url = new URL(slide.content_url);
          return url.pathname.split('/slides/')[1];
        }).filter(path => path);
        if (filePaths.length > 0) {
          await supabase.storage.from("slides").remove(filePaths);
        }
      }
      await supabase.from("decks").delete().eq("slug", slug);
    }

    const { error: deckError } = await supabase.from("decks").insert({ slug });
    if (deckError) throw new Error(`Failed to create deck: ${deckError.message}`);

    for (let i = 0; i < imageFiles.length; i++) {
      const { name, file } = imageFiles[i];
      setProgress(`Uploading slide ${i + 1} of ${imageFiles.length}...`);

      let uploadBlob: Blob = file;
      let isCompressed = false;
      const isGif = /\.gif$/i.test(name);
      const mimeType = file.type || getMimeType(name);

      if (compress && !isGif && /\.(png|jpg|jpeg|webp)$/i.test(name)) {
        setProgress(`Compressing slide ${i + 1}...`);
        uploadBlob = await compressImage(file);
        isCompressed = true;
      }

      if (isGif) isCompressed = false;

      const fileName = `${slug}/${i.toString().padStart(3, "0")}-${name}`;
      const { error: uploadError } = await supabase.storage.from("slides").upload(fileName, uploadBlob, {
        contentType: mimeType,
        upsert: true
      });
      if (uploadError) throw new Error(`Failed to upload ${name}: ${uploadError.message}`);

      const { data: urlData } = supabase.storage.from("slides").getPublicUrl(fileName);
      await supabase.from("slide_items").insert({
        deck_slug: slug,
        position: i + 1,
        type: "image",
        content_url: urlData.publicUrl,
        is_compressed: isCompressed
      });
    }
  };

  const onZipSubmit = async (values: ZipFormValues) => {
    setUploading(true);
    try {
      const file = values.file[0];
      await handleZipUpload(file, values.slug, values.compress);
      toast.success("Deck created successfully!");
      navigate("/deck-management");
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Failed to create deck");
    } finally {
      setUploading(false);
      setProgress("");
    }
  };

  const onImagesSubmit = async (values: ImagesFormValues) => {
    setUploading(true);
    try {
      await handleImagesUpload(values.files, values.slug, values.compress);
      toast.success(`Deck created with ${values.files.length} slides!`);
      navigate("/deck-management");
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Failed to create deck");
    } finally {
      setUploading(false);
      setProgress("");
    }
  };
  const onGoogleSlidesSubmit = async (values: GoogleSlidesFormValues) => {
    setUploading(true);
    try {
      await handleGoogleSlidesImport(values.slidesUrl, values.slug);
      toast.success("Deck created successfully!");
      navigate("/deck-management");
    } catch (error: any) {
      console.error("Import error:", error);
      toast.error(error.message || "Failed to import slides");
    } finally {
      setUploading(false);
      setProgress("");
    }
  };
  return <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-4xl font-bold mb-2">Deck Builder</h1>
          <p className="text-muted-foreground">
            Import slides from ZIP files or Google Slides
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Step 1: Import Slides</CardTitle>
            <CardDescription>
              Choose your import method and provide a unique deck name
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="zip" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="zip">
                  <Upload className="h-4 w-4 mr-2" />
                  ZIP File
                </TabsTrigger>
                <TabsTrigger value="google">
                  <FileDown className="h-4 w-4 mr-2" />
                  Google Slides
                </TabsTrigger>
              </TabsList>

              <TabsContent value="zip" className="space-y-4 mt-6">
                <Form {...zipForm}>
                  <form onSubmit={zipForm.handleSubmit(onZipSubmit)} className="space-y-6">
                    <FormField control={zipForm.control} name="file" render={({
                    field: {
                      onChange,
                      value,
                      ...field
                    }
                  }) => <FormItem>
                          <FormLabel>Upload ZIP File</FormLabel>
                          <FormControl>
                            <Input type="file" accept=".zip" onChange={e => onChange(e.target.files)} disabled={uploading} {...field} />
                          </FormControl>
                          <p className="text-sm text-muted-foreground">
                            ZIP file containing PNG, JPG, or GIF images as slides
                          </p>
                          <FormMessage />
                        </FormItem>} />

                    <FormField control={zipForm.control} name="slug" render={({
                    field
                  }) => <FormItem>
                          <FormLabel className="text-lg font-semibold">Step 2: Enter Deck Name</FormLabel>
                          <FormControl>
                            <Input placeholder="my-deck-2024" {...field} disabled={uploading} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>} />

                    <FormField control={zipForm.control} name="compress" render={({
                    field
                  }) => <FormItem className="flex items-center space-x-2">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={uploading} />
                          </FormControl>
                          <FormLabel className="!mt-0 cursor-pointer">
                            Compress images for faster loading
                          </FormLabel>
                        </FormItem>} />

                    {progress && <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {progress}
                      </div>}

                    <Button type="submit" disabled={uploading} className="w-full">
                      {uploading ? <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating Deck...
                        </> : <>
                          <Upload className="mr-2 h-4 w-4" />
                          Create Deck
                        </>}
                    </Button>
                  </form>
                </Form>
              </TabsContent>

              <TabsContent value="google" className="space-y-4 mt-6">
                <Form {...googleSlidesForm}>
                  <form onSubmit={googleSlidesForm.handleSubmit(onGoogleSlidesSubmit)} className="space-y-6">
                    <FormField control={googleSlidesForm.control} name="slidesUrl" render={({
                    field
                  }) => <FormItem>
                          <FormLabel>Google Slides URL</FormLabel>
                          <FormControl>
                            <Input placeholder="https://docs.google.com/presentation/d/..." {...field} disabled={uploading} />
                          </FormControl>
                          <p className="text-sm text-muted-foreground">
                            The presentation must be shared with your service account
                          </p>
                          <FormMessage />
                        </FormItem>} />

                    <FormField control={googleSlidesForm.control} name="slug" render={({
                    field
                  }) => <FormItem>
                          <FormLabel className="text-lg font-semibold">Step 2: Enter Deck Name</FormLabel>
                          <FormControl>
                            <Input placeholder="my-deck-2024" {...field} disabled={uploading} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>} />

                    {progress && <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {progress}
                      </div>}

                    <Button type="submit" disabled={uploading} className="w-full">
                      {uploading ? <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Importing Slides...
                        </> : <>
                          <FileDown className="mr-2 h-4 w-4" />
                          Import from Google Slides
                        </>}
                    </Button>
                  </form>
                </Form>
              </TabsContent>

            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>;
}