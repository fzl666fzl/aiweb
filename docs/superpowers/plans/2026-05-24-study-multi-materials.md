# Study Multi-Materials Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the study assistant upload, remember, and query multiple courseware files inside one conversation.

**Architecture:** Reuse the existing `study_materials.conversation_id` relationship: one conversation can own many material rows, and each material can own many chunk rows. The frontend keeps a `StudyMaterial[]`, sends `studyMaterialIds` to `/api/chat`, and restores that list when a history conversation is selected.

**Tech Stack:** Next.js 16 App Router, React 19 Client Components, Supabase route handlers, Vitest, Playwright.

---

### Task 1: Frontend Red Tests

**Files:**
- Modify: `tests/unit/StudyApp.test.tsx`
- Modify: `tests/unit/ChatApp.test.tsx`

- [ ] Add a StudyApp test that uploads two files, displays both file names, and removes only the selected file.
- [ ] Add a ChatApp test that verifies `chatRequestContext={{ studyMaterialIds: ["m1", "m2"] }}` is sent unchanged to `/api/chat`.
- [ ] Add a ChatApp or StudyApp test that selecting a history conversation restores returned `studyMaterials`.
- [ ] Run the focused tests and confirm they fail because the UI only tracks one material and ChatApp has no loaded-conversation callback.

### Task 2: Backend Red Tests

**Files:**
- Modify: `tests/unit/chat-route.test.ts`
- Create: `tests/unit/conversation-messages-route.test.ts`

- [ ] Add a chat route test that accepts `studyMaterialIds`, validates each uploaded material, links each unbound material to the conversation, and injects chunks from both files.
- [ ] Add a chat route test that rejects a material already bound to another conversation.
- [ ] Add a messages route test that returns `studyMaterials` metadata for the selected owned conversation.
- [ ] Run the focused tests and confirm they fail because the route only accepts one `studyMaterialId` and messages only returns messages.

### Task 3: Frontend Implementation

**Files:**
- Modify: `src/components/StudyApp.tsx`
- Modify: `src/components/StudyUploadPanel.tsx`
- Modify: `src/components/ChatApp.tsx`

- [ ] Change `StudyApp` state from `material` to `materials`.
- [ ] Upload each selected file sequentially and append successful materials.
- [ ] Allow file input `multiple`.
- [ ] Render a compact list of uploaded files with one remove button per file.
- [ ] Pass `chatRequestContext={{ studyMaterialIds: materials.map((item) => item.id) }}` when at least one material exists.
- [ ] Add `onConversationLoaded` and `onConversationReset` callbacks to `ChatApp`, called after selecting, creating, and deleting conversations.

### Task 4: Backend Implementation

**Files:**
- Modify: `src/app/api/chat/route.ts`
- Modify: `src/app/api/conversations/[id]/messages/route.ts`

- [ ] Add helper logic to normalize both legacy `studyMaterialId` and new `studyMaterialIds`.
- [ ] Validate each material id against the current session.
- [ ] Link unbound materials to the current conversation.
- [ ] Reject materials bound to a different conversation.
- [ ] Return study material metadata from the messages route, filtered by current session and conversation id.

### Task 5: Verification

**Files:**
- Potentially modify tests only if assertions need to match exact existing UI text.

- [ ] Run focused frontend tests.
- [ ] Run focused backend tests.
- [ ] Run `npm test`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Run `npm run test:e2e`.
- [ ] If all pass and Vercel CLI is available, deploy to production and record the deployment URL/id.
