import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { useEffect } from "react";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { sanitizeManualHtml } from "@/lib/manualEntryHtml";

interface ManualEntryEditorProps {
  html: string;
  onChange: (html: string, plain: string) => void;
  /** When true, popover wrappers should disable pointer-drag passthrough. */
  compact?: boolean;
}

/**
 * Small rich-text editor for manual-entry hotspots.
 *
 * Output: sanitized HTML stored in `hotspot.manualHtml`. We also emit a plain
 * text fallback so callers can keep `hotspot.manualLabel` in sync for older
 * code paths (snapshot fallback, copy/alt text).
 */
export function ManualEntryEditor({ html, onChange, compact }: ManualEntryEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // We don't need headings/blockquote/code in this small editor.
        heading: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        code: false,
      }),
      TextAlign.configure({ types: ["paragraph"] }),
    ],
    content: html || "<p></p>",
    onUpdate: ({ editor }) => {
      const dirty = editor.getHTML();
      const clean = sanitizeManualHtml(dirty);
      const plain = editor.getText();
      onChange(clean, plain);
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none min-h-[80px] max-h-[200px] overflow-y-auto rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring",
      },
    },
  });

  // Keep editor content in sync when the underlying hotspot changes (e.g. user
  // selects a different hotspot in the side panel).
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (current !== (html || "<p></p>")) {
      editor.commands.setContent(html || "<p></p>", { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html]);

  if (!editor) return null;

  const stop = (e: React.PointerEvent | React.MouseEvent) => e.stopPropagation();

  return (
    <div
      className="space-y-1.5"
      onPointerDown={stop}
      onMouseDown={stop}
      onDragStart={(e) => e.preventDefault()}
    >
      <div className="flex flex-wrap gap-0.5 rounded-md border border-input bg-muted/30 p-1">
        <Toggle
          size="sm"
          pressed={editor.isActive("bold")}
          onPressedChange={() => editor.chain().focus().toggleBold().run()}
          aria-label="Bold"
          className="h-6 w-6 p-0"
        >
          <Bold className="h-3 w-3" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive("italic")}
          onPressedChange={() => editor.chain().focus().toggleItalic().run()}
          aria-label="Italic"
          className="h-6 w-6 p-0"
        >
          <Italic className="h-3 w-3" />
        </Toggle>
        <span className="mx-1 w-px self-stretch bg-border" />
        <Toggle
          size="sm"
          pressed={editor.isActive("bulletList")}
          onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
          aria-label="Bullet list"
          className="h-6 w-6 p-0"
        >
          <List className="h-3 w-3" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive("orderedList")}
          onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
          aria-label="Numbered list"
          className="h-6 w-6 p-0"
        >
          <ListOrdered className="h-3 w-3" />
        </Toggle>
        <span className="mx-1 w-px self-stretch bg-border" />
        <Toggle
          size="sm"
          pressed={editor.isActive({ textAlign: "left" })}
          onPressedChange={() => editor.chain().focus().setTextAlign("left").run()}
          aria-label="Align left"
          className="h-6 w-6 p-0"
        >
          <AlignLeft className="h-3 w-3" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive({ textAlign: "center" })}
          onPressedChange={() => editor.chain().focus().setTextAlign("center").run()}
          aria-label="Align center"
          className="h-6 w-6 p-0"
        >
          <AlignCenter className="h-3 w-3" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive({ textAlign: "right" })}
          onPressedChange={() => editor.chain().focus().setTextAlign("right").run()}
          aria-label="Align right"
          className="h-6 w-6 p-0"
        >
          <AlignRight className="h-3 w-3" />
        </Toggle>
      </div>
      <EditorContent editor={editor} />
      {compact ? null : (
        <p className="text-[10px] text-muted-foreground">
          Text auto-shrinks to fit the box on the slide. Bold, italic, lists, and
          alignment render in both the live viewer and saved snapshots.
        </p>
      )}
    </div>
  );
}
