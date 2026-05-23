"use client";

import { useState } from "react";
import { apiJson } from "@/lib/client-api";
import type { StudyMaterial } from "@/lib/study/types";
import { ChatApp } from "./ChatApp";
import { StudyUploadPanel } from "./StudyUploadPanel";

export function StudyApp() {
  const [material, setMaterial] = useState<StudyMaterial | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function upload(file: File) {
    setUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.set("file", file);
      const data = await apiJson<{ material: StudyMaterial }>("/api/study/extract", {
        method: "POST",
        body: formData,
      });
      setMaterial(data.material);
    } catch (err) {
      setMaterial(null);
      setError(err instanceof Error ? err.message : "课件读取失败，请稍后重试。");
    } finally {
      setUploading(false);
    }
  }

  return (
    <ChatApp
      appId="study"
      title="复习助手"
      subtitle="上传课件，整理重点、考点和自测题。"
      statusLabel="复习中"
      emptyIcon="习"
      emptyTitle="先上传一份课件"
      emptyDescription="支持 PDF、PPTX、DOCX 和图片。读取后可以让复习助手总结重点、提炼考点或生成自测题。"
      showEmptyPromptCards={false}
      placeholder="上传课件后，问我总结、考点或自测题..."
      composerTopContent={
        <StudyUploadPanel
          material={material}
          uploading={uploading}
          error={error}
          onUpload={upload}
          onRemove={() => {
            setMaterial(null);
            setError("");
          }}
        />
      }
      chatRequestContext={material ? { studyMaterialId: material.id } : undefined}
    />
  );
}
