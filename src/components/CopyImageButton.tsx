import { useState, type RefObject } from "react";
import { Check, Image as ImageIcon } from "lucide-react";
import { copySvgsToClipboard, type ExportPanel } from "../lib/exportSvgImage";

export interface CopyImagePanelRef {
  svgRef: RefObject<SVGSVGElement | null>;
  label?: string;
}

interface CopyImageButtonProps {
  svgRef?: RefObject<SVGSVGElement | null>;
  panels?: readonly CopyImagePanelRef[];
  title: string;
  subtitle?: string;
  filename?: string;
}

export function CopyImageButton({
  svgRef,
  panels,
  title,
  subtitle,
  filename,
}: CopyImageButtonProps) {
  const [status, setStatus] = useState<"idle" | "copied" | "downloaded">(
    "idle",
  );

  const handleClick = async () => {
    const resolved: ExportPanel[] = [];
    if (panels && panels.length > 0) {
      for (const p of panels) {
        if (p.svgRef.current) {
          resolved.push({ svg: p.svgRef.current, label: p.label });
        }
      }
    } else if (svgRef?.current) {
      resolved.push({ svg: svgRef.current });
    }
    if (resolved.length === 0) return;

    try {
      const result = await copySvgsToClipboard(resolved, {
        title,
        subtitle,
        filename,
      });
      setStatus(result);
      window.setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("idle");
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title="Save image to clipboard (paste straight into Discord)"
      className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-medium text-stone-700 dark:text-zinc-200 hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
    >
      {status === "copied" ? (
        <>
          <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          Image copied!
        </>
      ) : status === "downloaded" ? (
        <>
          <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          PNG saved!
        </>
      ) : (
        <>
          <ImageIcon className="h-3.5 w-3.5 text-crimson-600 dark:text-gold-400" />
          Copy image
        </>
      )}
    </button>
  );
}
