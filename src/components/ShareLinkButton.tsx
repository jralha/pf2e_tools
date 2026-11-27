import { useState } from "react";
import { Check, Share2 } from "lucide-react";

export function ShareLinkButton() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for restricted clipboard contexts
      window.prompt("Copy this shareable link:", window.location.href);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-medium text-stone-700 dark:text-zinc-200 hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          Copied!
        </>
      ) : (
        <>
          <Share2 className="h-3.5 w-3.5 text-crimson-600 dark:text-gold-400" />
          Share link
        </>
      )}
    </button>
  );
}
