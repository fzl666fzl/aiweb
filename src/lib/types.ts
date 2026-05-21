import type { AppId, PersonaId } from "./personas";

export type ChatRole = "user" | "assistant";

export type AccessSession = {
  accessKeyId: string;
};

export type ConversationSummary = {
  id: string;
  title: string;
  appId: AppId;
  personaId: PersonaId;
  createdAt: string;
  updatedAt: string;
};

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
};
