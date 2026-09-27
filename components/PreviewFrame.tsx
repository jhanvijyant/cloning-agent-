"use client";

import { useState } from "react";

export function PreviewFrame({ previewUrl }: { previewUrl: string | null }) {
  const [mobile, setMobile] = useState(false);

  if (!previewUrl) {
    return (
      <div className="flex h-96 items-center justify-center rounded border border-dashed border-neutral-300 text-sm text-neutral-500">
        No preview yet. Generate a frontend to see it here.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <a
          href={previewUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-accent underline"
        >
          Open in new tab
        </a>
        <button
          onClick={() => setMobile((m) => !m)}
          className="rounded border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-100"
        >
          {mobile ? "Desktop view" : "Mobile view"}
        </button>
      </div>
      <div
        className={`mx-auto overflow-hidden rounded border border-neutral-300 transition-all ${
          mobile ? "w-[375px]" : "w-full"
        }`}
      >
        <iframe
          src={previewUrl}
          className="h-[600px] w-full"
          title="Generated site preview"
        />
      </div>
    </div>
  );
}
