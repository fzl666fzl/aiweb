export type StudyMaterial = {
  id: string;
  fileName: string;
  mimeType: string;
  summaryPreview: string;
  textLength: number;
};

export type StudyExtractResult = {
  fileName: string;
  mimeType: string;
  extractedText: string;
  summaryPreview: string;
  textLength: number;
};
