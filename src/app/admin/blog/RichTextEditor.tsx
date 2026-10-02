"use client";

import Image from "@tiptap/extension-image";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type { EditorView } from "@tiptap/pm/view";
import { useRef, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

// Uploads an image to the public "blog" bucket and returns its URL.
async function uploadImage(file: File): Promise<string> {
  const supabase = createClient();
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("blog")
    .upload(path, file, { contentType: file.type, cacheControl: "31536000" });
  if (error) throw error;
  return supabase.storage.from("blog").getPublicUrl(path).data.publicUrl;
}

// Google-Docs-style editor: headings, bold/italic, links, lists, quotes and
// images. Images can be picked, dropped or pasted; they upload to Supabase
// Storage. Calls onChange with the post's HTML.
export function RichTextEditor({
  initialContent,
  onChange,
}: {
  initialContent: string;
  onChange: (html: string) => void;
}) {
  const [uploading, setUploading] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Works on the ProseMirror view so the drop and paste handlers, which are
  // set up before the editor exists, can use it too.
  const insertImages = async (view: EditorView, files: File[], pos?: number) => {
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) return false;
    setUploadError(null);
    setUploading((n) => n + images.length);
    for (const file of images) {
      try {
        const src = await uploadImage(file);
        const image = view.state.schema.nodes.image.create({ src });
        const tr =
          pos !== undefined
            ? view.state.tr.insert(Math.min(pos, view.state.doc.content.size), image)
            : view.state.tr.replaceSelectionWith(image);
        view.dispatch(tr);
        view.focus();
      } catch {
        setUploadError(`${file.name} didn't upload.`);
      } finally {
        setUploading((n) => n - 1);
      }
    }
    return true;
  };

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        codeBlock: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
      }),
      Image,
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: "post-body min-h-80 py-4 focus:outline-none",
      },
      handleDrop: (view, event) => {
        const files = Array.from(event.dataTransfer?.files ?? []);
        if (!files.some((f) => f.type.startsWith("image/"))) return false;
        event.preventDefault();
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        void insertImages(view, files, pos);
        return true;
      },
      handlePaste: (view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []);
        if (!files.some((f) => f.type.startsWith("image/"))) return false;
        event.preventDefault();
        void insertImages(view, files);
        return true;
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });
  if (!editor) return <div className="min-h-80 border-y border-line" />;

  return (
    <div className="flex flex-col">
      <Toolbar editor={editor} onImages={(files) => insertImages(editor.view, files)} />
      <div className="border-b border-line">
        <EditorContent editor={editor} />
      </div>
      {uploading > 0 && <p className="pt-2 text-sm text-muted">Uploading {uploading} image(s)…</p>}
      {uploadError && <p className="pt-2 text-sm text-danger">{uploadError}</p>}
    </div>
  );
}

function Toolbar({ editor, onImages }: { editor: Editor; onImages: (files: File[]) => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const active = useEditorState({
    editor,
    selector: ({ editor }) => ({
      h2: editor.isActive("heading", { level: 2 }),
      h3: editor.isActive("heading", { level: 3 }),
      bold: editor.isActive("bold"),
      italic: editor.isActive("italic"),
      link: editor.isActive("link"),
      bullets: editor.isActive("bulletList"),
      numbers: editor.isActive("orderedList"),
      quote: editor.isActive("blockquote"),
    }),
  });

  const setLink = () => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link to", previous ?? "https://");
    if (url === null) return;
    if (url === "") editor.chain().focus().extendMarkRange("link").unsetLink().run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  return (
    <div className="sticky top-0 z-10 flex flex-wrap gap-1 border-y border-line bg-background py-2">
      <ToolButton label="Heading" active={active.h2} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        H2
      </ToolButton>
      <ToolButton label="Subheading" active={active.h3} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        H3
      </ToolButton>
      <ToolButton label="Bold" active={active.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
        <span className="font-bold">B</span>
      </ToolButton>
      <ToolButton label="Italic" active={active.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <span className="italic">I</span>
      </ToolButton>
      <ToolButton label="Link" active={active.link} onClick={setLink}>
        Link
      </ToolButton>
      <ToolButton label="Bulleted list" active={active.bullets} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        • List
      </ToolButton>
      <ToolButton label="Numbered list" active={active.numbers} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        1. List
      </ToolButton>
      <ToolButton label="Quote" active={active.quote} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        Quote
      </ToolButton>
      <ToolButton label="Image" onClick={() => fileInput.current?.click()}>
        Image
      </ToolButton>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          onImages(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
    </div>
  );
}

function ToolButton({
  label,
  active = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`rounded border px-2.5 py-1 text-sm transition-colors ${
        active ? "border-accent text-accent" : "border-line text-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
