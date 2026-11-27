const STYLE_PROPS = [
  "fill",
  "fill-opacity",
  "stroke",
  "stroke-opacity",
  "stroke-width",
  "stroke-dasharray",
  "opacity",
  "font-family",
  "font-size",
  "font-weight",
  "text-anchor",
  "dominant-baseline",
  "vector-effect",
] as const;

function inlineComputedStyles(source: Element, target: Element) {
  const computed = window.getComputedStyle(source);
  const targetEl = target as HTMLElement | SVGElement;
  for (const prop of STYLE_PROPS) {
    const val = computed.getPropertyValue(prop);
    if (val) {
      targetEl.style.setProperty(prop, val);
    }
  }
  const sourceChildren = source.children;
  const targetChildren = target.children;
  for (let i = 0; i < sourceChildren.length; i++) {
    inlineComputedStyles(sourceChildren[i], targetChildren[i]);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

async function rasterizeSvg(
  svg: SVGSVGElement,
  targetWidth: number,
): Promise<{ img: HTMLImageElement; width: number; height: number; url: string }> {
  const rect = svg.getBoundingClientRect();
  const aspect =
    rect.width > 0 && rect.height > 0 ? rect.height / rect.width : 1;
  const width = targetWidth;
  const height = Math.round(targetWidth * aspect);

  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  inlineComputedStyles(svg, clone);

  const serialized = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([serialized], {
    type: "image/svg+xml;charset=utf-8",
  });
  const url = URL.createObjectURL(svgBlob);
  const img = await loadImage(url);
  return { img, width, height, url };
}

export interface ExportPanel {
  svg: SVGSVGElement;
  label?: string;
}

export interface ExportSvgOptions {
  title: string;
  subtitle?: string;
  filename?: string;
}

/**
 * Renders one or more live SVG elements (side-by-side when multiple) into a crisp
 * Discord-ready PNG card and writes it to the clipboard (with PNG download fallback).
 */
export async function copySvgsToClipboard(
  panels: readonly ExportPanel[],
  options: ExportSvgOptions,
): Promise<"copied" | "downloaded"> {
  if (panels.length === 0) {
    throw new Error("No SVG panels to export");
  }

  const isDark = document.documentElement.classList.contains("dark");
  const bg = isDark ? "#18181b" : "#ffffff";
  const textPrimary = isDark ? "#f4f4f5" : "#1c1917";
  const textSecondary = isDark ? "#a1a1aa" : "#78716c";
  const borderColor = isDark ? "#3f3f46" : "#d6d3d1";

  const panelW = panels.length > 1 ? 540 : 720;
  const gap = 28;
  const pad = 28;
  const headerH = options.subtitle ? 58 : 38;
  const hasLabels = panels.some((p) => Boolean(p.label));
  const panelLabelH = hasLabels ? 26 : 0;
  const footerH = 26;

  const rasterized = await Promise.all(
    panels.map((p) => rasterizeSvg(p.svg, panelW)),
  );

  try {
    const maxPanelH = Math.max(...rasterized.map((r) => r.height));
    const contentW =
      panels.length * panelW + Math.max(0, panels.length - 1) * gap;
    const canvasW = contentW + pad * 2;
    const canvasH = pad * 2 + headerH + panelLabelH + maxPanelH + footerH;

    const canvas = document.createElement("canvas");
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");

    // Solid themed card background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Main title & subtitle
    ctx.fillStyle = textPrimary;
    ctx.font = "600 22px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.textBaseline = "top";
    ctx.fillText(options.title, pad, pad);

    if (options.subtitle) {
      ctx.fillStyle = textSecondary;
      ctx.font = "400 14px system-ui, -apple-system, Segoe UI, sans-serif";
      ctx.fillText(options.subtitle, pad, pad + 30);
    }

    // Render each panel side-by-side
    const panelTopY = pad + headerH;
    rasterized.forEach((item, idx) => {
      const x = pad + idx * (panelW + gap);
      const label = panels[idx].label;
      if (label) {
        ctx.fillStyle = textSecondary;
        ctx.font = "600 13px system-ui, -apple-system, Segoe UI, sans-serif";
        ctx.textBaseline = "top";
        ctx.fillText(label, x, panelTopY);
      }
      // Vertically center shorter panels so side-view + square footprint align cleanly
      const yOffset = Math.round((maxPanelH - item.height) / 2);
      const imgY = panelTopY + panelLabelH + yOffset;
      ctx.drawImage(item.img, x, imgY, item.width, item.height);
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, imgY, item.width, item.height);
    });

    // Subtle footer watermark
    ctx.fillStyle = textSecondary;
    ctx.font = "400 12px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.textBaseline = "bottom";
    ctx.fillText("PF2e Tools · 1 square = 5 ft", pad, canvasH - pad + 10);

    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to encode PNG"));
      }, "image/png");
    });

    if (
      typeof navigator !== "undefined" &&
      navigator.clipboard &&
      "write" in navigator.clipboard &&
      typeof ClipboardItem !== "undefined"
    ) {
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": pngBlob }),
      ]);
      return "copied";
    }

    // Fallback: trigger PNG download
    const downloadUrl = URL.createObjectURL(pngBlob);
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = options.filename ?? "pf2e-tools.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(downloadUrl);
    return "downloaded";
  } finally {
    for (const item of rasterized) {
      URL.revokeObjectURL(item.url);
    }
  }
}

export async function copySvgToClipboard(
  svg: SVGSVGElement,
  options: ExportSvgOptions,
): Promise<"copied" | "downloaded"> {
  return copySvgsToClipboard([{ svg }], options);
}
