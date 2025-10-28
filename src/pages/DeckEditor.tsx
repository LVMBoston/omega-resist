import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Trash2, Upload, Loader2, Plus, Image as ImageIcon, GripVertical, Check, X } from "lucide-react";
import imageCompression from "browser-image-compression";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FullResolutionHotspotEditor } from "@/components/FullResolutionHotspotEditor";
import { DeploymentConfirmDialog } from "@/components/DeploymentConfirmDialog";
import { mintL00 } from "@/lib/virality/mint";

interface Slide {
  id: string;
  position: number;
  type: string;
  content_url: string;
  is_compressed: boolean;
  template_id?: string;
  deck_slug: string;
}

interface Template {
  id: string;
  name: string;
  slug: string;
  image_url: string;
  hotspots: any;
  is_default: boolean;
}

interface ViralConfig {
  id: string;
  slide_id: string;
  hotspots: any;
}

const SortableSlide = ({ slide, onSelect, onDelete, isSelected }: { slide: Slide; onSelect: () => void; onDelete: () => void; isSelected: boolean }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: slide.id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group border-2 rounded-lg overflow-hidden ${
        isSelected ? 'border-primary ring-2 ring-primary' : 'border-border hover:border-primary/50'
      } ${slide.type === 'spread-word' ? 'ring-2 ring-blue-500' : ''}`}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute left-0 top-0 bottom-0 w-8 bg-muted/80 hover:bg-muted flex items-center justify-center cursor-grab active:cursor-grabbing z-10 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      
      {/* Clickable slide area */}
      <div
        className="cursor-pointer"
        onClick={onSelect}
      >
        <img src={slide.content_url} alt={`Slide ${slide.position}`} className="w-full aspect-video object-contain bg-muted" />
      </div>
      
      <div className="absolute top-1 left-1 bg-background/90 px-2 py-1 rounded text-xs font-medium">
        {slide.position}
      </div>
      {slide.type === 'spread-word' && (
        <div className="absolute top-1 right-8 bg-blue-500 text-white px-2 py-1 rounded text-xs font-medium">
          {slide.template_id ? 'Interactive' : 'Legacy'}
        </div>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="absolute top-1 right-1 bg-destructive text-destructive-foreground p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Trash2 className="h-3 w-3" />
      </button>
      {slide.is_compressed && (
        <div className="absolute bottom-1 right-1 bg-green-500 text-white px-2 py-1 rounded text-xs">
          Compressed
        </div>
      )}
    </div>
  );
};

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

export default function DeckEditor() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [originalSlides, setOriginalSlides] = useState<Slide[]>([]); // Original state from DB
  const [slides, setSlides] = useState<Slide[]>([]); // Draft state
  const [selectedSlide, setSelectedSlide] = useState<Slide | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [slideToDelete, setSlideToDelete] = useState<Slide | null>(null);
  const [referenceDimensions, setReferenceDimensions] = useState<{ width: number; height: number } | null>(null);
  const [hotspotEditorOpen, setHotspotEditorOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [eoaCount, setEoaCount] = useState(0);
  const [campaigns, setCampaigns] = useState<string[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [pendingUploads, setPendingUploads] = useState<{ file: File | Blob; position?: number }[]>([]);
  const [pendingDeletes, setPendingDeletes] = useState<Slide[]>([]);
  const [hotspotChanges, setHotspotChanges] = useState<{ [slideId: string]: any }>({});
  const [hasDeployedTokens, setHasDeployedTokens] = useState(false);
  const [deploymentDialogOpen, setDeploymentDialogOpen] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [affectedEoas, setAffectedEoas] = useState<Array<{ id: string; title: string }>>([]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (slug) {
      fetchSlides();
      fetchTemplates();
      fetchDeckUsage();
    }
  }, [slug]);

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            await handleImageUpload(blob);
          }
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [referenceDimensions]);

  const fetchSlides = async () => {
    if (!slug) return;
    
    try {
      const { data, error } = await supabase
        .from('slide_items')
        .select('*')
        .eq('deck_slug', slug)
        .order('position');

      if (error) throw error;

      setOriginalSlides(data || []);
      setSlides(data || []);
      if (data && data.length > 0) {
        setSelectedSlide(data[0]);
        // Get reference dimensions from first slide
        const img = new Image();
        img.onload = () => {
          setReferenceDimensions({ width: img.width, height: img.height });
        };
        img.src = data[0].content_url;
      }
    } catch (error: any) {
      console.error('Error fetching slides:', error);
      toast.error('Failed to load slides');
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('viral_slide_configs')
        .select('*')
        .is('slide_id', null) as any;

      if (error) throw error;
      
      // Only include valid templates
      const validTemplates = (data || []).filter(isValidInteractiveTemplate);
      setTemplates(validTemplates as Template[]);
    } catch (error: any) {
      console.error('Error fetching templates:', error);
    }
  };

  const fetchDeckUsage = async () => {
    if (!slug) return;
    
    try {
      const { data: eoas, error } = await supabase
        .from('events_actions')
        .select('id, title, campaign_id, campaigns(title)')
        .eq('assigned_deck_slug', slug);

      if (error) throw error;

      setEoaCount(eoas?.length || 0);
      
      // Store affected EoAs for deployment
      setAffectedEoas(eoas?.map((eoa: any) => ({ 
        id: eoa.id, 
        title: eoa.title 
      })) || []);
      
      // Get unique campaign titles
      const uniqueCampaigns = [...new Set(
        eoas?.map((eoa: any) => eoa.campaigns?.title).filter(Boolean) || []
      )];
      setCampaigns(uniqueCampaigns);

      // Check if any L00 tokens exist for this deck
      const { data: tokens, error: tokenError } = await supabase
        .from('tokens')
        .select('id')
        .eq('deck_slug', slug)
        .eq('level', 0)
        .limit(1);

      if (!tokenError && tokens && tokens.length > 0) {
        setHasDeployedTokens(true);
      } else {
        setHasDeployedTokens(false);
      }
    } catch (error: any) {
      console.error('Error fetching deck usage:', error);
    }
  };

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

  const resizeImage = async (file: File | Blob, targetWidth: number, targetHeight: number): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Calculate scaling to fit while preserving aspect ratio
        const scale = Math.min(targetWidth / img.width, targetHeight / img.height);
        const scaledWidth = img.width * scale;
        const scaledHeight = img.height * scale;
        
        // Center the image
        const x = (targetWidth - scaledWidth) / 2;
        const y = (targetHeight - scaledHeight) / 2;

        // Fill with white background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, targetWidth, targetHeight);
        
        // Draw the scaled image
        ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
        
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob'));
          }
        }, file.type);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  };

  const validateImage = async (file: File | Blob): Promise<{ valid: boolean; error?: string; dimensions?: { width: number; height: number }; resizedFile?: Blob }> => {
    // File type validation
    if (file.type !== 'image/png' && file.type !== 'image/jpeg') {
      return { valid: false, error: 'Only PNG and JPG images are allowed' };
    }

    // Size validation (5MB)
    if (file.size > 5 * 1024 * 1024) {
      return { valid: false, error: `File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds 5MB limit` };
    }

    // Dimension validation with aspect ratio tolerance
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = async () => {
        if (referenceDimensions) {
          const widthTolerance = referenceDimensions.width * 0.01;
          const heightTolerance = referenceDimensions.height * 0.01;
          
          const widthInRange = Math.abs(img.width - referenceDimensions.width) <= widthTolerance;
          const heightInRange = Math.abs(img.height - referenceDimensions.height) <= heightTolerance;
          
          if (widthInRange && heightInRange) {
            resolve({ valid: true, dimensions: { width: img.width, height: img.height } });
            return;
          }

          // Check aspect ratio tolerance (6%)
          const imageAspectRatio = img.width / img.height;
          const referenceAspectRatio = referenceDimensions.width / referenceDimensions.height;
          const aspectRatioDiff = Math.abs(imageAspectRatio - referenceAspectRatio) / referenceAspectRatio;
          
          console.log('🔍 Aspect Ratio Validation:', {
            imageAspectRatio: imageAspectRatio.toFixed(4),
            referenceAspectRatio: referenceAspectRatio.toFixed(4),
            difference: (aspectRatioDiff * 100).toFixed(2) + '%',
            tolerance: '6%',
            willPass: aspectRatioDiff <= 0.06
          });
          
          if (aspectRatioDiff <= 0.06) {
            // Aspect ratio is close enough, resize automatically
            try {
              const resizedFile = await resizeImage(file, referenceDimensions.width, referenceDimensions.height);
              resolve({ 
                valid: true, 
                dimensions: { width: referenceDimensions.width, height: referenceDimensions.height },
                resizedFile
              });
            } catch (error) {
              console.error('Error resizing image:', error);
              resolve({
                valid: false,
                error: `Image dimensions (${img.width}×${img.height}) must match reference (${referenceDimensions.width}×${referenceDimensions.height}) ±1%`
              });
            }
          } else {
            resolve({
              valid: false,
              error: `Image aspect ratio (${imageAspectRatio.toFixed(2)}) differs too much from reference (${referenceAspectRatio.toFixed(2)}). Must be within 6%.`
            });
          }
        } else {
          resolve({ valid: true, dimensions: { width: img.width, height: img.height } });
        }
      };
      img.onerror = () => resolve({ valid: false, error: 'Failed to load image' });
      img.src = URL.createObjectURL(file);
    });
  };

  const handleImageUpload = async (file: File | Blob, insertPosition?: number) => {
    if (!slug) return;

    const validation = await validateImage(file);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    // Use resized file if available
    const fileToUpload = validation.resizedFile || file;
    if (validation.resizedFile) {
      toast.success('Image automatically resized to match deck dimensions');
    }

    // Add to pending uploads and create temp slide preview
    const targetPosition = insertPosition !== undefined ? insertPosition : (slides.length > 0 ? Math.max(...slides.map(s => s.position)) + 1 : 1);
    const tempId = `temp-${Date.now()}`;
    const tempSlide: Slide = {
      id: tempId,
      position: targetPosition,
      type: 'image',
      content_url: URL.createObjectURL(fileToUpload),
      is_compressed: true,
      deck_slug: slug!,
    };

    // Update draft slides
    const updatedSlides = [...slides];
    if (insertPosition !== undefined) {
      // Shift positions
      updatedSlides.forEach(s => {
        if (s.position >= insertPosition) s.position++;
      });
    }
    updatedSlides.push(tempSlide);
    updatedSlides.sort((a, b) => a.position - b.position);
    
    setSlides(updatedSlides);
    setPendingUploads([...pendingUploads, { file: fileToUpload, position: insertPosition }]);
    setHasChanges(true);
    toast.success('Slide staged for upload');
  };

  const handleDelete = () => {
    if (!slideToDelete) return;

    // Add to pending deletes (only if not a temp slide)
    if (!slideToDelete.id.startsWith('temp-')) {
      setPendingDeletes([...pendingDeletes, slideToDelete]);
    }

    // Remove from draft slides and reorder
    const updatedSlides = slides
      .filter(s => s.id !== slideToDelete.id)
      .map((s, idx) => ({ ...s, position: idx + 1 }));
    
    setSlides(updatedSlides);
    setHasChanges(true);
    setDeleteDialogOpen(false);
    setSlideToDelete(null);
    toast.success('Slide marked for deletion');
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = slides.findIndex(s => s.id === active.id);
      const newIndex = slides.findIndex(s => s.id === over.id);

      const newSlides = arrayMove(slides, oldIndex, newIndex).map((s, idx) => ({ ...s, position: idx + 1 }));
      setSlides(newSlides);
      setHasChanges(true);
      toast.success('Slides reordered (not saved yet)');
    }
  };

  const handleSaveHotspots = (hotspots: any[]) => {
    if (!selectedSlide) return;

    // Store hotspot changes for later
    setHotspotChanges({ ...hotspotChanges, [selectedSlide.id]: hotspots });
    setHasChanges(true);
    setHotspotEditorOpen(false);
    toast.success('Hotspot changes staged');
  };

  const handleAddInteractiveSlide = async (template: Template) => {
    if (!slug) return;

    try {
      // Download template image
      const response = await fetch(template.image_url);
      const blob = await response.blob();

      const validation = await validateImage(blob);
      if (!validation.valid) {
        toast.error(validation.error);
        return;
      }

      const targetPosition = slides.length > 0 ? Math.max(...slides.map(s => s.position)) + 1 : 1;
      const tempId = `temp-interactive-${Date.now()}`;
      
      // Create temp slide
      const tempSlide: Slide = {
        id: tempId,
        position: targetPosition,
        type: 'spread-word',
        content_url: template.image_url,
        is_compressed: false,
        template_id: template.id,
        deck_slug: slug,
      };

      setSlides([...slides, tempSlide]);
      setPendingUploads([...pendingUploads, { file: blob, position: targetPosition }]);
      setHotspotChanges({ ...hotspotChanges, [tempId]: template.hotspots });
      setHasChanges(true);
      setTemplateDialogOpen(false);
      toast.success('Interactive slide staged');
    } catch (error: any) {
      console.error('Error adding interactive slide:', error);
      toast.error('Failed to add interactive slide');
    }
  };

  const handleApplyTemplateToSlide = async (template: Template) => {
    if (!slug || !selectedSlide) return;

    try {
      // Download template image
      const response = await fetch(template.image_url);
      const blob = await response.blob();

      const validation = await validateImage(blob);
      if (!validation.valid) {
        toast.error(validation.error);
        return;
      }

      // Use resized file if available
      const fileToUpload = validation.resizedFile || blob;
      if (validation.resizedFile) {
        toast.success('Template automatically resized to match deck dimensions');
      }

      // Update the existing slide with template data
      const updatedSlides = slides.map(slide => 
        slide.id === selectedSlide.id 
          ? { ...slide, content_url: template.image_url, type: 'spread-word', template_id: template.id }
          : slide
      );

      setSlides(updatedSlides);
      setSelectedSlide({ ...selectedSlide, content_url: template.image_url, type: 'spread-word', template_id: template.id });
      
      // Mark as pending upload to replace the image
      setPendingUploads([...pendingUploads, { file: fileToUpload, position: selectedSlide.position }]);
      
      // Apply template hotspots
      setHotspotChanges({ ...hotspotChanges, [selectedSlide.id]: template.hotspots });
      
      setHasChanges(true);
      setTemplatePickerOpen(false);
      toast.success('Template applied to slide');
    } catch (error: any) {
      console.error('Error applying template:', error);
      toast.error('Failed to apply template');
    }
  };

  const handleCancel = () => {
    setSlides([...originalSlides]);
    setPendingUploads([]);
    setPendingDeletes([]);
    setHotspotChanges({});
    setHasChanges(false);
    toast.info('Changes discarded');
  };

  const handleSaveChanges = async () => {
    if (!slug) return;

    setSaving(true);
    try {
      // 1. Handle deletions first
      for (const slide of pendingDeletes) {
        const url = new URL(slide.content_url);
        const filePath = url.pathname.split('/slides/')[1];
        
        if (filePath) {
          await supabase.storage.from('slides').remove([filePath]);
        }

        if (slide.type === 'spread-word') {
          await supabase
            .from('viral_slide_configs')
            .delete()
            .eq('slide_id', slide.id);
        }

        await supabase
          .from('slide_items')
          .delete()
          .eq('id', slide.id);
      }

      // 2. Handle uploads and create slide records for temp slides
      const tempSlideIdMap: { [tempId: string]: string } = {}; // Map temp IDs to real IDs
      
      for (const { file, position } of pendingUploads) {
        const compressedBlob = await compressImage(file instanceof File ? file : new File([file], 'uploaded.png', { type: file.type }));
        const targetPos = position !== undefined ? position : slides.length;
        const fileName = `${slug}/${targetPos.toString().padStart(3, "0")}-${Date.now()}.${file.type === 'image/png' ? 'png' : 'jpg'}`;
        
        const { data: uploadData } = await supabase.storage.from('slides').upload(fileName, compressedBlob, {
          contentType: file.type,
          upsert: true,
        });

        if (uploadData) {
          const { data: { publicUrl } } = supabase.storage.from('slides').getPublicUrl(fileName);
          
          // Find the temp slide that corresponds to this upload
          const tempSlide = slides.find(s => s.id.startsWith('temp-') && s.position === targetPos);
          
          if (tempSlide) {
            // Create a new slide_items record
            const { data: newSlide, error: insertError } = await supabase
              .from('slide_items')
              .insert({
                deck_slug: slug,
                position: targetPos,
                content_url: publicUrl,
                type: tempSlide.type,
                is_compressed: true,
                template_id: tempSlide.template_id,
              })
              .select()
              .single();

            if (insertError) {
              console.error('Error creating slide record:', insertError);
              throw insertError;
            }

            if (newSlide) {
              // Map the temp ID to the real ID
              tempSlideIdMap[tempSlide.id] = newSlide.id;
            }
          }
        }
      }

      // 3. Update all slide positions (use temporary positions to avoid unique constraint conflicts)
      const realSlides = slides.filter(s => !s.id.startsWith('temp-'));
      
      // First, shift all to temporary high positions
      for (let i = 0; i < realSlides.length; i++) {
        await supabase
          .from('slide_items')
          .update({ position: i + 10000 })
          .eq('id', realSlides[i].id);
      }
      
      // Then update to final positions
      for (let i = 0; i < realSlides.length; i++) {
        await supabase
          .from('slide_items')
          .update({ position: realSlides[i].position })
          .eq('id', realSlides[i].id);
      }

      // 4. Handle hotspot changes (including temp slides that now have real IDs)
      for (const [slideId, hotspots] of Object.entries(hotspotChanges)) {
        // Map temp ID to real ID if applicable
        const realSlideId = slideId.startsWith('temp-') ? tempSlideIdMap[slideId] : slideId;
        
        if (!realSlideId) {
          console.warn(`No real slide ID found for temp ID: ${slideId}`);
          continue;
        }

        const { data: existingConfig } = await supabase
          .from('viral_slide_configs')
          .select('id')
          .eq('slide_id', realSlideId)
          .single();

        if (existingConfig) {
          await supabase
            .from('viral_slide_configs')
            .update({ hotspots })
            .eq('id', existingConfig.id);
        } else {
          // Get the slide to find its content URL
          const { data: slideData } = await supabase
            .from('slide_items')
            .select('position, content_url')
            .eq('id', realSlideId)
            .single();

          if (slideData) {
            await supabase
              .from('viral_slide_configs')
              .insert({
                slide_id: realSlideId,
                deck_slug: slug,
                name: `Slide ${slideData.position}`,
                slug: `${slug}-slide-${slideData.position}`,
                image_url: slideData.content_url,
                hotspots,
              } as any);
          }
        }
      }

      // Check if deployment is needed
      if (hasDeployedTokens && campaigns.length > 0) {
        // Open deployment dialog instead of showing toast
        setDeploymentDialogOpen(true);
      } else {
        // Simple toast for non-deployed or unused decks
        toast.success(
          eoaCount > 0 
            ? `All changes saved successfully. This deck is assigned to ${eoaCount} event(s). Create tokens when ready.`
            : "All changes saved successfully. This deck is not yet assigned to any campaigns.",
          { duration: Infinity }
        );
      }

      setPendingUploads([]);
      setPendingDeletes([]);
      setHotspotChanges({});
      setHasChanges(false);
      await fetchSlides();
    } catch (error: any) {
      console.error('Error saving changes:', error);
      toast.error('Failed to save some changes');
    } finally {
      setSaving(false);
    }
  };

  const handleDeployConfirm = async () => {
    if (!slug) return;

    setIsDeploying(true);
    try {
      let successCount = 0;
      let failCount = 0;

      // Regenerate tokens for all affected EoAs
      for (const eoa of affectedEoas) {
        try {
          await mintL00({
            eoaId: eoa.id,
            deckSlug: slug,
            utmMedium: "qr"
          });
          successCount++;
        } catch (error) {
          console.error(`Failed to mint token for EoA ${eoa.id}:`, error);
          failCount++;
        }
      }

      if (successCount > 0) {
        toast.success(
          `Deployed! ${successCount} event${successCount !== 1 ? 's' : ''} updated. Changes are now live.`,
          { duration: 5000 }
        );
      }

      if (failCount > 0) {
        toast.error(
          `${failCount} event${failCount !== 1 ? 's' : ''} failed to update. Check console for details.`,
          { duration: 5000 }
        );
      }

      setDeploymentDialogOpen(false);
      await fetchDeckUsage(); // Refresh to update status
    } catch (error) {
      console.error('Deployment error:', error);
      toast.error('Deployment failed. Please try again.');
    } finally {
      setIsDeploying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-[1800px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/deck-management')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Editing Deck: {slug}</h1>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            {referenceDimensions && (
              <div className="text-sm text-muted-foreground px-4 py-2 bg-muted rounded">
                Reference: {referenceDimensions.width}×{referenceDimensions.height}
              </div>
            )}
            {hasChanges && (
              <div className="text-sm text-amber-600 px-3 py-2 bg-amber-100 dark:bg-amber-950 rounded">
                Unsaved changes
              </div>
            )}
            <Button 
              variant="outline" 
              onClick={handleCancel}
              disabled={!hasChanges || saving}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSaveChanges}
              disabled={!hasChanges || saving}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </div>

        {/* Main Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr_300px] gap-6">
          {/* Left Sidebar - Slide Thumbnails */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => document.getElementById('file-upload')?.click()}
                  disabled={uploading}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Add Slide
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setTemplateDialogOpen(true)}
                  disabled={uploading}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Interactive
                </Button>
              </div>
              <input
                id="file-upload"
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(file);
                  e.target.value = '';
                }}
              />
              <div className="text-xs text-muted-foreground text-center">
                Paste images (Ctrl+V) or drag to reorder
              </div>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={slides.map(s => s.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {slides.map((slide) => (
                      <SortableSlide
                        key={slide.id}
                        slide={slide}
                        isSelected={selectedSlide?.id === slide.id}
                        onSelect={() => setSelectedSlide(slide)}
                        onDelete={() => {
                          setSlideToDelete(slide);
                          setDeleteDialogOpen(true);
                        }}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </CardContent>
          </Card>

          {/* Center - Preview */}
          <Card>
            <CardContent className="p-6">
              {selectedSlide ? (
                <div className="space-y-4">
                  <img
                    src={selectedSlide.content_url}
                    alt={`Slide ${selectedSlide.position}`}
                    className="w-full rounded-lg border"
                  />
                  {selectedSlide.type === 'spread-word' && (
                    <Button onClick={() => setTemplatePickerOpen(true)} className="w-full">
                      <ImageIcon className="h-4 w-4 mr-2" />
                      Pick Interactive Template
                    </Button>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No slide selected
                </div>
              )}
            </CardContent>
          </Card>

          {/* Right Sidebar - Properties */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <h3 className="font-semibold">Slide Properties</h3>
              {selectedSlide ? (
                <div className="space-y-3 text-sm">
                  <div>
                    <div className="text-muted-foreground">Position</div>
                    <div className="font-medium">{selectedSlide.position}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Type</div>
                    <div className="font-medium">{selectedSlide.type === 'spread-word' ? 'Interactive' : 'Image'}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Compressed</div>
                    <div className="font-medium">{selectedSlide.is_compressed ? 'Yes' : 'No'}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Deck</div>
                    <div className="font-medium break-all">{selectedSlide.deck_slug}</div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Select a slide to view properties</div>
              )}
              
              <div className="border-t pt-4 space-y-3 text-sm">
                <h4 className="font-semibold">Deck Usage</h4>
                <div>
                  <div className="text-muted-foreground">Campaign Usage</div>
                  <div className="font-medium">{campaigns.length}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">EoAs Using Deck</div>
                  <div className="font-medium">{eoaCount}</div>
                </div>
                {campaigns.length > 0 && (
                  <div>
                    <div className="text-muted-foreground">Campaigns</div>
                    <div className="font-medium space-y-1">
                      {campaigns.map((campaign, idx) => (
                        <div key={idx} className="truncate" title={campaign}>
                          {campaign}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Slide</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete slide at position {slideToDelete?.position}?
              {slideToDelete?.type === 'spread-word' && (
                <span className="block mt-2 text-destructive">
                  This will also delete the interactive configuration.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Hotspot Editor Dialog */}
      {selectedSlide && hotspotEditorOpen && (
        <Dialog open={hotspotEditorOpen} onOpenChange={setHotspotEditorOpen}>
          <DialogContent className="max-w-[90vw] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Interactive Hotspots</DialogTitle>
            </DialogHeader>
            <FullResolutionHotspotEditor
              imageUrl={selectedSlide.content_url}
              onSave={handleSaveHotspots}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Template Selection Dialog - Add New Slide */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Add Interactive Slide from Template</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 overflow-y-auto flex-1 pr-2">
            {templates.length === 0 ? (
              <div className="col-span-2 text-center py-8 text-muted-foreground">
                No valid templates available. Templates must have at least one hotspot configured.
              </div>
            ) : (
              templates.map((template) => (
                <Card
                  key={template.id}
                  className="cursor-pointer hover:border-primary transition-colors"
                  onClick={() => handleAddInteractiveSlide(template)}
                >
                  <CardContent className="p-4 space-y-2">
                    <div className="relative">
                      <img src={template.image_url} alt={template.name} className="w-full rounded" />
                      <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-1 shadow-lg">
                        <Check className="h-3 w-3" />
                      </div>
                    </div>
                    <div className="font-medium text-sm">{template.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {template.hotspots.length} hotspot(s)
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Template Picker Dialog - Apply to Existing Slide */}
      <Dialog open={templatePickerOpen} onOpenChange={setTemplatePickerOpen}>
        <DialogContent className="max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Pick Interactive Template</DialogTitle>
            <p className="text-sm text-muted-foreground">Choose a template to apply to this slide</p>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 overflow-y-auto flex-1 pr-2">
            {templates.length === 0 ? (
              <div className="col-span-2 text-center py-8 text-muted-foreground">
                No valid templates available. Templates must have at least one hotspot configured.
              </div>
            ) : (
              templates.map((template) => (
                <Card
                  key={template.id}
                  className="cursor-pointer hover:border-primary transition-colors"
                  onClick={() => handleApplyTemplateToSlide(template)}
                >
                  <CardContent className="p-4 space-y-2">
                    <div className="relative">
                      <img src={template.image_url} alt={template.name} className="w-full rounded" />
                      <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-1 shadow-lg">
                        <Check className="h-3 w-3" />
                      </div>
                    </div>
                    <div className="font-medium text-sm">{template.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {template.hotspots.length} hotspot(s)
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Deployment Confirmation Dialog */}
      <DeploymentConfirmDialog
        open={deploymentDialogOpen}
        onOpenChange={setDeploymentDialogOpen}
        onConfirm={handleDeployConfirm}
        eoaCount={eoaCount}
        campaigns={campaigns}
        isDeploying={isDeploying}
      />
    </div>
  );
}
