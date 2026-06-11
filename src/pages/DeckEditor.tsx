import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, Upload, Loader2, Plus, Image as ImageIcon, GripVertical, Check, X, FileText, Copy, MoveVertical, Video, Camera, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from "lucide-react";
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { captureSlideThumbnail } from "@/lib/snapshotCapture";
import { fetchDeckShape, persistDeckShape, probeFirstDims, ratioToOrientation, ratiosMatch, loadImageDims } from "@/lib/deckAspectRatio";
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
import { SlidePreviewOverlay } from "@/components/SlidePreviewOverlay";
import type { Hotspot } from "@/types/viralTemplates";
import { mintL00 } from "@/lib/virality/mint";
import { deriveUtmMedium } from "@/lib/virality/deriveUtmMedium";
import { isAnimatedGif } from "@/lib/gifUtils";
import JSZip from "jszip";
import { FileDown } from "lucide-react";
import { classifyHotspots } from "@/lib/hotspotClassification";
import { Badge } from "@/components/ui/badge";
import { getDeckDeploymentStatus, statusBadgeClasses, statusLabel, formatDeployedTimestamp } from "@/lib/deckStatus";

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
  thumbnail_url?: string; // Captured thumbnail showing hotspot overlays
  image_url_override?: string | null; // Per-slide background override (wins over template default)
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

const SlidePreviewImage = ({
  contentUrl,
  templateImageUrl,
  fallbackUrl,
  altText,
  onDelete,
  aspectClass = 'aspect-[9/16]',
}: {
  contentUrl: string;
  templateImageUrl?: string;
  fallbackUrl?: string;
  altText: string;
  onDelete: () => void;
  aspectClass?: string;
}) => {
  const [failed, setFailed] = useState(false);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  // Reset failure state when the source slide changes
  useEffect(() => {
    setFailed(false);
    setFailedSrc(null);
  }, [contentUrl, templateImageUrl, fallbackUrl]);

  if (failed) {
    // Build a human-readable reason
    const isTemplateBroken = !!templateImageUrl && failedSrc === templateImageUrl;
    const isSameAsTemplate = templateImageUrl && contentUrl === templateImageUrl;
    const reason = isTemplateBroken
      ? "This slide's template background image is missing from storage. Re-upload the template image, or pick a different template."
      : isSameAsTemplate
      ? "The template image this slide uses is missing from storage."
      : "This slide's background image is missing from storage and no fallback is available.";

    return (
      <div className={`w-full ${aspectClass} rounded-lg border bg-muted/30 flex flex-col items-center justify-center gap-4 p-6 text-center`}>
        <ImageIcon className="h-16 w-16 text-muted-foreground" />
        <div className="space-y-2">
          <p className="font-semibold text-foreground">Slide cannot be rendered</p>
          <p className="text-sm text-muted-foreground max-w-md">{reason}</p>
          {failedSrc && (
            <p className="text-xs text-muted-foreground/70 break-all max-w-md">
              Missing: {failedSrc.split('/').pop()}
            </p>
          )}
        </div>
        <Button variant="destructive" size="sm" onClick={onDelete}>
          <Trash2 className="h-4 w-4 mr-2" />
          Delete this slide
        </Button>
      </div>
    );
  }

  return (
    <img
      src={contentUrl}
      alt={altText}
      className="w-full rounded-lg border"
      onError={(e) => {
        const img = e.target as HTMLImageElement;
        if (templateImageUrl && img.src !== templateImageUrl) {
          console.warn(`⚠️ content_url failed, falling back to template image_url`);
          img.src = templateImageUrl;
        } else if (fallbackUrl && img.src !== fallbackUrl) {
          img.src = fallbackUrl;
        } else {
          setFailedSrc(img.src);
          setFailed(true);
        }
      }}
    />
  );
};

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
        {(() => {
          const displayUrl = slide.thumbnail_url || slide.content_url;
          if (displayUrl?.startsWith('solid:')) {
            return <div className="w-full aspect-video" style={{ backgroundColor: displayUrl.replace('solid:', '') }} />;
          }
          return <img src={displayUrl} alt={`Slide ${slide.position}`} className="w-full aspect-video object-contain bg-muted" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />;
        })()}
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
      {(slide.type === 'vimeo' || slide.type === 'video') && (
        <div className="absolute top-1 right-8 bg-accent text-accent-foreground px-2 py-0.5 rounded text-xs font-medium">
          {slide.type === 'vimeo' ? 'Vimeo' : 'Video'}
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
  // Locked target slide for the hotspot editor — separate from selectedSlide so
  // navigating slides (or auto-capture races) can't retarget a save.
  const [hotspotEditorSlide, setHotspotEditorSlide] = useState<Slide | null>(null);
  // Slide ids that need a thumbnail capture once their per-slide config exists
  // (set when auto-capture would otherwise write to a shared template row).
  const [pendingThumbnailCaptureIds, setPendingThumbnailCaptureIds] = useState<Set<string>>(new Set());
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
  const [affectedEoas, setAffectedEoas] = useState<Array<{ id: string; title: string; utm_id: string | null }>>([]);
  const [deckMeta, setDeckMeta] = useState<{ last_deployed_at: string | null; last_modified_at: string | null } | null>(null);
  const [saveAsDialogOpen, setSaveAsDialogOpen] = useState(false);
  const [newDeckSlug, setNewDeckSlug] = useState('');
  const [savingAs, setSavingAs] = useState(false);
  const [saveAsError, setSaveAsError] = useState('');
  const [propertiesCollapsed, setPropertiesCollapsed] = useState(false);
  const [slidesPanelCollapsed, setSlidesPanelCollapsed] = useState(false);
  const [selectedSlideIds, setSelectedSlideIds] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkMoveDialogOpen, setBulkMoveDialogOpen] = useState(false);
  const [bulkMoveTarget, setBulkMoveTarget] = useState('');
  const [vimeoDialogOpen, setVimeoDialogOpen] = useState(false);
  const [vimeoUrl, setVimeoUrl] = useState('');
  const [vimeoPosterFile, setVimeoPosterFile] = useState<File | null>(null);
  const [vimeoPosterPreview, setVimeoPosterPreview] = useState<string | null>(null);
  const [initialHotspots, setInitialHotspots] = useState<any[]>([]);
  const [loadingHotspots, setLoadingHotspots] = useState(false);
  const [capturingThumbnail, setCapturingThumbnail] = useState(false);
  const [previewHotspots, setPreviewHotspots] = useState<Hotspot[]>([]);
  const [deckOrientation, setDeckOrientation] = useState<'portrait' | 'landscape' | 'square'>('portrait');
  const [deckAspectRatio, setDeckAspectRatio] = useState<number | null>(null);
  // "Save as Template" dialog state
  const [saveAsTemplateDialogOpen, setSaveAsTemplateDialogOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateSlugInput, setNewTemplateSlugInput] = useState('');
  const [newTemplateDescription, setNewTemplateDescription] = useState('');
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  // Background override state
  const [overrideUploading, setOverrideUploading] = useState(false);
  const overrideFileInputRef = useRef<HTMLInputElement>(null);

  // Resolve deck shape (aspect ratio + orientation) ONCE from the deck row.
  // If the row has no recorded value yet, probe the first available image and
  // persist it back so every subsequent load is deterministic.
  useEffect(() => {
    if (!slug) return;
    if (!slides || slides.length === 0) return;
    let cancelled = false;

    (async () => {
      const stored = await fetchDeckShape(slug);
      if (cancelled) return;
      if (stored) {
        setDeckAspectRatio(stored.aspectRatio);
        setDeckOrientation(stored.orientation === 'square' ? 'landscape' : stored.orientation);
        return;
      }

      // No stored shape — probe the first slide in display order.
      const ordered = [...slides].sort((a, b) => a.position - b.position);
      const urls: (string | null | undefined)[] = [];
      for (const s of ordered) {
        urls.push(s.content_url);
        urls.push(s.thumbnail_url);
        if (s.template_id) {
          const t = templates.find(t => t.id === s.template_id);
          urls.push(t?.image_url);
        }
      }
      const dims = await probeFirstDims(urls);
      if (cancelled || !dims) return;
      const ratio = dims.w / dims.h;
      const orientation = ratioToOrientation(ratio);
      setDeckAspectRatio(ratio);
      setDeckOrientation(orientation === 'square' ? 'landscape' : orientation);
      // Fire-and-forget persist; ignore errors (e.g. anon viewer).
      persistDeckShape(slug, { aspectRatio: ratio, orientation }).catch(() => {});
    })();

    return () => { cancelled = true; };
  }, [slug, slides, templates]);
  // Use the deck's exact aspect ratio when known; otherwise approximate from orientation.
  const aspectClass = deckAspectRatio
    ? '' // inline style handles it below
    : (deckOrientation === 'landscape' ? 'aspect-video' : 'aspect-[9/16]');
  const aspectStyle = deckAspectRatio ? { aspectRatio: String(deckAspectRatio) } : undefined;
  const previewRef = useRef<HTMLImageElement>(null);
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

  // Load preview hotspots when selected slide changes
  useEffect(() => {
    if (!selectedSlide || selectedSlide.type !== 'spread-word') {
      setPreviewHotspots([]);
      return;
    }
    // Priority 1: staged changes
    if (hotspotChanges[selectedSlide.id]) {
      setPreviewHotspots(hotspotChanges[selectedSlide.id] as Hotspot[]);
      return;
    }
    // Priority 2: fetch from DB
    const fetchPreviewHotspots = async () => {
      try {
        const { data: perSlideConfig } = await supabase
          .from('viral_slide_configs')
          .select('hotspots')
          .eq('slide_id', selectedSlide.id)
          .maybeSingle();
        if (perSlideConfig?.hotspots && Array.isArray(perSlideConfig.hotspots)) {
          setPreviewHotspots(perSlideConfig.hotspots as unknown as Hotspot[]);
          return;
        }
        if (selectedSlide.template_id) {
          const { data: templateConfig } = await supabase
            .from('viral_slide_configs')
            .select('hotspots')
            .eq('id', selectedSlide.template_id)
            .maybeSingle();
          if (templateConfig?.hotspots && Array.isArray(templateConfig.hotspots)) {
            setPreviewHotspots(templateConfig.hotspots as unknown as Hotspot[]);
            return;
          }
        }
        setPreviewHotspots([]);
      } catch {
        setPreviewHotspots([]);
      }
    };
    fetchPreviewHotspots();
  }, [selectedSlide?.id, selectedSlide?.type, hotspotChanges]);

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
        .select('*, viral_slide_configs!slide_items_template_id_fkey(thumbnail_url)')
        .eq('deck_slug', slug)
        .order('position');

      if (error) throw error;

      // Map thumbnail_url from joined config onto the slide
      const slidesWithThumbnails = (data || []).map((s: any) => ({
        ...s,
        thumbnail_url: s.viral_slide_configs?.thumbnail_url || null,
        viral_slide_configs: undefined, // Clean up joined data
      }));

      setOriginalSlides(slidesWithThumbnails);
      setSlides(slidesWithThumbnails);
      if (slidesWithThumbnails.length > 0) {
        // Preserve the user's current selection across reloads. Resetting to
        // the first slide here silently switched the preview DOM mid-flight,
        // which caused the post-save thumbnail capture to write slide 1's
        // preview into the previously-selected slide's thumbnail file.
        setSelectedSlide((prev) => {
          if (!prev) return slidesWithThumbnails[0];
          const stillThere = slidesWithThumbnails.find((s: any) => s.id === prev.id);
          return stillThere || slidesWithThumbnails[0];
        });
        // Get reference dimensions from first slide
        const img = new Image();
        img.onload = () => {
          setReferenceDimensions({ width: img.width, height: img.height });
        };
        img.src = slidesWithThumbnails[0].content_url;
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
        .select('id, title, utm_id, campaign_id, campaigns(title)')
        .eq('assigned_deck_slug', slug);

      if (error) throw error;

      setEoaCount(eoas?.length || 0);
      
      // Store affected EoAs for deployment (utm_id drives derived channel medium)
      setAffectedEoas(eoas?.map((eoa: any) => ({ 
        id: eoa.id, 
        title: eoa.title,
        utm_id: eoa.utm_id ?? null,
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

      // Fetch deck deploy/modify timestamps for status badge
      const { data: deckRow } = await supabase
        .from('decks')
        .select('last_deployed_at, last_modified_at')
        .eq('slug', slug)
        .maybeSingle();
      if (deckRow) {
        setDeckMeta({
          last_deployed_at: (deckRow as any).last_deployed_at ?? null,
          last_modified_at: (deckRow as any).last_modified_at ?? null,
        });
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

    // Dimension validation: enforce ASPECT RATIO match against the deck's recorded shape.
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = async () => {
        const imgRatio = img.width / img.height;

        // If the deck already has a recorded aspect ratio, reject anything that doesn't match (±2%).
        if (deckAspectRatio) {
          if (!ratiosMatch(imgRatio, deckAspectRatio, 2)) {
            const deckLabel = deckAspectRatio.toFixed(3);
            const imgLabel = imgRatio.toFixed(3);
            resolve({
              valid: false,
              error: `This slide is ${img.width}×${img.height} (ratio ${imgLabel}) but the deck is ratio ${deckLabel}. All slides in a deck must share the same aspect ratio.`,
            });
            return;
          }
        }

        // Pixel-level resize against an existing reference (kept for backward compatibility).
        if (referenceDimensions) {
          const widthTolerance = referenceDimensions.width * 0.01;
          const heightTolerance = referenceDimensions.height * 0.01;
          const widthInRange = Math.abs(img.width - referenceDimensions.width) <= widthTolerance;
          const heightInRange = Math.abs(img.height - referenceDimensions.height) <= heightTolerance;
          if (widthInRange && heightInRange) {
            resolve({ valid: true, dimensions: { width: img.width, height: img.height } });
            return;
          }

          // Skip resize for GIFs to preserve animation
          if (file.type === 'image/gif') {
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
              resizedFile,
            });
          } catch (error) {
            console.error('Error resizing image:', error);
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

  // Classification helpers - imported from shared utility

  const loadHotspotsForSlide = async (slide: Slide) => {
    // Priority 1: staged changes
    if (hotspotChanges[slide.id]) {
      setInitialHotspots(hotspotChanges[slide.id]);
      return;
    }
    
    setLoadingHotspots(true);
    try {
      // Priority 2: per-slide config
      const { data: perSlideConfig } = await supabase
        .from('viral_slide_configs')
        .select('hotspots')
        .eq('slide_id', slide.id)
        .maybeSingle();
      
      if (perSlideConfig?.hotspots && Array.isArray(perSlideConfig.hotspots) && perSlideConfig.hotspots.length > 0) {
        setInitialHotspots(perSlideConfig.hotspots);
        return;
      }

      // Priority 3: shared template
      if (slide.template_id) {
        const { data: templateConfig } = await supabase
          .from('viral_slide_configs')
          .select('hotspots')
          .eq('id', slide.template_id)
          .maybeSingle();
        
        if (templateConfig?.hotspots && Array.isArray(templateConfig.hotspots)) {
          setInitialHotspots(templateConfig.hotspots);
          return;
        }
      }

      setInitialHotspots([]);
    } catch (error) {
      console.error('Error loading hotspots:', error);
      setInitialHotspots([]);
    } finally {
      setLoadingHotspots(false);
    }
  };

  const handleOpenHotspotEditor = async (slide: Slide) => {
    setSelectedSlide(slide);
    setHotspotEditorSlide(slide);
    await loadHotspotsForSlide(slide);
    setHotspotEditorOpen(true);
  };

  const handleCaptureThumbnail = async (slide: Slide) => {
    if (!slide.template_id && slide.type !== 'spread-word') {
      toast.error('Only interactive slides can have thumbnails captured');
      return;
    }

    // Need to find the template_id — either from the slide or from a per-slide config
    let configId = slide.template_id;
    if (!configId) {
      const { data } = await supabase
        .from('viral_slide_configs')
        .select('id')
        .eq('slide_id', slide.id)
        .maybeSingle();
      configId = data?.id;
    }
    if (!configId) {
      console.log('Skipping thumbnail capture — no template config yet for this slide');
      return;
    }

    // Guard: never overwrite a SHARED template's thumbnail from a deck slide edit.
    // Shared templates (viral_slide_configs rows with slide_id IS NULL) are used by
    // many slides — writing here would make every sibling slide display this slide's
    // preview. Per-slide configs always have slide_id set.
    const { data: configRow } = await supabase
      .from('viral_slide_configs')
      .select('slide_id')
      .eq('id', configId)
      .maybeSingle();
    if (configRow && configRow.slide_id === null) {
      console.log(
        `Skipping thumbnail capture — config ${configId} is a shared template ` +
        `(slide_id IS NULL). Capture will run after a per-slide config is created.`
      );
      // Mark slide as needing capture once its per-slide config exists.
      setPendingThumbnailCaptureIds(prev => {
        const next = new Set(prev);
        next.add(slide.id);
        return next;
      });
      return;
    }

    // Safety guard: the preview DOM only renders selectedSlide. If we'd
    // capture a DIFFERENT slide than what the preview is showing, we'd
    // upload the wrong image into this slide's thumbnail file.
    if (selectedSlide?.id !== slide.id) {
      console.warn(
        `[thumbnail capture] Aborting — preview shows ${selectedSlide?.id}, ` +
        `but capture was requested for ${slide.id}.`
      );
      return;
    }

    // Find the preview image element's parent container
    const previewContainer = document.querySelector('[data-slide-preview]') as HTMLElement;
    if (!previewContainer) {
      toast.error('Preview element not found');
      return;
    }

    setCapturingThumbnail(true);
    try {
      const thumbnailUrl = await captureSlideThumbnail(
        configId,
        previewContainer,
        slide.content_url.startsWith('solid:') ? slide.content_url.replace('solid:', '') : undefined
      );
      
      // Update the slide in local state
      setSlides(prev => prev.map(s => 
        s.id === slide.id ? { ...s, thumbnail_url: thumbnailUrl } : s
      ));
      if (selectedSlide?.id === slide.id) {
        setSelectedSlide(prev => prev ? { ...prev, thumbnail_url: thumbnailUrl } : prev);
      }
      
      toast.success('Thumbnail captured successfully');
    } catch (error: any) {
      console.error('Thumbnail capture error:', error);
      toast.error(`Failed to capture thumbnail: ${error.message}`);
    } finally {
      setCapturingThumbnail(false);
    }
  };

  const handleSaveHotspots = async (hotspots: any[]) => {
    // Use the LOCKED editor target, not selectedSlide — the user may have clicked
    // a different slide in the sidebar while the dialog was open.
    const target = hotspotEditorSlide ?? selectedSlide;
    if (!target) return;

    // Store hotspot changes for later
    setHotspotChanges({ ...hotspotChanges, [target.id]: hotspots });

    // Auto-classify and update draft slide type
    const { slideType } = classifyHotspots(hotspots);
    setSlides(prev => prev.map(s =>
      s.id === target.id ? { ...s, type: slideType } : s
    ));

    // Update preview hotspots immediately (only if the preview still shows this slide)
    if (selectedSlide?.id === target.id) {
      setPreviewHotspots(hotspots as Hotspot[]);
    }

    setHasChanges(true);
    setHotspotEditorOpen(false);
    setHotspotEditorSlide(null);
    toast.success('Hotspot changes staged');

    // Auto-capture thumbnail after overlay renders. The guard inside
    // handleCaptureThumbnail will defer this if the slide is still on a
    // shared template (no per-slide config yet) — capture will run after
    // global Save Changes creates the per-slide config row.
    if (slideType === 'spread-word' && hotspots.length > 0) {
      const slideForCapture = { ...target, type: slideType };
      setTimeout(() => {
        handleCaptureThumbnail(slideForCapture);
      }, 600);
    }
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

  // === Save current slide as a reusable Template ===
  const openSaveAsTemplateDialog = () => {
    if (!selectedSlide) return;
    // Suggest a name from the slide's filename
    let suggested = `Slide ${selectedSlide.position}`;
    try {
      const url = new URL(selectedSlide.content_url);
      const filename = url.pathname.split('/').pop() || '';
      const cleaned = decodeURIComponent(filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')).trim();
      if (cleaned) suggested = cleaned;
    } catch {}
    setNewTemplateName(suggested);
    setNewTemplateSlugInput(
      suggested.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
        || `slide-${Date.now()}`
    );
    setNewTemplateDescription('');
    setSaveAsTemplateDialogOpen(true);
  };

  const handleSaveAsTemplate = async () => {
    if (!selectedSlide || !slug) return;
    const name = newTemplateName.trim();
    const templateSlug = newTemplateSlugInput.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
    if (!name || !templateSlug) {
      toast.error('Name and slug are required');
      return;
    }
    if (!selectedSlide.content_url) {
      toast.error('Slide has no background image to promote');
      return;
    }
    if (selectedSlide.id.startsWith('temp-')) {
      toast.error('Save the deck first, then promote this slide to a template');
      return;
    }

    setCreatingTemplate(true);
    try {
      // Check slug uniqueness
      const { data: existing } = await supabase
        .from('viral_slide_configs')
        .select('id')
        .eq('slug', templateSlug)
        .maybeSingle();
      if (existing) {
        toast.error('A template with this slug already exists');
        setCreatingTemplate(false);
        return;
      }

      const stagedHotspots = (hotspotChanges[selectedSlide.id] ?? []) as any[];
      const { templateType } = classifyHotspots(stagedHotspots);

      const { data: created, error: insertError } = await supabase
        .from('viral_slide_configs')
        .insert({
          name,
          slug: templateSlug,
          description: newTemplateDescription.trim() || null,
          image_url: selectedSlide.content_url,
          hotspots: stagedHotspots as any,
          template_type: templateType,
          slide_id: null, // shared template, not a per-slide config
        })
        .select('id, name, slug, image_url, hotspots, is_default, template_type, thumbnail_url')
        .single();

      if (insertError) throw insertError;

      // Link this slide to the new template
      const { error: updateError } = await supabase
        .from('slide_items')
        .update({ template_id: created.id, type: 'spread-word' })
        .eq('id', selectedSlide.id);
      if (updateError) throw updateError;

      // Update local state
      setTemplates(prev => [...prev, created as any]);
      setSlides(prev => prev.map(s =>
        s.id === selectedSlide.id
          ? { ...s, template_id: created.id, type: 'spread-word' }
          : s
      ));
      setSelectedSlide({ ...selectedSlide, template_id: created.id, type: 'spread-word' });
      setSaveAsTemplateDialogOpen(false);
      toast.success(`Saved "${name}" to the Template Repository`);
    } catch (err: any) {
      console.error('Save as Template failed:', err);
      toast.error(err?.message || 'Failed to save template');
    } finally {
      setCreatingTemplate(false);
    }
  };

  // === Per-slide background override ===
  const handleUploadBackgroundOverride = async (file: File) => {
    if (!selectedSlide || !slug) return;
    if (selectedSlide.id.startsWith('temp-')) {
      toast.error('Save the deck first, then override this slide\'s background');
      return;
    }
    setOverrideUploading(true);
    try {
      const ext = file.type === 'image/png' ? 'png' : file.type === 'image/gif' ? 'gif' : 'jpg';
      const fileName = `${slug}/override-${selectedSlide.id}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('slides')
        .upload(fileName, file, { contentType: file.type, upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('slides').getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('slide_items')
        .update({ image_url_override: publicUrl })
        .eq('id', selectedSlide.id);
      if (updateError) throw updateError;

      setSlides(prev => prev.map(s =>
        s.id === selectedSlide.id ? { ...s, image_url_override: publicUrl } : s
      ));
      setSelectedSlide({ ...selectedSlide, image_url_override: publicUrl });
      toast.success('Background override saved');
    } catch (err: any) {
      console.error('Background override upload failed:', err);
      toast.error(err?.message || 'Failed to upload background override');
    } finally {
      setOverrideUploading(false);
      if (overrideFileInputRef.current) overrideFileInputRef.current.value = '';
    }
  };

  const handleResetBackgroundOverride = async () => {
    if (!selectedSlide) return;
    if (!selectedSlide.image_url_override) return;
    try {
      const { error } = await supabase
        .from('slide_items')
        .update({ image_url_override: null })
        .eq('id', selectedSlide.id);
      if (error) throw error;
      setSlides(prev => prev.map(s =>
        s.id === selectedSlide.id ? { ...s, image_url_override: null } : s
      ));
      setSelectedSlide({ ...selectedSlide, image_url_override: null });
      toast.success('Background reset to template default');
    } catch (err: any) {
      console.error('Reset override failed:', err);
      toast.error(err?.message || 'Failed to reset background');
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
    if (hasChanges) {
      const confirmed = window.confirm('Discard unsaved changes and exit?');
      if (!confirmed) return;
      setSlides([...originalSlides]);
      setPendingUploads([]);
      setPendingDeletes([]);
      setHotspotChanges({});
      setHasChanges(false);
      setSelectedSlideIds(new Set());
      toast.info('Changes discarded');
    }
    // Return to the page that invoked the editor
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/deck-management');
    }
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
              media_url: (tempSlide as any).media_url || null,
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

      // 4. Handle hotspot changes with auto-classification
      for (const [slideId, hotspots] of Object.entries(hotspotChanges)) {
        // Map temp ID to real ID if applicable
        const realSlideId = slideId.startsWith('temp-') ? tempSlideIdMap[slideId] : slideId;
        
        if (!realSlideId) {
          console.warn(`No real slide ID found for temp ID: ${slideId}`);
          continue;
        }

        const { slideType, templateType } = classifyHotspots(hotspots as any[]);

        // Auto-demote: empty hotspots → revert to image
        if (slideType === 'image') {
          // Delete per-slide config (never shared templates)
          await supabase
            .from('viral_slide_configs')
            .delete()
            .eq('slide_id', realSlideId)
            .not('slide_id', 'is', null);
          
          // Revert slide to image
          await supabase
            .from('slide_items')
            .update({ type: 'image', template_id: null })
            .eq('id', realSlideId);
          
          continue;
        }

        // Promote or update: has hotspots → spread-word
        await supabase
          .from('slide_items')
          .update({ type: 'spread-word' })
          .eq('id', realSlideId);

        const { data: existingConfig } = await supabase
          .from('viral_slide_configs')
          .select('id')
          .eq('slide_id', realSlideId)
          .maybeSingle();

        if (existingConfig) {
          await supabase
            .from('viral_slide_configs')
            .update({ hotspots, template_type: templateType })
            .eq('id', existingConfig.id);
        } else {
          // Create per-slide config
          const { data: slideData } = await supabase
            .from('slide_items')
            .select('position, content_url, template_id')
            .eq('id', realSlideId)
            .single();

          if (slideData) {
            // If slide had a shared template, use its image_url as fallback
            let imageUrl = slideData.content_url;
            
            const { data: newConfig } = await supabase
              .from('viral_slide_configs')
              .insert({
                slide_id: realSlideId,
                deck_slug: slug,
                name: `Slide ${slideData.position}`,
                slug: `${slug}-slide-${slideData.position}-${Date.now()}`,
                image_url: imageUrl,
                hotspots,
                template_type: templateType,
              } as any)
              .select('id')
              .single();
            
            // Link the new per-slide config to the slide
            if (newConfig) {
              await supabase
                .from('slide_items')
                .update({ template_id: newConfig.id })
                .eq('id', realSlideId);

              // If a thumbnail capture was deferred (because the slide was on
              // a shared template), run it now against the new per-slide config.
              if (pendingThumbnailCaptureIds.has(realSlideId) && selectedSlide?.id === realSlideId) {
                const slideForCapture = {
                  ...selectedSlide,
                  template_id: newConfig.id,
                  type: 'spread-word' as const,
                };
                setTimeout(() => handleCaptureThumbnail(slideForCapture as Slide), 400);
                setPendingThumbnailCaptureIds(prev => {
                  const next = new Set(prev);
                  next.delete(realSlideId);
                  return next;
                });
              }
            }
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

      // Remember which slides had hotspot edits so we can refresh their
      // thumbnails after fetchSlides() reloads the per-slide config rows.
      // Only the currently-selected slide is rendered in the preview DOM,
      // so we can only auto-capture that one — but that covers the common
      // case of editing a slide and immediately saving.
      const editedSlideIds = new Set(
        Object.keys(hotspotChanges).map((sid) =>
          sid.startsWith('temp-') ? tempSlideIdMap[sid] : sid
        ).filter(Boolean)
      );
      const selectedSlideEdited = selectedSlide && editedSlideIds.has(selectedSlide.id);

      setPendingUploads([]);
      setPendingDeletes([]);
      setHotspotChanges({});
      setHasChanges(false);
      await fetchSlides();

      // Post-save thumbnail refresh: re-capture the currently-selected slide
      // if its hotspots were edited. Guarantees the sidebar thumbnail matches
      // the freshly-saved hotspot data, even when the in-editor auto-capture
      // missed (e.g. user staged changes earlier and saved later).
      if (selectedSlideEdited && selectedSlide) {
        // Look up the now-current slide row (fetchSlides may have refreshed template_id)
        setTimeout(async () => {
          const { data: refreshed } = await supabase
            .from('slide_items')
            .select('id, type, template_id, content_url, position')
            .eq('id', selectedSlide.id)
            .maybeSingle();
          if (refreshed && refreshed.type === 'spread-word') {
            handleCaptureThumbnail({
              ...selectedSlide,
              ...refreshed,
            } as Slide);
          }
        }, 800);
      }
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
            utmMedium: deriveUtmMedium(eoa)
          });
          successCount++;
        } catch (error) {
          console.error(`Failed to mint token for EoA ${eoa.id}:`, error);
          failCount++;
        }
      }

      // Stamp deck.last_deployed_at on success so per-deck status reflects this deploy.
      if (successCount > 0) {
        const { error: stampError } = await supabase
          .from('decks')
          .update({ last_deployed_at: new Date().toISOString() })
          .eq('slug', slug);
        if (stampError) {
          console.error('Failed to stamp deck last_deployed_at:', stampError);
        }

        toast.success(
          `Deployed! ${successCount} event${successCount !== 1 ? 's' : ''} updated. Existing QR codes keep working.`,
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
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/deck-management">Deck Management</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="text-lg font-semibold">{slug}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          {(() => {
            const { status, lastDeployedAt } = getDeckDeploymentStatus({
              last_deployed_at: deckMeta?.last_deployed_at ?? null,
              last_modified_at: deckMeta?.last_modified_at ?? null,
              hasUsage: hasDeployedTokens || eoaCount > 0,
            });
            return (
              <Badge
                className={statusBadgeClasses(status)}
                title={lastDeployedAt ? `Last deployed: ${formatDeployedTimestamp(lastDeployedAt)}` : undefined}
              >
                {statusLabel(status)}
                {status === 'live' && lastDeployedAt && (
                  <span className="ml-1 opacity-80">• {formatDeployedTimestamp(lastDeployedAt)}</span>
                )}
              </Badge>
            );
          })()}
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
              disabled={saving}
            >
              {hasChanges ? 'Cancel/Exit' : 'Exit'}
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
        <div className={`grid grid-cols-1 gap-6 flex-1 min-h-0 ${slidesPanelCollapsed ? 'lg:grid-cols-[48px_1fr_220px]' : 'lg:grid-cols-[300px_1fr_220px]'}`}>
          {/* Left Sidebar - Slide Thumbnails */}
          <Card className="overflow-hidden h-full">
            <CardContent className={`h-full ${slidesPanelCollapsed ? 'p-2 flex flex-col items-center' : 'p-4 space-y-4 overflow-y-auto'}`}>
              <div className="flex items-center justify-between mb-2">
                {!slidesPanelCollapsed && <h3 className="font-semibold">Slides</h3>}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSlidesPanelCollapsed(v => !v)}
                  aria-label={slidesPanelCollapsed ? "Expand Slides Panel" : "Collapse Slides Panel"}
                  className="h-7 w-7 p-0"
                >
                  {slidesPanelCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </Button>
              </div>
              {!slidesPanelCollapsed && (
              <>
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
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => document.getElementById('zip-upload')?.click()}
                    disabled={uploading}
                  >
                    <FileDown className="h-4 w-4 mr-2" />
                    Import ZIP
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setVimeoDialogOpen(true)}
                    disabled={uploading}
                  >
                    <Video className="h-4 w-4 mr-2" />
                    Vimeo
                  </Button>
                </div>
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
              )}
            </CardContent>
          </Card>

          {/* Center - Preview */}
          <Card className="h-full overflow-hidden">
            <CardContent className="p-6 overflow-y-auto h-full">
              {selectedSlide ? (
                <div className="space-y-4">
                  <div className="relative" data-slide-preview>
                    {(() => {
                      // Per-slide background override takes precedence over both
                      // the slide's own content_url and the linked template's image.
                      const overrideUrl = selectedSlide.image_url_override || undefined;
                      const contentUrl = overrideUrl || selectedSlide.content_url;
                      if (contentUrl?.startsWith('solid:')) {
                        return <div className={`w-full ${aspectClass} rounded-lg border`} style={{ backgroundColor: contentUrl.replace('solid:', ''), ...(aspectStyle || {}) }} />;
                      }
                      const templateImageUrl = selectedSlide.template_id
                        ? templates.find(t => t.id === selectedSlide.template_id)?.image_url
                        : undefined;
                      return (
                        <SlidePreviewImage
                          contentUrl={contentUrl}
                          templateImageUrl={templateImageUrl}
                          fallbackUrl={selectedSlide.thumbnail_url}
                          altText={`Slide ${selectedSlide.position}`}
                          aspectClass={aspectClass}
                          onDelete={() => {
                            setSlideToDelete(selectedSlide);
                            setDeleteDialogOpen(true);
                          }}
                        />
                      );
                    })()}
                    {/* Hotspot preview overlay for interactive slides */}
                    {selectedSlide.type === 'spread-word' && previewHotspots.length > 0 && (
                      <SlidePreviewOverlay hotspots={previewHotspots} />
                    )}
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
          <Card className={propertiesCollapsed ? "overflow-hidden" : "h-full overflow-hidden"}>
            <CardContent className={propertiesCollapsed ? "p-4" : "p-4 space-y-4 overflow-y-auto h-full"}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Slide Properties</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPropertiesCollapsed(v => !v)}
                  aria-label={propertiesCollapsed ? "Expand Slide Properties" : "Collapse Slide Properties"}
                  className="h-7 w-7 p-0"
                >
                  {propertiesCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                </Button>
              </div>
              {!propertiesCollapsed && (selectedSlide ? (
                <div className="space-y-3 text-sm">
                  <div>
                    <div className="text-muted-foreground">Name</div>
                    <div className="font-medium truncate" title={(() => {
                      if (selectedSlide.template_id) {
                        const t = templates.find(tp => tp.id === selectedSlide.template_id);
                        return t?.name || 'Interactive Slide';
                      }
                      if (selectedSlide.type === 'vimeo' || selectedSlide.type === 'video') return 'Video Slide';
                      try {
                        const url = new URL(selectedSlide.content_url);
                        const filename = url.pathname.split('/').pop() || 'Slide';
                        return decodeURIComponent(filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '));
                      } catch {
                        return `Slide ${selectedSlide.position}`;
                      }
                    })()}>
                      {(() => {
                        if (selectedSlide.template_id) {
                          const t = templates.find(tp => tp.id === selectedSlide.template_id);
                          return t?.name || 'Interactive Slide';
                        }
                        if (selectedSlide.type === 'vimeo' || selectedSlide.type === 'video') return 'Video Slide';
                        try {
                          const url = new URL(selectedSlide.content_url);
                          const filename = url.pathname.split('/').pop() || 'Slide';
                          return decodeURIComponent(filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '));
                        } catch {
                          return `Slide ${selectedSlide.position}`;
                        }
                      })()}
                    </div>
                  </div>
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
                  
                  {/* Edit Hotspots — available for any slide type */}
                  {selectedSlide.type !== 'vimeo' && selectedSlide.type !== 'video' && (
                    <div className="pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        disabled={loadingHotspots}
                        onClick={() => handleOpenHotspotEditor(selectedSlide)}
                      >
                        {loadingHotspots ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4 mr-2" />
                        )}
                        Edit Hotspots
                      </Button>
                    </div>
                  )}
                  
                  {/* Capture Thumbnail — available for spread-word slides */}
                  {selectedSlide.type === 'spread-word' && !selectedSlide.id.startsWith('temp-') && (
                    <div className="pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        disabled={capturingThumbnail}
                        onClick={() => handleCaptureThumbnail(selectedSlide)}
                      >
                        {capturingThumbnail ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Camera className="h-4 w-4 mr-2" />
                        )}
                        Capture Thumbnail
                      </Button>
                    </div>
                  )}

                  {/* Save as Template — only for plain image slides not yet linked to a template */}
                  {!selectedSlide.template_id
                    && selectedSlide.type !== 'vimeo'
                    && selectedSlide.type !== 'video'
                    && selectedSlide.type !== 'spread-word'
                    && !selectedSlide.id.startsWith('temp-')
                    && !selectedSlide.content_url?.startsWith('solid:') && (
                    <div className="pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={openSaveAsTemplateDialog}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Save as Template…
                      </Button>
                      <p className="text-xs text-muted-foreground mt-1">
                        Promote this slide into the Template Repository so other decks can reuse it.
                      </p>
                    </div>
                  )}

                  {/* Background — per-slide override for template-linked slides */}
                  {selectedSlide.template_id && !selectedSlide.id.startsWith('temp-') && (() => {
                    const linkedTemplate = templates.find(t => t.id === selectedSlide.template_id);
                    const templateType = linkedTemplate?.template_type;
                    const isSnapshotType = templateType === 'stats_page' || templateType === 'hybrid';
                    const hasOverride = !!selectedSlide.image_url_override;
                    return (
                      <div className="pt-3 border-t space-y-2">
                        <div className="text-muted-foreground font-medium">Background</div>
                        <p className="text-xs text-muted-foreground">
                          Hotspots come from the template. Background is specific to this slide.
                        </p>
                        {hasOverride && (
                          <div className="rounded border p-2 bg-muted/30">
                            <div className="text-xs text-muted-foreground mb-1">Current override:</div>
                            <img
                              src={selectedSlide.image_url_override!}
                              alt="Background override"
                              className="w-full max-h-32 object-contain rounded"
                            />
                          </div>
                        )}
                        <input
                          ref={overrideFileInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleUploadBackgroundOverride(f);
                          }}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          disabled={overrideUploading || isSnapshotType}
                          title={isSnapshotType
                            ? "Background override isn't available yet for slides with live metrics — the pre-rendered snapshot would still show the template's default background."
                            : undefined}
                          onClick={() => overrideFileInputRef.current?.click()}
                        >
                          {overrideUploading ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4 mr-2" />
                          )}
                          {hasOverride ? 'Replace override' : 'Upload override'}
                        </Button>
                        {hasOverride && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full"
                            disabled={overrideUploading}
                            onClick={handleResetBackgroundOverride}
                          >
                            <X className="h-4 w-4 mr-2" />
                            Reset to template default
                          </Button>
                        )}
                        {isSnapshotType && (
                          <p className="text-xs text-muted-foreground">
                            Live-metrics templates don't support per-slide background overrides yet.
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Select a slide to view properties</div>
              ))}
              {!propertiesCollapsed && (

              
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
              )}
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

      {/* Hotspot Editor Dialog — bound to hotspotEditorSlide (locked target), not selectedSlide */}
      {hotspotEditorSlide && hotspotEditorOpen && (
        <Dialog
          open={hotspotEditorOpen}
          onOpenChange={(open) => {
            // Block dismissal — user must click Save & Close or Discard Changes
            if (!open) return;
            setHotspotEditorOpen(open);
          }}
        >
          <DialogContent
            className="max-w-[90vw] max-h-[90vh] overflow-y-auto [&>button.absolute]:hidden"
            onPointerDownOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => e.preventDefault()}
            onInteractOutside={(e) => e.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle>Edit Interactive Hotspots</DialogTitle>
            </DialogHeader>
            <FullResolutionHotspotEditor
              imageUrl={hotspotEditorSlide.image_url_override || hotspotEditorSlide.content_url}
              initialHotspots={initialHotspots}
              onChange={(hotspots) => {
                if (selectedSlide?.id === hotspotEditorSlide.id) {
                  setPreviewHotspots(hotspots as Hotspot[]);
                }
              }}
              onSave={handleSaveHotspots}
              onCancel={() => {
                if (selectedSlide?.id === hotspotEditorSlide.id) {
                  setPreviewHotspots(initialHotspots as Hotspot[]);
                }
                setHotspotEditorOpen(false);
                setHotspotEditorSlide(null);
              }}
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
        deckSlug={slug}
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

      {/* Save as Template Dialog */}
      <Dialog open={saveAsTemplateDialogOpen} onOpenChange={(open) => { if (!creatingTemplate) setSaveAsTemplateDialogOpen(open); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Slide as Template</DialogTitle>
            <DialogDescription>
              This adds the slide's current background (and any hotspots) to the Template Repository, and links this slide to the new template so future template edits also update this slide.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-template-name">Name</Label>
              <Input
                id="new-template-name"
                value={newTemplateName}
                onChange={(e) => {
                  const v = e.target.value;
                  setNewTemplateName(v);
                  // Keep slug in sync until the user has manually edited it
                  setNewTemplateSlugInput(prev => {
                    const auto = v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
                    return auto;
                  });
                }}
                placeholder="e.g. Thomas Luttig Intro"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-template-slug">Slug</Label>
              <Input
                id="new-template-slug"
                value={newTemplateSlugInput}
                onChange={(e) => setNewTemplateSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                placeholder="thomas-luttig-intro"
              />
              <p className="text-xs text-muted-foreground">Lowercase, alphanumeric and hyphens only. Must be unique.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-template-desc">Description (optional)</Label>
              <Input
                id="new-template-desc"
                value={newTemplateDescription}
                onChange={(e) => setNewTemplateDescription(e.target.value)}
                placeholder="Where and how this template is meant to be used"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveAsTemplateDialogOpen(false)} disabled={creatingTemplate}>
              Cancel
            </Button>
            <Button onClick={handleSaveAsTemplate} disabled={creatingTemplate || !newTemplateName.trim() || !newTemplateSlugInput.trim()}>
              {creatingTemplate ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving…
                </>
              ) : (
                'Save Template'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Vimeo Dialog */}
      <Dialog open={vimeoDialogOpen} onOpenChange={(open) => {
        setVimeoDialogOpen(open);
        if (!open) { setVimeoUrl(''); setVimeoPosterFile(null); setVimeoPosterPreview(null); }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Vimeo Slide</DialogTitle>
            <DialogDescription>
              Provide a Vimeo URL and a poster image. The poster displays in the carousel; tapping play opens a full-screen video overlay.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="vimeo-url">Vimeo URL</Label>
              <Input
                id="vimeo-url"
                value={vimeoUrl}
                onChange={(e) => setVimeoUrl(e.target.value)}
                placeholder="https://vimeo.com/123456789"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vimeo-poster">Poster Image</Label>
              <Input
                id="vimeo-poster"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setVimeoPosterFile(file);
                    setVimeoPosterPreview(URL.createObjectURL(file));
                  }
                }}
              />
              {vimeoPosterPreview && (
                <img src={vimeoPosterPreview} alt="Poster preview" className="w-full aspect-video object-contain bg-muted rounded" />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVimeoDialogOpen(false)}>Cancel</Button>
            <Button
              disabled={!vimeoUrl.trim() || !vimeoPosterFile}
              onClick={async () => {
                if (!vimeoPosterFile || !slug) return;
                // Validate Vimeo URL
                const vimeoPattern = /vimeo\.com\/(?:channels\/[\w-]+\/)?(\d+)|player\.vimeo\.com\/video\/(\d+)/;
                if (!vimeoPattern.test(vimeoUrl)) {
                  toast.error('Invalid Vimeo URL. Please use a standard vimeo.com link.');
                  return;
                }
                // Create temp slide with poster as blob URL and media_url
                const nextPos = slides.length > 0 ? Math.max(...slides.map(s => s.position)) + 1 : 1;
                const posterUrl = URL.createObjectURL(vimeoPosterFile);
                const tempSlide: Slide = {
                  id: `temp-vimeo-${Date.now()}`,
                  position: nextPos,
                  type: 'vimeo',
                  content_url: posterUrl,
                  is_compressed: false,
                  deck_slug: slug,
                  skip_deploy: false,
                  media_url: vimeoUrl,
                };
                setSlides(prev => [...prev, tempSlide]);
                setPendingUploads(prev => [...prev, { file: vimeoPosterFile, position: nextPos }]);
                setHasChanges(true);
                setVimeoDialogOpen(false);
                setVimeoUrl('');
                setVimeoPosterFile(null);
                setVimeoPosterPreview(null);
                toast.success('Vimeo slide added. Save to persist.');
              }}
            >
              Add Vimeo Slide
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
