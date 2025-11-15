"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { removeBackground } from "@imgly/background-removal";
import dynamic from "next/dynamic";

const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB

const sliders = [
  {
    key: "brightness" as const,
    label: "Brightness",
    min: -40,
    max: 40,
    step: 1,
  },
  {
    key: "contrast" as const,
    label: "Contrast",
    min: -30,
    max: 30,
    step: 1,
  },
  {
    key: "saturation" as const,
    label: "Saturation",
    min: -30,
    max: 30,
    step: 1,
  },
];

type SliderKey = (typeof sliders)[number]["key"];

type FilterState = Record<SliderKey, number>;

const initialFilters: FilterState = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
};

const loadColorThief = () => import("color-thief-browser");

const formatBytes = (bytes: number) => {
  const units = ["B", "KB", "MB", "GB"];
  if (bytes === 0) return "0 B";
  const index = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** index).toFixed(1)} ${units[index]}`;
};

const toHex = (rgb: number[]) =>
  `#${rgb
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`.toUpperCase();

async function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

async function applyCanvasFilters(base64: string, filters: FilterState) {
  const image = await loadImage(base64);
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to access 2D context");

  const { brightness, contrast, saturation } = filters;
  const brightnessPct = 100 + brightness;
  const contrastPct = 100 + contrast;
  const saturationPct = 100 + saturation;
  ctx.filter = `brightness(${brightnessPct}%) contrast(${contrastPct}%) saturate(${saturationPct}%)`;
  ctx.drawImage(image, 0, 0);
  return canvas.toDataURL("image/png");
}

function useIsMounted() {
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return mounted;
}

function usePaletteSuggestions(palette: string[]) {
  return useMemo(() => {
    if (palette.length === 0) return [];
    const primary = palette[0];
    const accent = palette[1] ?? palette[0];
    const subtle = palette[palette.length - 1] ?? palette[0];

    return [
      `Hero headline with ${primary} accent buttons and ${subtle} background cards`,
      `Landing page split layout using ${primary} gradients and ${accent} hover states`,
      `E-commerce feature grid pairing ${primary} highlights with ${subtle} surface tones`,
    ];
  }, [palette]);
}

const CopyButton = dynamic(() => import("./ui/CopyButton"), { ssr: false });

export default function ImageEditor() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number>(0);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [baseImage, setBaseImage] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [palette, setPalette] = useState<string[]>([]);
  const [cssSnippet, setCssSnippet] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mounted = useIsMounted();

  const paletteIdeas = usePaletteSuggestions(palette);

  const updateCssSnippet = useCallback((colors: string[]) => {
    if (colors.length < 3) {
      setCssSnippet("");
      return;
    }
    const gradient = `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 50%, ${colors[2]} 100%)`;
    const shadow = `${colors[0]}33`;
    setCssSnippet(
      `background: ${gradient};\ncolor: ${colors[2]};\nbox-shadow: 0 24px 48px ${shadow};\nborder-radius: 24px;\npadding: clamp(32px, 5vw, 64px);`
    );
  }, []);

  const handleFiltersChange = useCallback((key: SliderKey, value: number) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(initialFilters);
  }, []);

  const extractPalette = useCallback(
    async (source: string) => {
      try {
        const { default: ColorThief } = await loadColorThief();
        const thief = new ColorThief();
        const image = await loadImage(source);
        const swatches = thief.getPalette(image, 5);
        const hexPalette = swatches.map((swatch) => toHex(swatch));
        setPalette(hexPalette);
        updateCssSnippet(hexPalette.slice(0, 3));
      } catch (err) {
        console.error("Palette extraction failed", err);
        setPalette([]);
        setCssSnippet("");
      }
    },
    [updateCssSnippet]
  );

  const applyFilters = useCallback(async () => {
    if (!baseImage) {
      setPreviewImage(null);
      return;
    }
    try {
      const filtered = await applyCanvasFilters(baseImage, filters);
      if (mounted.current) {
        setPreviewImage(filtered);
      }
    } catch (err) {
      console.error("Filter application failed", err);
      setError("Something went wrong applying filters.");
    }
  }, [baseImage, filters, mounted]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  useEffect(() => {
    if (baseImage) {
      extractPalette(baseImage);
    }
  }, [baseImage, extractPalette]);

  const readFile = async (file: File) => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setSuccess(null);
      if (!file.type.startsWith("image/")) {
        setError("Please upload an image file (PNG, JPG, or WebP).");
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        setError(`File is too large (${formatBytes(file.size)}). Max size is ${formatBytes(MAX_FILE_SIZE)}.`);
        return;
      }
      setIsProcessing("Preparing image");
      try {
        const dataUrl = await readFile(file);
        setFileName(file.name);
        setFileSize(file.size);
        setOriginalImage(dataUrl);
        setBaseImage(dataUrl);
        setFilters(initialFilters);
        setSuccess("Image ready. Explore AI tools to transform it.");
      } catch (err) {
        console.error("File load failed", err);
        setError("Unable to read image file.");
      } finally {
        setIsProcessing(null);
      }
    },
    []
  );

  const onDrop = useCallback(
    async (event: React.DragEvent<HTMLLabelElement>) => {
      event.preventDefault();
      const file = event.dataTransfer.files?.[0];
      if (file) {
        await handleFile(file);
      }
    },
    [handleFile]
  );

  const launchBackgroundRemoval = useCallback(async () => {
    if (!baseImage) return;
    setIsProcessing("Removing background");
    setError(null);
    setSuccess(null);
    try {
      const image = await loadImage(baseImage);
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");
      ctx.drawImage(image, 0, 0);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve));
      if (!blob) throw new Error("Failed converting image to blob");
      const file = new File([blob], fileName ?? "asset.png", { type: "image/png" });
      const resultBlob = await removeBackground(
        file,
        {
          format: "image/png",
          quality: 0.92,
        } as unknown as Parameters<typeof removeBackground>[1]
      );
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(resultBlob as Blob);
      });
      setBaseImage(base64);
      setSuccess("Clean transparent background ready for export.");
    } catch (err) {
      console.error("Background removal failed", err);
      setError("Background removal failed. Try a different image or reload.");
    } finally {
      setIsProcessing(null);
    }
  }, [baseImage, fileName]);

  const revertToOriginal = useCallback(() => {
    if (!originalImage) return;
    setBaseImage(originalImage);
    setFilters(initialFilters);
    setSuccess("Reverted to original image.");
  }, [originalImage]);

  const downloadImage = useCallback(() => {
    const href = previewImage ?? baseImage ?? originalImage;
    if (!href) return;
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = fileName ? fileName.replace(/\.[^.]+$/, "-lumacraft.png") : "lumacraft-export.png";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  }, [baseImage, fileName, originalImage, previewImage]);

  const dropzoneClasses = clsx(
    "group relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/20 px-6 py-12 transition hover:border-cyan-300/60 hover:bg-white/5",
    {
      "bg-white/5": baseImage,
    }
  );

  return (
    <section className="grid gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="space-y-6">
        <label
          htmlFor="file-upload"
          className={dropzoneClasses}
          onDragOver={(event) => event.preventDefault()}
          onDrop={onDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            id="file-upload"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void handleFile(file);
              }
            }}
          />
          <div className="flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-black/40 text-cyan-200 shadow-lg shadow-cyan-500/20">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="h-8 w-8"
              >
                <path d="M12 16V4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M8 12l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                <path
                  d="M20 16v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <p className="mt-4 text-lg font-medium text-white">
              {baseImage ? "Drop a new image to restart" : "Drop your artwork or upload"}
            </p>
            <p className="mt-2 max-w-sm text-sm text-slate-300">
              PNG, JPG, or WebP up to {formatBytes(MAX_FILE_SIZE)}. Background removal runs locally, no upload required.
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-6 py-2 text-sm font-semibold text-white transition hover:border-cyan-300/60 hover:bg-cyan-500/20"
            >
              <span>Browse files</span>
            </button>
          </div>
        </label>

        {(error || success || isProcessing) && (
          <div className="space-y-3">
            {isProcessing && (
              <div className="flex items-center gap-3 rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-300 opacity-75"></span>
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-cyan-400"></span>
                </span>
                <span>{isProcessing}…</span>
              </div>
            )}
            {error && (
              <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                {success}
              </div>
            )}
          </div>
        )}

        {baseImage && (
          <div className="rounded-3xl border border-white/10 bg-black/40 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">AI Image Controls</h2>
                <p className="text-sm text-slate-300">Fine-tune the mood and export-ready assets.</p>
              </div>
              <button
                type="button"
                onClick={resetFilters}
                className="text-xs font-semibold uppercase tracking-wide text-cyan-200 hover:text-cyan-100"
              >
                Reset
              </button>
            </div>
            <div className="mt-6 space-y-5">
              {sliders.map((slider) => (
                <div key={slider.key} className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span>{slider.label}</span>
                    <span>{filters[slider.key]}</span>
                  </div>
                  <input
                    type="range"
                    min={slider.min}
                    max={slider.max}
                    step={slider.step}
                    value={filters[slider.key]}
                    onChange={(event) => handleFiltersChange(slider.key, Number(event.target.value))}
                    className="h-1 w-full appearance-none rounded-full bg-white/10 accent-cyan-400"
                  />
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={launchBackgroundRemoval}
                className="inline-flex items-center gap-2 rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-black shadow-lg shadow-cyan-500/30 transition hover:bg-cyan-400"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="h-4 w-4"
                >
                  <path d="M3 6h18M5 10h14M7 14h10M9 18h6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Remove background
              </button>
              <button
                type="button"
                onClick={revertToOriginal}
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:border-cyan-200/40 hover:bg-white/10"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="h-4 w-4"
                >
                  <path d="M3 12a9 9 0 1 1 9 9" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M3 12h6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Revert
              </button>
              <button
                type="button"
                onClick={downloadImage}
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-gradient-to-r from-emerald-400 to-cyan-400 px-4 py-2 text-sm font-semibold text-black shadow-lg shadow-emerald-500/40 transition hover:from-emerald-300 hover:to-cyan-300"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="h-4 w-4"
                >
                  <path d="M12 5v10" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M8 11l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4 19h16" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Export PNG
              </button>
            </div>
          </div>
        )}

        {palette.length > 0 && (
          <div className="rounded-3xl border border-white/10 bg-black/40 p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">Brand Palette</h3>
                <p className="text-sm text-slate-300">Generated from the dominant tones of your artwork.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {palette.map((color) => (
                  <div
                    key={color}
                    className="flex h-10 w-20 items-center justify-center rounded-xl border border-white/10 text-xs font-semibold text-slate-900 shadow-lg"
                    style={{ background: color }}
                  >
                    {color}
                  </div>
                ))}
              </div>
            </div>
            {cssSnippet && (
              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-300">
                  <span>Hero component CSS</span>
                  <CopyButton value={cssSnippet} />
                </div>
                <pre className="max-h-60 overflow-auto rounded-2xl bg-black/70 p-4 text-[13px] leading-relaxed text-cyan-100 shadow-inner shadow-cyan-500/20">
                  {cssSnippet}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>

      <aside className="space-y-6">
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-black/40">
          <div className="border-b border-white/10 bg-black/40 px-6 py-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Smart Preview</h2>
          </div>
          <div className="grid gap-6 p-6">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Original</h3>
              <div className="mt-2 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 p-3">
                {originalImage ? (
                  <img
                    src={originalImage}
                    alt="Original upload"
                    className="w-full rounded-2xl object-contain"
                  />
                ) : (
                  <div className="flex h-48 items-center justify-center text-center text-sm text-slate-500">
                    Upload an image to unlock AI tools.
                  </div>
                )}
              </div>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">AI Refined</h3>
              <div className="mt-2 overflow-hidden rounded-2xl border border-cyan-400/20 bg-slate-900/60 p-3">
                {previewImage ? (
                  <img
                    src={previewImage}
                    alt="AI enhanced preview"
                    className="w-full rounded-2xl object-contain"
                  />
                ) : baseImage ? (
                  <img
                    src={baseImage}
                    alt="Base preview"
                    className="w-full rounded-2xl object-contain"
                  />
                ) : (
                  <div className="flex h-48 items-center justify-center text-center text-sm text-slate-500">
                    Adjust sliders or run background removal to generate a refined preview.
                  </div>
                )}
              </div>
            </div>
          </div>
          {fileName && (
            <div className="border-t border-white/10 bg-black/30 px-6 py-4 text-xs text-slate-400">
              <p className="font-semibold text-slate-300">File details</p>
              <p className="mt-1">Name: {fileName}</p>
              <p className="mt-1">Size: {formatBytes(fileSize)}</p>
            </div>
          )}
        </div>

        {paletteIdeas.length > 0 && (
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-500/10 to-emerald-500/10 p-6 shadow-lg shadow-cyan-500/10">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-200">
              Layout prompts for your dev team
            </h3>
            <ul className="mt-4 space-y-3 text-sm text-slate-200">
              {paletteIdeas.map((idea, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span className="mt-[2px] flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500/20 text-[11px] font-semibold text-cyan-200">
                    {index + 1}
                  </span>
                  <span>{idea}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </section>
  );
}
