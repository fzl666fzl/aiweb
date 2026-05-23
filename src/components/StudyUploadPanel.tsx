"use client";

import type { ChangeEvent } from "react";
import type { StudyMaterial } from "@/lib/study/types";

type StudyUploadPanelProps = {
  material: StudyMaterial | null;
  uploading: boolean;
  error: string;
  onUpload: (file: File) => Promise<void>;
  onRemove: () => void;
};

export function StudyUploadPanel({ material, uploading, error, onUpload, onRemove }: StudyUploadPanelProps) {
  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (file) {
      await onUpload(file);
    }
  }

  return (
    <section className="border-t border-stone-200 bg-[#fffdf8]/90 px-4 pt-3 md:px-8" aria-label="课件上传">
      <div className="mx-auto max-w-5xl rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-stone-900">
              {material ? material.fileName : "上传课件开始复习"}
            </p>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-stone-500">
              {material ? material.summaryPreview : "支持 PDF、PPTX、DOCX 和常见图片，不保存原文件。"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {material ? (
              <button
                type="button"
                className="rounded-lg border border-stone-200 px-3 py-2 text-xs font-semibold text-stone-600 transition hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                onClick={onRemove}
              >
                移除
              </button>
            ) : null}
            <label className="inline-flex cursor-pointer rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-800 focus-within:ring-2 focus-within:ring-emerald-200">
              {uploading ? "读取中..." : material ? "换一个文件" : "选择文件"}
              <input
                aria-label="选择课件文件"
                className="sr-only"
                type="file"
                accept=".pdf,.pptx,.docx,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
                disabled={uploading}
                onChange={handleFileChange}
              />
            </label>
          </div>
        </div>
        {error ? (
          <p className="mt-3 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
