# Skill File Viewer

## Features / Showcase

A dedicated **Skill Detail Page** with an integrated file viewer that lets users browse and preview the files stored inside an agent skill's disk.

**Before:** Both the Learning Space detail page (skills tab) and Agent Skills page only show a flat `file_index` table (path + MIME type). The Agent Skills page has a modal-based detail view with no file browsing. Users must navigate to the Disk page separately and find the skill's disk manually to preview actual file contents.

**After:**
- A new route `/agent_skills/[id]` serves as the skill detail page.
- The page shows skill metadata at the top, and a full-width **file tree** (left) + **file preview** (right) below.
- File tree supports lazy-loading folder expansion, just like the existing Disk page.
- File preview supports syntax-highlighted code (via CodeMirror), image preview, and file metadata display.
- Both the **Agent Skills** list page and the **Learning Space** detail page link to this page — no dialog state needed in either.
- The URL is shareable and bookmarkable.

## Design Overview

### Architecture

```
components/
  disk-tree-viewer/
    disk-tree-viewer.tsx       # Reusable file tree + preview component (extracted from disk/page.tsx)

app/
  agent_skills/
    page.tsx                   # Existing list page (modified: row click / "View" navigates to [id])
    actions.ts                 # Existing actions (add getAgentSkill single-fetch if missing)
    [id]/
      page.tsx                 # NEW: Skill detail page with DiskTreeViewer
```

### Page Layout (`agent_skills/[id]/page.tsx`)

```
┌──────────────────────────────────────────────────────────┐
│  ← Back to Skills          Skill: daily-logs    [Delete] │  ← header
│  Description: ...    Created: ...    Files: 5            │
├────────────────────────┬─────────────────────────────────┤
│  File Tree (35%)       │  File Preview (65%)             │  ← DiskTreeViewer
│  ├── SKILL.md          │  filename: SKILL.md             │
│  ├── scripts/          │  path: /   mime: text/markdown  │
│  │   └── main.py       │  ─────────────────────────      │
│  └── ...               │  # Daily Logs                   │
│                        │  This skill captures...         │
│                        │                                 │
└────────────────────────┴─────────────────────────────────┘
```

### Component Hierarchy

```
SkillDetailPage (page component)
  ├── Header (back button, skill name, description, metadata, delete)
  └── DiskTreeViewer (core logic, fills remaining viewport)
        ├── File Tree Panel (react-arborist)
        │     └── Node (tree node renderer, read-only)
        └── File Preview Panel
              ├── File metadata (name, path, MIME, size, timestamps)
              ├── Code preview (ReactCodeMirror with syntax highlighting)
              └── Image preview (Next/Image)
```

### Data Flow

1. `AgentSkill` already has `disk_id` in the Go model (serialized as `"disk_id"` in JSON). The UI TypeScript type is currently missing it — we add it.
2. `agent_skills/[id]/page.tsx` fetches the skill by ID on mount, then renders `DiskTreeViewer` with the skill's `disk_id`.
3. `DiskTreeViewer` calls the existing `getListArtifacts(diskId, "/")` to load root items, and `getArtifact(diskId, path)` for file preview — **reusing the existing `disk/actions.ts`** server actions.
4. The tree uses `react-arborist` with lazy-loading (same pattern as `disk/page.tsx`).

### Why Disk APIs (not the Skill File endpoint)

The Go API has `GET /api/v1/agent_skills/{id}/file?file_path=...` which fetches a single file from a skill. However, this endpoint only returns one file at a time and has no directory-listing capability. The disk APIs (`GET /api/v1/disk/{disk_id}/artifact/ls?path=...` and `GET /api/v1/disk/{disk_id}/artifact?file_path=...`) provide full tree-browsing with lazy-loaded directory listing, which is exactly what the file explorer needs. Since each skill already owns a `disk_id`, we go through the disk layer directly.

### Why a Page Instead of a Dialog

- **Full viewport**: A file explorer with tree + preview panels benefits greatly from full-screen real estate. A `max-w-6xl` dialog feels cramped.
- **No nested dialog headaches**: The Agent Skills page already has detail and delete dialogs. Adding a file viewer dialog on top creates awkward layering.
- **Simpler parent pages**: Both the Agent Skills list and Learning Space detail just render a `<Link>` or `router.push()` — zero dialog state management.
- **Shareable URL**: `/agent_skills/{id}` is bookmarkable and can be shared.
- **Natural navigation**: Back button works as expected. The detail page replaces the existing detail dialog, consolidating rather than adding complexity.

### Key Design Decisions

- **Extract, don't duplicate**: The core tree + preview logic from `disk/page.tsx` (TreeNode types, Node component, `getLanguageExtension`, tree data management, file preview) is extracted into `DiskTreeViewer`. The Disk page itself will also be refactored to use this component in a future pass (out of scope for this PR to keep diff focused).
- **Read-only**: The skill file viewer is read-only — no upload, delete, or edit metadata buttons. The `Node` component is simplified: no `onUploadClick`, no `isUploading` prop. The `DiskTreeViewer` omits Download, Edit Meta, and Delete buttons from the content panel.
- **Replace the detail dialog**: The existing detail dialog in `agent_skills/page.tsx` is removed. Row click and "View" button both navigate to `/agent_skills/[id]`. This consolidates detail viewing into one place.
- **Dynamic tree height**: `DiskTreeViewer` uses `flex-1` / `h-full` to fill available space. The tree component's height is measured from the container via a ref + `clientHeight` approach and passed to `react-arborist`'s `<Tree height={...}>`.
- **Designed for reuse**: `DiskTreeViewer` props are designed so the Disk page can adopt it later (optional `readOnly` flag, optional action callbacks).

## TODOs

- [ ] **1. Add `disk_id` to the `AgentSkill` TypeScript type**
  - Files: `src/server/ui/types/index.ts`
  - Add `disk_id: string` field to the `AgentSkill` interface (after the `id` field).
  - The Go model already serializes it as `json:"disk_id"` (`src/server/api/go/internal/modules/model/agent_skills.go` line 20), so the API already returns it — only the TS type is missing.

- [ ] **2. Create `DiskTreeViewer` component**
  - Files: `src/server/ui/components/disk-tree-viewer/disk-tree-viewer.tsx`
  - Extract from `disk/page.tsx`:
    - `TreeNode` interface (lines 68-76)
    - `truncateMiddle()` utility (lines 85-98)
    - `getLanguageExtension()` utility (lines 101-171)
    - `Node` component (lines 173-309) — **simplified**: remove `onUploadClick`, `isUploading` props, remove the folder upload button hover behavior. The read-only `NodeProps` only needs `loadingNodes` and `t`.
    - `formatArtifacts()` helper (lines 415-432)
    - Tree data management: `handleToggle`, `handleSelect` pattern (lines 455-513)
    - File preview panel: metadata display, CodeMirror preview, image preview (lines 1189-1410) — **without** Download, Edit Meta, Delete action buttons
  - Props interface:
    ```ts
    interface DiskTreeViewerProps {
      diskId: string;
      readOnly?: boolean;      // Default true; future Disk page reuse can set false
      className?: string;
    }
    ```
  - Uses existing `disk/actions.ts` for API calls (`getListArtifacts`, `getArtifact`)
  - Layout: `ResizablePanelGroup` with two panels — file tree (left, 35%) and preview (right, 65%)
  - Tree height: measure container with a ref and pass dynamic `height` to `<Tree>`.
  - **Error state**: If `getListArtifacts` fails, show inline error message with retry button inside the tree panel.
  - **Empty state**: If root has no files/folders, show "No files found" centered message.

- [ ] **3. Ensure `getAgentSkill` (single-fetch) server action exists**
  - Files: `src/server/ui/app/agent_skills/actions.ts`
  - The detail page needs to fetch one skill by ID. Check if a `getAgentSkill(id)` action exists; if not, add one calling `GET /api/v1/agent_skills/{id}`.

- [ ] **4. Create skill detail page**
  - Files: `src/server/ui/app/agent_skills/[id]/page.tsx`
  - Header section:
    - Back button (`← Back to Skills`) linking to `/agent_skills`
    - Skill name, description, file count badge, created/updated timestamps
    - Delete button (reuse existing delete logic with `AlertDialog` confirmation)
  - Body: Render `<DiskTreeViewer diskId={skill.disk_id} />` filling the remaining viewport height.
  - Loading state: `Loader2` spinner while fetching skill.
  - Error state: If skill not found (404), show message with back link.
  - Guard: If `disk_id` is missing/empty, show "This skill has no associated file storage" message instead of the tree.

- [ ] **5. Update Agent Skills list page**
  - Files: `src/server/ui/app/agent_skills/page.tsx`
  - **Remove** the detail dialog (`detailDialogOpen`, `selectedSkill`, `handleViewDetails`, and the `<Dialog>` block).
  - Change the "Details" button in each table row to navigate to `/agent_skills/[id]` (use `router.push` or `<Link>`).
  - The delete dialog stays on the list page (it's a quick action, doesn't need its own page).

- [ ] **6. Update Learning Space detail page**
  - Files: `src/server/ui/app/learning_spaces/[id]/page.tsx`
  - **Add** a "View Files" button alongside the existing "View in Skills" button on each skill card (lines 341-348).
  - "View Files" navigates to `/agent_skills/[skill.id]`.
  - Use `FolderOpen` icon from lucide-react to differentiate from the `ExternalLink` icon on "View in Skills".
  - The "View in Skills" button can be **removed** since the new detail page subsumes its purpose (it currently just navigates to the skills list page, not to a specific skill).

- [ ] **7. Add i18n translations**
  - Files: `src/server/ui/messages/en.json`, `src/server/ui/messages/zh.json`
  - Add new `"skillDetail"` section with keys:

    | Key | English | Chinese |
    |-----|---------|---------|
    | `backToSkills` | Back to Skills | 返回技能列表 |
    | `filesTitle` | Files | 文件 |
    | `contentTitle` | Content | 内容 |
    | `selectFilePrompt` | Select a file to view its content | 选择文件以查看内容 |
    | `loadingFiles` | Loading files... | 加载文件中... |
    | `loadingSkill` | Loading skill... | 加载技能中... |
    | `loadPreview` | Load Preview | 加载预览 |
    | `loadingPreview` | Loading preview... | 加载预览中... |
    | `mimeType` | MIME Type | MIME 类型 |
    | `size` | Size | 大小 |
    | `createdAt` | Created At | 创建时间 |
    | `updatedAt` | Updated At | 更新时间 |
    | `noFiles` | No files found in this skill. | 此技能中未找到文件。 |
    | `noAssociatedDisk` | This skill has no associated file storage. | 此技能没有关联的文件存储。 |
    | `notFound` | Skill not found. | 未找到该技能。 |
    | `loadError` | Failed to load files. | 加载文件失败。 |
    | `retry` | Retry | 重试 |

  - Add `viewFiles` key to the `learningSpaces` i18n section.

## New Dependencies

None — all required packages are already installed:
- `react-arborist` (file tree)
- `@uiw/react-codemirror` + language extensions (syntax highlighting)
- `lucide-react` (icons)
- `@/components/ui/*` (shadcn components: ResizablePanel, AlertDialog, etc.)

## Test Cases

### Happy Path
- [ ] **Agent Skills list -> detail page**: Click a skill row or "View" button -> navigates to `/agent_skills/[id]` -> shows skill metadata and file tree -> expand a folder -> click a file -> preview loads with syntax highlighting.
- [ ] **Learning Space -> skill detail**: Click "View Files" on a skill card -> navigates to `/agent_skills/[id]` -> same file browsing experience.
- [ ] **Back navigation**: Click "Back to Skills" -> returns to `/agent_skills` list. Browser back button also works.
- [ ] **Image file**: Selecting an image file shows image preview via presigned URL.
- [ ] **Markdown / code file**: Selecting a .md or .py file shows syntax-highlighted content.
- [ ] **Delete from detail page**: Click delete on the detail page -> confirmation dialog -> skill deleted -> redirected back to list.

### Edge Cases
- [ ] **Empty skill**: If a skill's disk has no files, the viewer shows "No files found" message.
- [ ] **Skill with missing/null disk_id**: Shows "This skill has no associated file storage" instead of crashing.
- [ ] **Invalid skill ID in URL**: Navigating to `/agent_skills/[nonexistent-id]` shows "Skill not found" with a back link.
- [ ] **Large file tree**: Folder expansion lazy-loads children correctly (loading spinner shown during fetch).
- [ ] **API error**: If `getListArtifacts` returns an error, show error message with retry button.

### Cross-Cutting
- [ ] **i18n**: All strings render correctly in both English and Chinese.
- [ ] **Theme**: Viewer respects dark/light theme (CodeMirror theme switches between `okaidia` / `"light"`).
- [ ] **Responsive**: Page is usable at viewport widths down to ~768px (panels may stack or reduce).

## Follow-Up (Out of Scope)

- Refactor `disk/page.tsx` to use the extracted `DiskTreeViewer` component, removing ~400 lines of duplicated code.
- Add `readOnly={false}` mode to `DiskTreeViewer` with upload/delete/edit-meta callbacks for the Disk page.
