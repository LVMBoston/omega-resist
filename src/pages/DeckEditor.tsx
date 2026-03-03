import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Trash2, Upload, Loader2, Plus, Image as ImageIcon, GripVertical, Check, X, FileText, Copy, MoveVertical, Video } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import imageCompression from "browser-image-compression";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FullResolutionHotspotEditor } from "@/components/FullResolutionHotspotEditor";
import { DeploymentConfirmDialog } from "@/components/DeploymentConfirmDialog";
import { mintL00 } from "@/lib/virality/mint";
import { isAnimatedGif } from "@/lib/gifUtils";
import JSZip from "jszip";
import { FileDown } from "lucide-react";

interface Slide {
  id: string;
  position: number;
  type: string;
  content_url: string;
  is_compressed: boolean;
  template_id?: string;
  deck_slug: string;
  skip_deploy: boolean;
  media_url?: string;
}

interface Template {
  id: string;
  name: string;
  slug: string;
  image_url: string;
  thumbnail_url?: string;
  hotspots: any;
  is_default: boolean;
  template_type?: string;
}

interface ViralConfig {
  id: string;
  slide_id: string;
  hotspots: any;
}

const SortableSlide = ({ slide, onSelect, onDelete, isSelected, isChecked, onToggleCheck, isSkipped, onToggleSkip, templateInfo }: { slide: Slide; onSelect: () => void; onDelete: () => void; isSelected: boolean; isChecked: boolean; onToggleCheck: () => void; isSkipped: boolean; onToggleSkip: () => void; templateInfo?: { name: string; isDataTemplate: boolean; backgroundType: string; hotspotCount: number } }) => {
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
      
      {/* Checkbox + Position badge — placed above drag handle z-index */}
      <div className="absolute top-1 left-1 flex items-center gap-1 z-20">
        <div
          onClick={(e) => { e.stopPropagation(); onToggleCheck(); }}
          onPointerDown={(e) => e.stopPropagation()}
          className="cursor-pointer p-0.5"
        >
          <Checkbox checked={isChecked} className="h-4 w-4 bg-background/90 border-muted-foreground" />
        </div>
        <div className="bg-background/90 px-2 py-0.5 rounded text-xs font-medium">
          {slide.position}
        </div>
      </div>
      {slide.type === 'spread-word' && (
        <div className="absolute top-1 right-8 flex flex-col items-end gap-0.5">
          <div className={`px-2 py-0.5 rounded text-xs font-medium max-w-[140px] truncate ${
            templateInfo?.isDataTemplate ? 'bg-green-500 text-white' : 'bg-blue-500 text-white'
          }`}>
            {templateInfo?.name || (slide.template_id ? 'Interactive' : 'Legacy')}
          </div>
          {templateInfo?.isDataTemplate && (
            <div className="bg-green-600/80 text-white px-1.5 py-0.5 rounded text-[10px]">
              {templateInfo.backgroundType} | {templateInfo.hotspotCount} hotspot{templateInfo.hotspotCount !== 1 ? 's' : ''}
            </div>
          )}
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
      {slide.content_url.toLowerCase().endsWith('.gif') && (
        <div className="absolute bottom-1 left-1 bg-purple-600 text-white px-1.5 py-0.5 rounded text-[10px] font-bold">
          GIF
        </div>
      )}
      {/* Skip Deploy toggle — right side */}
      <div
        className="absolute top-1/2 -translate-y-1/2 right-1 z-20"
        onClick={(e) => { e.stopPropagation(); onToggleSkip(); }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <Checkbox
          checked={isSkipped}
          className={`h-4 w-4 border-muted-foreground ${isSkipped ? 'bg-destructive border-destructive data-[state=checked]:bg-destructive data-[state=checked]:text-destructive-foreground' : 'bg-background/90'}`}
        />
      </div>
      {isSkipped && (
        <div className="absolute inset-0 bg-background/50 pointer-events-none flex items-center justify-center">
          <span className="bg-destructive text-destructive-foreground text-xs font-bold px-2 py-0.5 rounded">SKIP</span>
        </div>
      )}
    </div>
  );
};

const isValidTemplate = (template: Template): boolean => {
  if (!template.image_url) return false;
  
  // Allow templates with no hotspots (display-only)
  if (!template.hotspots || template.hotspots.length === 0) return true;
  
  // If has hotspots, validate they're properly configured
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
  const [saveAsDialogOpen, setSaveAsDialogOpen] = useState(false);
  const [newDeckSlug, setNewDeckSlug] = useState('');
  const [savingAs, setSavingAs] = useState(false);
  const [saveAsError, setSaveAsError] = useState('');
  const [selectedSlideIds, setSelectedSlideIds] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkMoveDialogOpen, setBulkMoveDialogOpen] = useState(false);
  const [bulkMoveTarget, setBulkMoveTarget] = useState('');
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
      const validTemplates = (data || []).filter(isValidTemplate);
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
    const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return { valid: false, error: 'Only PNG, JPG, GIF, and WebP images are allowed' };
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

          // TEMPORARILY DISABLED: Aspect ratio validation check
          // Check aspect ratio tolerance (7%)
          // const imageAspectRatio = img.width / img.height;
          // const referenceAspectRatio = referenceDimensions.width / referenceDimensions.height;
          // const aspectRatioDiff = Math.abs(imageAspectRatio - referenceAspectRatio) / referenceAspectRatio;
          
          // console.log('🔍 Aspect Ratio Validation:', {
          //   imageAspectRatio: imageAspectRatio.toFixed(4),
          //   referenceAspectRatio: referenceAspectRatio.toFixed(4),
          //   difference: (aspectRatioDiff * 100).toFixed(2) + '%',
          //   tolerance: '7%',
          //   willPass: aspectRatioDiff <= 0.07
          // });
          
          // Bypass aspect ratio check - resize automatically regardless of ratio
          // Skip resize for GIFs to preserve animation
          if (file.type === 'image/gif') {
            console.log('🎬 Skipping resize for GIF to preserve animation');
            const animated = await isAnimatedGif(file);
            if (!animated) {
              console.warn('⚠️ Static GIF detected - consider using PNG for better compression');
            }
            resolve({ valid: true, dimensions: { width: img.width, height: img.height } });
            return;
          }
          try {
            const resizedFile = await resizeImage(file, referenceDimensions.width, referenceDimensions.height);
            resolve({ 
              valid: true, 
              dimensions: { width: referenceDimensions.width, height: referenceDimensions.height },
              resizedFile
            });
          } catch (error) {
            console.error('Error resizing image:', error);
            // Even if resize fails, allow the image through
            console.warn('⚠️ Resize failed, using original image');
            resolve({ valid: true, dimensions: { width: img.width, height: img.height } });
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
    const isGif = fileToUpload.type === 'image/gif';
    const tempSlide: Slide = {
      id: tempId,
      position: targetPosition,
      type: 'image',
      content_url: URL.createObjectURL(fileToUpload),
      is_compressed: !isGif, // GIFs are never compressed
      deck_slug: slug!,
      skip_deploy: false,
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

  const handleZipImport = async (file: File) => {
    if (!slug) return;
    setUploading(true);
    try {
      const zip = await JSZip.loadAsync(file);
      const imageEntries = Object.entries(zip.files)
        .filter(([name]) => /\.(png|jpg|jpeg|gif|webp)$/i.test(name) && !name.startsWith('__MACOSX'))
        .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

      if (imageEntries.length === 0) {
        toast.error('No image files found in ZIP');
        return;
      }

      const mimeMap: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };
      const newTempSlides: Slide[] = [];
      const newPendingUploads: { file: File | Blob; position?: number }[] = [];

      // Determine starting position from current slides state
      let nextPosition = slides.length > 0 ? Math.max(...slides.map(s => s.position)) + 1 : 1;

      for (const [name, entry] of imageEntries) {
        const blob = await entry.async('blob');
        const ext = name.split('.').pop()?.toLowerCase() || 'png';
        let imageFile: File | Blob = new File([blob], name.split('/').pop() || name, { type: mimeMap[ext] || 'image/png' });

        const validation = await validateImage(imageFile);
        if (!validation.valid) {
          console.warn(`Skipping ${name}: ${validation.error}`);
          continue;
        }
        const fileToUpload = validation.resizedFile || imageFile;
        const isGif = fileToUpload.type === 'image/gif';

        const tempSlide: Slide = {
          id: `temp-${Date.now()}-${nextPosition}`,
          position: nextPosition,
          type: 'image',
          content_url: URL.createObjectURL(fileToUpload),
          is_compressed: !isGif,
          deck_slug: slug!,
          skip_deploy: false,
        };

        newTempSlides.push(tempSlide);
        newPendingUploads.push({ file: fileToUpload });
        nextPosition++;
      }

      if (newTempSlides.length === 0) {
        toast.error('No valid images found in ZIP');
        return;
      }

      // Batch-update state once so nothing gets overwritten
      setSlides(prev => [...prev, ...newTempSlides].sort((a, b) => a.position - b.position));
      setPendingUploads(prev => [...prev, ...newPendingUploads]);
      setHasChanges(true);
      toast.success(`${newTempSlides.length} slide${newTempSlides.length !== 1 ? 's' : ''} imported from ZIP`);
    } catch (error) {
      console.error('ZIP import error:', error);
      toast.error('Failed to import ZIP file');
    } finally {
      setUploading(false);
    }
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
      // Check if this is a solid color background (no image to validate)
      const isSolidColor = template.image_url.startsWith('solid:');
      
      if (!isSolidColor) {
        // Download template image for validation only
        const response = await fetch(template.image_url);
        const blob = await response.blob();

        const validation = await validateImage(blob);
        if (!validation.valid) {
          toast.error(validation.error);
          return;
        }
      }

      const targetPosition = slides.length > 0 ? Math.max(...slides.map(s => s.position)) + 1 : 1;
      const tempId = `temp-template-${Date.now()}`;
      
      // Create temp slide - NO upload needed, use template's content_url directly
      const tempSlide: Slide = {
        id: tempId,
        position: targetPosition,
        type: 'spread-word',
        content_url: template.image_url, // Use template's URL directly
        is_compressed: false,
        template_id: template.id,
        deck_slug: slug,
        skip_deploy: false,
      };

      setSlides([...slides, tempSlide]);
      // DO NOT add to pendingUploads - template already has a valid content_url
      setHotspotChanges({ ...hotspotChanges, [tempId]: template.hotspots });
      setHasChanges(true);
      setTemplateDialogOpen(false);
      toast.success('Interactive slide staged');
    } catch (error: any) {
      console.error('Error adding interactive slide:', error);
      toast.error('Failed to add interactive slide');
    }
  };

  const openSaveAsDialog = () => {
    setNewDeckSlug(`${slug}-copy`);
    setSaveAsError('');
    setSaveAsDialogOpen(true);
  };

  const handleSaveAs = async () => {
    if (!slug) return;

    // Validate slug format
    const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    const trimmedSlug = newDeckSlug.trim().toLowerCase();
    if (!slugPattern.test(trimmedSlug)) {
      setSaveAsError('Slug must be lowercase alphanumeric with hyphens only');
      return;
    }
    if (trimmedSlug === slug) {
      setSaveAsError('New slug must be different from the current slug');
      return;
    }

    setSavingAs(true);
    setSaveAsError('');

    try {
      // Check if slug already exists
      const { data: existing } = await supabase
        .from('decks')
        .select('slug')
        .eq('slug', trimmedSlug)
        .maybeSingle();

      if (existing) {
        setSaveAsError('A deck with this slug already exists');
        setSavingAs(false);
        return;
      }

      // Create the new deck
      const { error: deckError } = await supabase
        .from('decks')
        .insert({ slug: trimmedSlug });

      if (deckError) throw deckError;

      // Copy slides from DB (originalSlides), not draft state
      for (const slide of originalSlides) {
        const { data: newSlide, error: slideError } = await supabase
          .from('slide_items')
          .insert({
            deck_slug: trimmedSlug,
            position: slide.position,
            type: slide.type,
            content_url: slide.content_url,
            is_compressed: slide.is_compressed,
            template_id: slide.template_id || null,
          })
          .select()
          .single();

        if (slideError) throw slideError;

        // Copy viral_slide_configs if the slide has one
        if (newSlide) {
          const { data: config } = await supabase
            .from('viral_slide_configs')
            .select('*')
            .eq('slide_id', slide.id)
            .maybeSingle();

          if (config) {
            await supabase
              .from('viral_slide_configs')
              .insert({
                slide_id: newSlide.id,
                deck_slug: trimmedSlug,
                name: config.name,
                slug: `${trimmedSlug}-slide-${newSlide.position}`,
                image_url: config.image_url,
                hotspots: config.hotspots,
                config: config.config,
                template_type: config.template_type,
                description: config.description,
                thumbnail_url: config.thumbnail_url,
              } as any);
          }
        }
      }

      setSaveAsDialogOpen(false);
      toast.success(`Deck duplicated as "${trimmedSlug}"`);
      navigate(`/deck-editor/${trimmedSlug}`);
    } catch (error: any) {
      console.error('Save As error:', error);
      setSaveAsError(error.message || 'Failed to duplicate deck');
    } finally {
      setSavingAs(false);
    }
  };

  const handleCancel = () => {
    setSlides([...originalSlides]);
    setPendingUploads([]);
    setPendingDeletes([]);
    setHotspotChanges({});
    setHasChanges(false);
    setSelectedSlideIds(new Set());
    toast.info('Changes discarded');
  };

  const toggleSlideCheck = (slideId: string) => {
    setSelectedSlideIds(prev => {
      const next = new Set(prev);
      if (next.has(slideId)) next.delete(slideId);
      else next.add(slideId);
      return next;
    });
  };

  const handleBulkDelete = () => {
    const toDelete = slides.filter(s => selectedSlideIds.has(s.id));
    const nonTemp = toDelete.filter(s => !s.id.startsWith('temp-'));
    setPendingDeletes(prev => [...prev, ...nonTemp]);

    const remaining = slides
      .filter(s => !selectedSlideIds.has(s.id))
      .map((s, idx) => ({ ...s, position: idx + 1 }));

    setSlides(remaining);
    setHasChanges(true);
    setSelectedSlideIds(new Set());
    setBulkDeleteDialogOpen(false);
    if (selectedSlide && selectedSlideIds.has(selectedSlide.id)) {
      setSelectedSlide(remaining[0] || null);
    }
    toast.success(`${toDelete.length} slide(s) marked for deletion`);
  };

  const handleBulkMove = () => {
    const target = parseInt(bulkMoveTarget, 10);
    if (isNaN(target) || target < 1 || target > slides.length) {
      toast.error(`Position must be between 1 and ${slides.length}`);
      return;
    }
    const selected = slides.filter(s => selectedSlideIds.has(s.id));
    const rest = slides.filter(s => !selectedSlideIds.has(s.id));
    // Insert selected block at target-1 index
    const insertIdx = Math.min(target - 1, rest.length);
    rest.splice(insertIdx, 0, ...selected);
    const reordered = rest.map((s, idx) => ({ ...s, position: idx + 1 }));
    setSlides(reordered);
    setHasChanges(true);
    setSelectedSlideIds(new Set());
    setBulkMoveDialogOpen(false);
    setBulkMoveTarget('');
    toast.success(`Moved ${selected.length} slide(s) to position ${target}`);
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

      // 2. Update all existing slide positions FIRST (use temporary positions to avoid conflicts)
      const realSlides = slides.filter(s => !s.id.startsWith('temp-'));
      
      // First, shift all to temporary high positions to avoid unique constraint violations
      for (let i = 0; i < realSlides.length; i++) {
        await supabase
          .from('slide_items')
          .update({ position: i + 10000 })
          .eq('id', realSlides[i].id);
      }
      
      // Then update to final positions and skip_deploy
      for (let i = 0; i < realSlides.length; i++) {
        await supabase
          .from('slide_items')
          .update({ position: realSlides[i].position, skip_deploy: (realSlides[i] as any).skip_deploy ?? false })
          .eq('id', realSlides[i].id);
      }

      // 3. Handle temp slides - split into two paths
      const tempSlideIdMap: { [tempId: string]: string } = {}; // Map temp IDs to real IDs
      
      // Path A: Template-based temp slides (no upload needed)
      const templateTempSlides = slides.filter(s => s.id.startsWith('temp-template-'));
      for (const tempSlide of templateTempSlides) {
        const { data: newSlide, error: insertError } = await supabase
          .from('slide_items')
          .insert({
            deck_slug: slug,
            position: tempSlide.position,
            content_url: tempSlide.content_url, // Use template's URL directly
            type: tempSlide.type,
            is_compressed: false,
            template_id: tempSlide.template_id, // Preserve template_id
          })
          .select()
          .single();

        if (insertError) {
          console.error('Error creating template slide record:', insertError);
          throw insertError;
        }

        if (newSlide) {
          tempSlideIdMap[tempSlide.id] = newSlide.id;
        }
      }
      
      // Path B: Uploaded temp slides (need file upload)
      const processedTempIds = new Set<string>();
      for (const { file, position } of pendingUploads) {
        const isGif = file.type === 'image/gif';
        
        // Skip compression for GIFs to preserve animation
        const uploadBlob = isGif 
          ? file 
          : await compressImage(file instanceof File ? file : new File([file], 'uploaded.png', { type: file.type }));
        
        // Find an unprocessed temp slide that's NOT a template slide
        const tempSlide = slides.find(s => 
          s.id.startsWith('temp-') && 
          !s.id.startsWith('temp-template-') && 
          !processedTempIds.has(s.id)
        );
        
        if (!tempSlide) {
          console.warn('Could not find unprocessed temp slide for upload');
          continue;
        }
        
        processedTempIds.add(tempSlide.id);
        const targetPos = tempSlide.position;
        
        // Determine file extension based on MIME type
        const fileExtension = file.type === 'image/png' ? 'png' 
          : file.type === 'image/gif' ? 'gif' 
          : 'jpg';
        const fileName = `${slug}/${targetPos.toString().padStart(3, "0")}-${Date.now()}.${fileExtension}`;
        
        const { data: uploadData } = await supabase.storage.from('slides').upload(fileName, uploadBlob, {
          contentType: file.type,
          upsert: true,
        });

        if (uploadData) {
          const { data: { publicUrl } } = supabase.storage.from('slides').getPublicUrl(fileName);
          
          // Create a new slide_items record
          const { data: newSlide, error: insertError } = await supabase
            .from('slide_items')
            .insert({
              deck_slug: slug,
              position: targetPos,
              content_url: publicUrl,
              type: tempSlide.type,
              is_compressed: !isGif, // GIFs are never compressed
              template_id: tempSlide.template_id,
            })
            .select()
            .single();

          if (insertError) {
            console.error('Error creating slide record:', insertError);
            throw insertError;
          }

          if (newSlide) {
            tempSlideIdMap[tempSlide.id] = newSlide.id;
          }
        }
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
    <div className="h-screen bg-background p-6 flex flex-col overflow-hidden">
      <div className="max-w-[1800px] mx-auto flex flex-col flex-1 min-h-0 w-full gap-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-shrink-0">
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
              variant="outline"
              onClick={openSaveAsDialog}
              disabled={saving || savingAs}
            >
              <Copy className="h-4 w-4 mr-2" />
              Save As
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
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr_220px] gap-6 flex-1 min-h-0">
          {/* Left Sidebar - Slide Thumbnails */}
          <Card className="overflow-hidden h-full">
            <CardContent className="p-4 space-y-4 overflow-y-auto h-full">
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => document.getElementById('file-upload')?.click()}
                    disabled={uploading}
                  >
                    <Upload className="h-4 w-4 mr-2" />
Add Slide(s)
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
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => document.getElementById('zip-upload')?.click()}
                  disabled={uploading}
                >
                  <FileDown className="h-4 w-4 mr-2" />
                  Import ZIP
                </Button>
                <input
                  id="zip-upload"
                  type="file"
                  accept=".zip"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      await handleZipImport(file);
                      e.target.value = '';
                    }
                  }}
                />
              </div>
              <input
                id="file-upload"
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                multiple
                className="hidden"
                onChange={async (e) => {
                  const files = Array.from(e.target.files || []);
                  if (files.length === 0) return;
                  e.target.value = '';

                  if (files.length === 1) {
                    await handleImageUpload(files[0]);
                    return;
                  }

                  // Batch multiple files (same pattern as handleZipImport)
                  const newTempSlides: Slide[] = [];
                  const newPendingUploads: { file: File | Blob; position?: number }[] = [];
                  let basePosition = slides.length > 0 ? Math.max(...slides.map(s => s.position)) + 1 : 1;
                  let skipped = 0;

                  for (const file of files) {
                    const validation = await validateImage(file);
                    if (!validation.valid) {
                      console.warn(`Skipped ${file.name}: ${validation.error}`);
                      skipped++;
                      continue;
                    }
                    const fileToUpload = validation.resizedFile || file;
                    const isGif = fileToUpload.type === 'image/gif';
                    const tempSlide: Slide = {
                      id: `temp-${Date.now()}-${newTempSlides.length}`,
                      position: basePosition + newTempSlides.length,
                      type: 'image',
                      content_url: URL.createObjectURL(fileToUpload),
                      is_compressed: !isGif,
                      deck_slug: slug!,
                      skip_deploy: false,
                    };
                    newTempSlides.push(tempSlide);
                    newPendingUploads.push({ file: fileToUpload });
                  }

                  if (newTempSlides.length > 0) {
                    setSlides(prev => [...prev, ...newTempSlides].sort((a, b) => a.position - b.position));
                    setPendingUploads(prev => [...prev, ...newPendingUploads]);
                    setHasChanges(true);
                    toast.success(`${newTempSlides.length} slide(s) staged for upload${skipped ? ` (${skipped} skipped)` : ''}`);
                  } else {
                    toast.error('No valid images found in selection');
                  }
                }}
              />
              <div className="text-xs text-muted-foreground text-center">
                Paste images (Ctrl+V) or drag to reorder
              </div>

              {/* Select All / Bulk Toolbar */}
              {slides.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div
                      onClick={() => {
                        if (selectedSlideIds.size === slides.length) {
                          setSelectedSlideIds(new Set());
                        } else {
                          setSelectedSlideIds(new Set(slides.map(s => s.id)));
                        }
                      }}
                      className="cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedSlideIds.size === slides.length && slides.length > 0}
                        className="h-4 w-4"
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {selectedSlideIds.size > 0 ? `${selectedSlideIds.size} selected` : 'Select all'}
                    </span>
                  </div>
                  {selectedSlideIds.size > 0 && (
                    <div className="flex gap-1">
                      <Button variant="destructive" size="sm" className="flex-1 h-7 text-xs" onClick={() => setBulkDeleteDialogOpen(true)}>
                        <Trash2 className="h-3 w-3 mr-1" />
                        Delete ({selectedSlideIds.size})
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1 h-7 text-xs" onClick={() => { setBulkMoveTarget(''); setBulkMoveDialogOpen(true); }}>
                        <MoveVertical className="h-3 w-3 mr-1" />
                        Move to…
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => setSelectedSlideIds(new Set())}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              )}

              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={slides.map(s => s.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {slides.map((slide) => (
                      <SortableSlide
                        key={slide.id}
                        slide={slide}
                        isSelected={selectedSlide?.id === slide.id}
                        isChecked={selectedSlideIds.has(slide.id)}
                        onToggleCheck={() => toggleSlideCheck(slide.id)}
                        isSkipped={slide.skip_deploy}
                        onToggleSkip={() => {
                          setSlides(prev => prev.map(s => s.id === slide.id ? { ...s, skip_deploy: !s.skip_deploy } : s));
                          setHasChanges(true);
                        }}
                        onSelect={() => setSelectedSlide(slide)}
                        onDelete={() => {
                          setSlideToDelete(slide);
                          setDeleteDialogOpen(true);
                        }}
                        templateInfo={(() => {
                          if (!slide.template_id) return undefined;
                          const t = templates.find(tp => tp.id === slide.template_id);
                          if (!t) return undefined;
                          const isData = t.template_type === 'stats_page';
                          return {
                            name: t.name || 'Interactive',
                            isDataTemplate: isData,
                            backgroundType: t.image_url?.startsWith('solid:') ? 'Solid Color' : 'Image',
                            hotspotCount: Array.isArray(t.hotspots) ? t.hotspots.length : 0,
                          };
                        })()}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </CardContent>
          </Card>

          {/* Center - Preview */}
          <Card className="h-full overflow-hidden">
            <CardContent className="p-6 overflow-y-auto h-full">
              {selectedSlide ? (
                <div className="space-y-4">
                  <div className="relative">
                    <img
                      src={selectedSlide.content_url}
                      alt={`Slide ${selectedSlide.position}`}
                      className="w-full rounded-lg border"
                    />
                    {selectedSlide.content_url.toLowerCase().endsWith('.gif') && (
                      <div className="absolute top-2 right-2 bg-purple-600 text-white text-xs font-bold px-2 py-1 rounded">
                        GIF
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No slide selected
                </div>
              )}
            </CardContent>
          </Card>

          {/* Right Sidebar - Properties */}
          <Card className="h-full overflow-hidden">
            <CardContent className="p-4 space-y-4 overflow-y-auto h-full">
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
                
                {campaigns.length > 0 && (
                  <div className="pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-campaign-pdf?campaign=${encodeURIComponent(campaigns[0])}`;
                        window.open(url, '_blank');
                      }}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Generate PDF Report
                    </Button>
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
            <DialogTitle>Add Slide from Template</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 overflow-y-auto flex-1 pr-2">
            {templates.length === 0 ? (
              <div className="col-span-2 text-center py-8 text-muted-foreground">
                No valid templates available.
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
                      {(template.thumbnail_url || template.image_url || '').startsWith('solid:') ? (
                        <div 
                          className="w-full rounded aspect-[9/16]" 
                          style={{ backgroundColor: (template.thumbnail_url || template.image_url || '').replace('solid:', '') }}
                        />
                      ) : (
                        <img src={template.thumbnail_url || template.image_url} alt={template.name || ''} className="w-full rounded" />
                      )}
                      <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-1 shadow-lg">
                        <Check className="h-3 w-3" />
                      </div>
                    </div>
                    <div className="font-medium text-sm">{template.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {template.hotspots && template.hotspots.length > 0 
                        ? `${template.hotspots.length} hotspot(s)` 
                        : 'Display only'}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedSlideIds.size} Slide{selectedSlideIds.size !== 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove {selectedSlideIds.size} slide{selectedSlideIds.size !== 1 ? 's' : ''} from the deck.
              {slides.filter(s => selectedSlideIds.has(s.id) && s.type === 'spread-word').length > 0 && (
                <span className="block mt-2 text-destructive">
                  Some selected slides are interactive — their configurations will also be deleted.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Move Dialog */}
      <Dialog open={bulkMoveDialogOpen} onOpenChange={setBulkMoveDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Move {selectedSlideIds.size} Slide{selectedSlideIds.size !== 1 ? 's' : ''}</DialogTitle>
            <DialogDescription>
              Move selected slides as a group to a target position (1–{slides.length}).
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label htmlFor="bulk-move-pos">Target Position</Label>
            <Input
              id="bulk-move-pos"
              type="number"
              min={1}
              max={slides.length}
              value={bulkMoveTarget}
              onChange={(e) => setBulkMoveTarget(e.target.value)}
              placeholder="e.g. 1"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkMoveDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkMove} disabled={!bulkMoveTarget}>Move</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <DeploymentConfirmDialog
        open={deploymentDialogOpen}
        onOpenChange={setDeploymentDialogOpen}
        onConfirm={handleDeployConfirm}
        eoaCount={eoaCount}
        campaigns={campaigns}
        isDeploying={isDeploying}
      />

      {/* Save As Dialog */}
      <Dialog open={saveAsDialogOpen} onOpenChange={setSaveAsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Deck As</DialogTitle>
            <DialogDescription>
              {hasChanges
                ? 'Only the last saved version will be copied. Unsaved changes will not be included.'
                : 'Create a duplicate of this deck under a new slug.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-slug">New Deck Slug</Label>
              <Input
                id="new-slug"
                value={newDeckSlug}
                onChange={(e) => {
                  setNewDeckSlug(e.target.value.toLowerCase().replace(/\s/g, '-'));
                  setSaveAsError('');
                }}
                placeholder="my-new-deck"
              />
              {saveAsError && (
                <p className="text-sm text-destructive">{saveAsError}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveAsDialogOpen(false)} disabled={savingAs}>
              Cancel
            </Button>
            <Button onClick={handleSaveAs} disabled={savingAs || !newDeckSlug.trim()}>
              {savingAs ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Duplicating...
                </>
              ) : (
                'Duplicate Deck'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
