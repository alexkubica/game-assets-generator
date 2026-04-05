"use client";

import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  title: string;
  description: string;
  onSaveToAsset: () => void;
  onSaveToSetupOnly: () => void;
  onForkAndUse: () => void;
  onClose: () => void;
  loading?: boolean;
};

export function SaveScopeDialog({
  open,
  title,
  description,
  onSaveToAsset,
  onSaveToSetupOnly,
  onForkAndUse,
  onClose,
  loading = false,
}: Props) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-scope-title"
        className="w-full max-w-lg rounded-[1.75rem] border border-border bg-background p-5 shadow-2xl"
      >
        <div className="space-y-2">
          <div id="save-scope-title" className="text-lg font-semibold">{title}</div>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>

        <div className="mt-5 grid gap-3">
          <Button type="button" onClick={onSaveToAsset} disabled={loading}>
            Save to sprite asset
          </Button>
          <Button type="button" variant="outline" onClick={onSaveToSetupOnly} disabled={loading}>
            Save to this tester setup only
          </Button>
          <Button type="button" variant="outline" onClick={onForkAndUse} disabled={loading}>
            Fork sprite and use fork
          </Button>
        </div>

        <div className="mt-4 flex justify-end">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
