"use client";

import type { ReactNode } from "react";

type Props = {
  title: string;
  description?: string;
  controls?: ReactNode;
  actions?: ReactNode;
};

export function EntityToolbar({ title, description, controls, actions }: Props) {
  return (
    <div className="rounded-[1.75rem] border border-border/70 bg-card/70 p-4 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <div className="text-lg font-semibold">{title}</div>
          {description ? <div className="mt-1 text-sm text-muted-foreground">{description}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {controls ? <div className="mt-4">{controls}</div> : null}
    </div>
  );
}
