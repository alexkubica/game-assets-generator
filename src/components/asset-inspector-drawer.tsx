"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
};

export function AssetInspectorDrawer({ title, open, onClose, children }: Props) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-end bg-black/30 sm:items-stretch">
      <button type="button" className="flex-1 cursor-default" aria-label="Close inspector overlay" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="asset-inspector-title"
        className="flex h-[92dvh] w-full flex-col rounded-t-[1.75rem] border border-border bg-background shadow-2xl sm:h-full sm:max-w-xl sm:rounded-none sm:border-y-0 sm:border-r-0 sm:border-l"
      >
        <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Inspector</div>
            <div id="asset-inspector-title" className="text-lg font-semibold">{title}</div>
          </div>
          <Button type="button" variant="ghost" size="icon" aria-label="Close inspector" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
      </aside>
    </div>
  );
}
