"use client";

import { useEffect, useRef, useState } from "react";
import type { ComponentType } from "react";
import { Archive, Copy, ExternalLink, MoreHorizontal, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  entityLabel: string;
  onOpen?: () => void;
  onRename?: () => void;
  onFork?: () => void;
  onArchive?: () => void;
  onViewRelated?: () => void;
};

type MenuAction = {
  label: string;
  icon: ComponentType<{ className?: string }>;
  onSelect: () => void;
};

export function EntityActionMenu({
  entityLabel,
  onOpen,
  onRename,
  onFork,
  onArchive,
  onViewRelated,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const actions: MenuAction[] = [
    ...(onOpen ? [{ label: "Open", icon: ExternalLink, onSelect: onOpen }] : []),
    ...(onRename ? [{ label: "Rename", icon: Pencil, onSelect: onRename }] : []),
    ...(onFork ? [{ label: "Fork", icon: Copy, onSelect: onFork }] : []),
    ...(onArchive ? [{ label: "Archive", icon: Archive, onSelect: onArchive }] : []),
    ...(onViewRelated ? [{ label: "View related", icon: ExternalLink, onSelect: onViewRelated }] : []),
  ];

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  if (actions.length === 0) {
    return null;
  }

  return (
    <div ref={rootRef} className="relative shrink-0" onClick={(event) => event.stopPropagation()}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${entityLabel} actions`}
        onClick={() => setOpen((current) => !current)}
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>

      {open ? (
        <div
          role="menu"
          className="absolute top-full right-0 z-30 mt-2 min-w-44 rounded-2xl border border-border bg-popover p-1 shadow-lg"
        >
          {actions.map((action) => {
            const Icon = action.icon;

            return (
              <button
                key={action.label}
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-secondary"
                onClick={() => {
                  setOpen(false);
                  action.onSelect();
                }}
              >
                <Icon className="h-4 w-4" />
                {action.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
