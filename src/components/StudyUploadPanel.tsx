"use client";

import type { ChangeEvent } from "react";
import type { StudyMaterial } from "@/lib/study/types";

type StudyUploadPanelProps = {
  materials: StudyMaterial[];
  uploading: boolean;
  error: string;
  onUpload: (files: File[]) => Promise<void>;
  onRemove: (materialId: string) => void;
};

export function StudyUploadPanel({ materials, uploading, error, onUpload, onRemove }: StudyUploadPanelProps) {
  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (files.length > 0) {
      await onUpload(files);
    }
  }

  const hasMaterials = materials.length > 0;

  return (
    <section className="border-t border-stone-200 bg-[#fffdf8]/90 px-4 pt-3 md:px-8" aria-label="课件上传">
      <div className="mx-auto max-w-5xl rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-stone-900">
              {hasMaterials ? `已上传 ${materials.length} 份课件` : "上传课件开始复习"}
            </p>
            {hasMaterials ? (
              <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto pr-1" aria-label="已上传课件">
                {materials.map((material) => (
                  <li
                    key={material.id}
                    className="flex min-w-0 items-start justify-between gap-2 rounded-lg border border-stone-100 bg-stone-50/70 px-2.5 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-stone-800">{material.fileName}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-stone-500">{material.summaryPreview}</p>
                    </div>
                    <button
                      type="button"
                      className="shrink-0 rounded-md border border-stone-200 bg-white px-2 py-1 text-xs font-semibold text-stone-600 transition hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      aria-label={`移除 ${material.fileName}`}
                      onClick={() => onRemove(material.id)}
                    >
                      移除
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-stone-500">
                支持 PDF、PPTX、DOCX 和常见图片，不保存原文件。
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <label className="inline-flex cursor-pointer rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-800 focus-within:ring-2 focus-within:ring-emerald-200">
              {uploading ? "读取中..." : hasMaterials ? "继续添加" : "选择文件"}
              <input
                aria-label="选择课件文件"
                className="sr-only"
                type="file"
                multiple
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
