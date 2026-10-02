"use client";

import { useRef, useState, useTransition } from "react";
import { galleryImageUrl, type GalleryItem } from "@/lib/gallery";
import { createClient } from "@/lib/supabase/client";
import { addGalleryItem, deleteGalleryItem, reorderGallery, renameGalleryItem } from "./actions";

// "blue-heron_final.jpg" → "Blue heron final"
function titleFromFileName(name: string): string {
  const base = name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
  return base.charAt(0).toUpperCase() + base.slice(1);
}

async function uploadPiece(file: File) {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;
  bitmap.close();

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await createClient()
    .storage.from("gallery")
    .upload(path, file, { contentType: file.type, cacheControl: "31536000" });
  if (error) throw error;

  return addGalleryItem({ title: titleFromFileName(file.name), image_path: path, width, height });
}

export function GalleryManager({ initialItems }: { initialItems: GalleryItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  const upload = async (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith("image/"));
    setError(null);
    setUploading((n) => n + images.length);
    for (const file of images) {
      try {
        const item = await uploadPiece(file);
        setItems((list) => [item, ...list]);
      } catch {
        setError(`${file.name} didn't upload.`);
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };

  const saveOrder = (next: GalleryItem[]) => {
    setItems(next);
    startTransition(async () => {
      try {
        await reorderGallery(next.map((item) => item.id));
      } catch {
        setError("The new order didn't save. Reload and try again.");
      }
    });
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    saveOrder(next);
  };

  const remove = (item: GalleryItem) => {
    if (!confirm(`Delete "${item.title || "this piece"}"? This can't be undone.`)) return;
    setItems((list) => list.filter((i) => i.id !== item.id));
    startTransition(async () => {
      try {
        await deleteGalleryItem(item.id);
      } catch {
        setError("That piece couldn't be deleted. Reload and try again.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div
        onDragOver={(e) => {
          if (dragging) return;
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          if (dragging) return;
          e.preventDefault();
          setDragOver(false);
          void upload(Array.from(e.dataTransfer.files));
        }}
        className={`flex flex-col items-center gap-3 rounded border border-dashed px-6 py-10 text-center ${
          dragOver ? "border-accent" : "border-line"
        }`}
      >
        <p className="text-muted">Drop images here, or</p>
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="rounded bg-accent px-4 py-2 font-medium text-background transition-opacity hover:opacity-90"
        >
          Choose images
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            void upload(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
        {uploading > 0 && <p className="text-sm text-muted">Uploading {uploading}…</p>}
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}

      {items.length === 0 ? (
        <p className="text-muted">No pieces yet.</p>
      ) : (
        <>
          <p className="text-sm text-muted">Drag to reorder. Titles save when you click away.</p>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((item, index) => (
              <li
                key={item.id}
                draggable
                onDragStart={() => setDragging(item.id)}
                onDragEnd={() => setDragging(null)}
                onDragOver={(e) => {
                  if (!dragging || dragging === item.id) return;
                  e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragging) move(items.findIndex((i) => i.id === dragging), index);
                  setDragging(null);
                }}
                className={`flex cursor-grab flex-col gap-2 ${dragging === item.id ? "opacity-40" : ""}`}
              >
                <div className="aspect-square bg-surface">
                  {/* eslint-disable-next-line @next/next/no-img-element -- small admin thumbnails */}
                  <img
                    src={galleryImageUrl(item.image_path)}
                    alt={item.title}
                    loading="lazy"
                    draggable={false}
                    className="h-full w-full object-contain"
                  />
                </div>
                <input
                  defaultValue={item.title}
                  placeholder="Untitled"
                  aria-label="Title"
                  onBlur={(e) => {
                    const title = e.target.value;
                    if (title === item.title) return;
                    setItems((list) => list.map((i) => (i.id === item.id ? { ...i, title } : i)));
                    startTransition(async () => {
                      try {
                        await renameGalleryItem(item.id, title);
                      } catch {
                        setError("That title didn't save.");
                      }
                    });
                  }}
                  className="rounded border border-line bg-surface px-2 py-1 text-sm placeholder:text-muted focus:border-accent focus:outline-none"
                />
                <div className="flex items-center gap-3 text-sm text-muted">
                  <button type="button" onClick={() => move(index, index - 1)} disabled={index === 0} aria-label="Move earlier" className="hover:text-foreground disabled:opacity-30">
                    ←
                  </button>
                  <button type="button" onClick={() => move(index, index + 1)} disabled={index === items.length - 1} aria-label="Move later" className="hover:text-foreground disabled:opacity-30">
                    →
                  </button>
                  <button type="button" onClick={() => remove(item)} className="ml-auto text-danger hover:underline">
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
