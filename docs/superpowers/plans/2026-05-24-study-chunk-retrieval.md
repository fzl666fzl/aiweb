# Study Chunk Retrieval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the study assistant use complete uploaded courseware through chunking, cached extractive summaries, and query-based retrieval instead of sending only the first slice of text.

**Architecture:** Keep full extracted text in `study_materials`, add durable chunk rows in `study_material_chunks`, and cache an extractive courseware map on the material. Chat requests build model context from the cached map plus relevant chunks, with a legacy fallback for old uploads that have no chunks yet.

**Tech Stack:** Next.js 16 Route Handlers, Supabase Postgres, TypeScript, Vitest, Playwright.

---

### Task 1: Add Study Chunking Utilities

**Files:**
- Create: `src/lib/study/chunking.ts`
- Test: `tests/unit/study-chunking.test.ts`

- [ ] Write tests for chunk creation, summary cache generation, keyword retrieval, and whole-courseware representative retrieval.
- [ ] Implement `createStudyChunks`, `buildStudySummaryCache`, `selectRelevantStudyChunks`, and `buildStudyChunkContext`.
- [ ] Verify with `npm test -- tests/unit/study-chunking.test.ts`.

### Task 2: Add Database Migration

**Files:**
- Create: `supabase/migrations/202605240002_add_study_chunks.sql`
- Modify: `supabase/schema.sql`

- [ ] Add nullable/defaulted `summary_cache` and `chunk_count` to `study_materials`.
- [ ] Add `study_material_chunks` with owner columns, `study_material_id`, `chunk_index`, `content`, and `char_count`.
- [ ] Add indexes for material lookup and owner lookup.

### Task 3: Store Chunks on Upload

**Files:**
- Modify: `src/app/api/study/extract/route.ts`
- Modify: `src/lib/study/types.ts`
- Test: `tests/unit/study-extract-route.test.ts`

- [ ] Write failing route test proving upload stores `summary_cache`, `chunk_count`, and chunk rows.
- [ ] Generate chunks after extraction, insert material first, then insert chunk rows using the returned material id.
- [ ] Return `chunkCount` in safe metadata.
- [ ] Verify with `npm test -- tests/unit/study-extract-route.test.ts`.

### Task 4: Retrieve Relevant Chunks in Chat

**Files:**
- Modify: `src/app/api/chat/route.ts`
- Test: `tests/unit/chat-route.test.ts`

- [ ] Write failing tests proving study chat uses matching late chunks, includes cached summary, avoids unrelated large text, and falls back for legacy materials.
- [ ] Extend study material loading to read chunk rows owned by the same user.
- [ ] Build study context from cached summaries plus selected chunks.
- [ ] Keep short study history and study timeout behavior.
- [ ] Verify with `npm test -- tests/unit/chat-route.test.ts`.

### Task 5: Full Verification and Release

**Files:**
- No additional source files expected.

- [ ] Run `npm test`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Run `npm run test:e2e`.
- [ ] Commit related files only, leaving unrelated `submission-proof/` untouched.
- [ ] Push and deploy production after verification.
- [ ] Report migration path and production URL.
