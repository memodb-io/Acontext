# Learning Space UI Tab

## Features / Showcase

The Learning Space UI tab provides a dashboard-level view to manage **Learning Spaces** — containers for skills that evolve based on task outcomes. Users will be able to:

1. **List learning spaces** with cursor-based pagination, server-side user filtering, and server-side meta filtering
2. **Create** a new learning space (optionally with user identifier & meta JSON)
3. **View details** of a learning space including its associated skills and learned sessions
4. **Delete** a learning space with confirmation dialog
5. **Manage skills** within a space — view skills (clicking "View" navigates to the Agent Skills page), include by skill ID, exclude with confirmation
6. **View learned sessions** — see which sessions have been ingested and their processing status (`pending`/`done`/`failed`)
7. **Trigger learning** — submit a session ID to learn from

### UI Layout

```
Sidebar: [Learning Spaces] ← new nav item with BookOpen icon

/learning_spaces (list page)
┌──────────────────────────────────────────────────────────────┐
│ Learning Spaces                               [Create] [⟳]  │
│ Manage learning spaces for skill evolution                   │
│ [Filter by user...]  [Filter by meta: {"key":"value"}...]    │
├──────────────────────────────────────────────────────────────┤
│ ID (short) │ User (or —)    │ Meta (preview) │ Created At   │
│ ─ ─ ─ ─ ─ │ ─ ─ ─ ─ ─ ─ ─  │ ─ ─ ─ ─ ─ ─ ─ │ ─ ─ ─ ─ ─ ─ │
│ abc123..   │ alice@exam..   │ {"ver":"1.0"}  │ 2/15/2026    │
│ ...rows    │                │                │  [Details] [🗑]│
└──────────────────────────────────────────────────────────────┘

/learning_spaces/[id] (detail page)
┌──────────────────────────────────────────────────────────────┐
│ ← Back to Learning Spaces                                    │
│ Learning Space: abc12345                                     │
│ User: alice@example.com (or —) │ Created: 2/15/2026 │ Updated: … │
│ Meta: { "key": "value", ... }                                │
├──────────── [Skills] [Sessions] ─────────────────────────────┤
│                                                              │
│ Skills Tab (default):                                        │
│ ┌─── Skills Table (AgentSkill objects) ───────────────────┐  │
│ │ Name │ Description │ Files │ Actions                    │  │
│ │ ...  │ ...         │  3    │ [→ View in Skills] [Remove]│  │
│ └─────────────────────────────────────────────────────────┘  │
│ [+ Include Skill] (dialog with skill ID input)               │
│                                                              │
│ Sessions Tab:                                                │
│ ┌─── Sessions Table ──────────────────────────────────────┐  │
│ │ Session ID (short) │ Created At   │ Actions             │  │
│ │ f8a2...            │ 2/15/2026    │ [→ View Session]    │  │
│ └─────────────────────────────────────────────────────────┘  │
│ [+ Learn from Session] (dialog with session ID input)        │
│                                                              │
│ Error State (when space not found):                          │
│ ┌─────────────────────────────────────────────────────────┐  │
│ │ ⚠ Learning space not found.                             │  │
│ │ [← Back to Learning Spaces]                             │  │
│ └─────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

> **Note:** The list page intentionally omits skill/session *count* columns because the `GET /learning_spaces` response doesn't include counts. Counts are visible on the detail page after fetching sub-resources.
>
> **Note:** The detail page uses a **separate page** (not a dialog) because learning spaces have two sub-resource tabs (Skills, Sessions) — this warrants a full page layout unlike `agent_skills` which uses a detail dialog for a flat set of fields.

## Design Overview

### Architecture

Follows the established patterns from `agent_skills` and `session` pages:

- **Server Actions** (`actions.ts`) — all API calls return `Promise<ApiResponse<T>>`, use `getAuthHeaders()` for auth, `handleResponse<T>()` / `handleError()` for response/error handling
- **Client Components** (`"use client"`) for interactive pages with state management via `useState` / `useEffect`
- **i18n** — translations in `en.json` and `zh.json` under a `"learningSpaces"` key; accessed via `useTranslations("learningSpaces")`
- **Sidebar** — navigation entry with `BookOpen` icon from `lucide-react`, added to `otherNavItems`
- **Toast notifications** — `import { toast } from "sonner"` for action feedback (create, delete, include, exclude, learn). Note: `sonner` is installed and `<Toaster />` is mounted in `app/layout.tsx`. The `traces` page already uses this pattern. The `agent_skills` page uses `console.error` instead — learning spaces improves on this with user-visible toasts.
- **Loading states** — `Loader2` spinner on buttons during async ops; full-page `Loader2` spinner during initial data fetch (same as `agent_skills`)
- **Timestamp formatting** — Use `new Date(ts).toLocaleString()` for all timestamps, consistent with existing pages

### API Response Envelope

All API responses use the Go `serializer.Response` struct:
```json
{ "code": 0, "data": ..., "msg": "..." }
```

Server actions use `handleResponse<T>()` which extracts `result.data` on success and returns `ApiResponse<T>`.

**Important — error message field mismatch:** The Go API returns error messages under the `"msg"` JSON key, but `handleResponse` reads `errorJson.message` (which doesn't exist). This causes all HTTP error responses (404, 409, 500) to fall back to "Internal Server Error". **Fix required** (see TODO 0): update `handleResponse` to read `errorJson.msg || errorJson.message` so that specific error messages like "skill already included" are surfaced to the UI.

### Reusable Components

| Component | From | Usage |
|-----------|------|-------|
| `Table` / `TableHeader` / `TableBody` / `TableRow` / `TableCell` | `@/components/ui/table` | List page table, skills table, sessions table |
| `Dialog` / `DialogContent` / `DialogDescription` / `DialogHeader` / `DialogTitle` / `DialogFooter` | `@/components/ui/dialog` | Create space, include skill, learn session |
| `AlertDialog` / `AlertDialogAction` / `AlertDialogCancel` / `AlertDialogContent` / `AlertDialogDescription` / `AlertDialogFooter` / `AlertDialogHeader` / `AlertDialogTitle` | `@/components/ui/alert-dialog` | Delete space confirmation, exclude skill confirmation |
| `Button` | `@/components/ui/button` | All action buttons |
| `Input` | `@/components/ui/input` | Filters, skill ID, session ID inputs |
| `Badge` | `@/components/ui/badge` | File count in skills table |
| `Tabs` / `TabsList` / `TabsTrigger` / `TabsContent` | `@/components/ui/tabs` | Skills vs Sessions toggle on detail page |
| `Textarea` | `@/components/ui/textarea` | Meta JSON editor in create dialog |
| `Loader2` / `BookOpen` / `ArrowLeft` / `RefreshCw` / `Trash2` / `Plus` / `ExternalLink` | `lucide-react` | Icons for loading, nav, back, refresh, delete, add, view (navigate) |
| `toast` | `sonner` | Success/error notifications |

### API Integration

Server actions wrapping the learning space API endpoints (all under `/api/v1/learning_spaces`).
Delete/exclude endpoints return `{ msg: "ok" }` in the raw response; after `handleResponse<null>`, the unwrapped `data` is `null`.

| Action | Method | Endpoint | Request | Response Type | Used In |
|--------|--------|----------|---------|---------------|---------|
| `getLearningSpaces` | GET | `/learning_spaces?user=&limit=&cursor=&time_desc=&filter_by_meta=` | Query params | `ApiResponse<GetLearningSpacesResp>` | List page |
| `getLearningSpace` | GET | `/learning_spaces/{id}` | — | `ApiResponse<LearningSpace>` | Detail page header |
| `createLearningSpace` | POST | `/learning_spaces` | `{ user?: string, meta?: object }` | `ApiResponse<LearningSpace>` | Create dialog |
| `updateLearningSpace` | PATCH | `/learning_spaces/{id}` | `{ meta: object }` | `ApiResponse<LearningSpace>` | *(future — meta edit)* |
| `deleteLearningSpace` | DELETE | `/learning_spaces/{id}` | — | `ApiResponse<null>` | Delete confirmation |
| `learnFromSession` | POST | `/learning_spaces/{id}/learn` | `{ session_id: string }` | `ApiResponse<LearningSpaceSession>` | Learn dialog |
| `listSpaceSkills` | GET | `/learning_spaces/{id}/skills` | — | `ApiResponse<AgentSkill[]>` | Detail — Skills tab |
| `includeSkill` | POST | `/learning_spaces/{id}/skills` | `{ skill_id: string }` | `ApiResponse<LearningSpaceSkill>` | Include skill dialog |
| `excludeSkill` | DELETE | `/learning_spaces/{id}/skills/{skill_id}` | — | `ApiResponse<null>` | Remove skill button |
| `listSpaceSessions` | GET | `/learning_spaces/{id}/sessions` | — | `ApiResponse<LearningSpaceSession[]>` | Detail — Sessions tab |

> **Important:** `listSpaceSkills` returns full `AgentSkill[]` objects (not join-table entities), so the Skills tab can directly display skill name, description, and file count.
>
> **Important:** `listSpaceSkills` and `listSpaceSessions` return all items (no cursor pagination) since a space typically has a manageable number of skills/sessions.
>
> **Note:** `updateLearningSpace` is included in the actions file for completeness but not wired into any UI in this iteration. The meta edit feature can be added later.

### TypeScript Types (added to `types/index.ts`)

```typescript
export interface LearningSpace {
  id: string;
  user_id: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface GetLearningSpacesResp {
  items: LearningSpace[];
  next_cursor?: string; // omitted from JSON (not null) when no more pages — Go uses `omitempty`
  has_more: boolean;
}

export interface LearningSpaceSession {
  id: string;
  learning_space_id: string;
  session_id: string;
  status: "pending" | "done" | "failed";
  created_at: string;
  updated_at: string;
}

export interface LearningSpaceSkill {
  id: string;
  learning_space_id: string;
  skill_id: string;
  created_at: string;
}
```

> **Note:** `LearningSpaceSkill` is only used as the response type for the `includeSkill` action. The Skills tab itself uses the existing `AgentSkill` type since `listSpaceSkills` returns full skill objects.

### Key UX Decisions

1. **No count columns on list page** — The list API doesn't return skill/session counts. Fetching counts per row would cause N+1 queries. Instead, counts are visible on the detail page.
2. **User field** — The create dialog accepts a **user identifier** string (e.g. email). The API resolves it to a `user_id` UUID internally. The list/detail pages display the **human-readable user identifier** (not the UUID). Since the `LearningSpace` API only returns `user_id` (UUID), we resolve identifiers client-side: after fetching learning spaces, collect unique non-null `user_id` values, fetch users via the existing `getUsers` action, and build a `Map<string, string>` (`user_id → identifier`). The table/header then displays the resolved identifier, or "—" if `user_id` is null. If a user_id cannot be resolved (e.g., deleted user), fall back to showing the first 8 chars of the UUID with "…".
3. **Meta filter** — The filter input accepts a JSON string (e.g. `{"version":"1.0"}`) which is URL-encoded and passed as `filter_by_meta` to the API. A placeholder example guides the user. Invalid JSON shows an inline validation hint and is not sent to the server.
4. **Meta JSON validation** — The create dialog validates the meta textarea as valid JSON before submission, showing an inline error if invalid.
5. **Filters are server-side** — Both `user` and `filter_by_meta` are passed as API query params during the fetch loop. Filter changes trigger a full data reload (not client-side filtering). Debounce filter inputs by 500ms to avoid excessive API calls while typing.
6. **Cursor pagination on list page** — Same pattern as `agent_skills`: load all pages in a while loop (limit=50, `time_desc=true` for newest-first) with the current filter params, store the full result in state.
7. **Detail page default tab** — "Skills" is the default active tab.
8. **Detail page parallel loading** — On mount, fire `getLearningSpace(id)`, `listSpaceSkills(id)`, and `listSpaceSessions(id)` concurrently via `Promise.all` to minimize load time.
9. **Detail page 404 handling** — If `getLearningSpace` returns an error (code !== 0), show a centered error message with a "Back to Learning Spaces" button. Do not render tabs.
10. **Sessions table shows `session_id` + view action** — The table column labeled "Session ID" displays the `session_id` field (the actual session UUID), not the junction row `id`. The short display truncates to the first 8 characters. Status column is omitted for now (can be added later). An Actions column provides a "View Session" button that navigates to `/session/[sessionId]/messages`.
11. **Separate detail page** — Unlike `agent_skills` (which uses a dialog), learning spaces warrant a full detail page because they have two sub-resource tabs (Skills, Sessions). The dialog pattern is insufficient for managing sub-resources.
12. **Empty state differentiation** — Track whether filters are active (`filterUser !== "" || filterMeta !== ""`) to show "No learning spaces found" vs "No matching learning spaces" (same pattern as `agent_skills`).
13. **View skill navigates away** — Clicking "View" on a skill row navigates to `/agent_skills`. Uses `ExternalLink` icon to signal navigation away. No in-page skill detail dialog.
14. **Null meta handling** — The Go API returns `meta: null` when a learning space is created without meta (the GORM model has no `default:'{}'`). The TypeScript type uses `meta: Record<string, unknown> | null`. Display logic: list page meta column shows "—" for `null` meta (not the string `"null"`). Detail page `<pre>` block shows "—" for `null` meta. `JSON.stringify(meta, null, 2)` is only called when `meta !== null`. The meta filter still works correctly — `null` meta won't match any JSON containment filter, which is expected behavior.

## TODOs

### 0. Fix `handleResponse` error message extraction (prerequisite)
- [x] In `handleResponse`, the error branch reads `errorJson.message` but the Go API returns `errorJson.msg`. Fix to read both:
  - Line 28: change `errorJson.message || "Internal Server Error"` → `errorJson.msg || errorJson.message || "Internal Server Error"`
  - Line 44: change `result.message || "Error"` → `result.msg || result.message || "Error"`
  - Line 51: change `result.message || "success"` → `result.msg || result.message || "success"`
- **Why:** Without this fix, all HTTP error responses (404 "skill not found", 409 "skill already included") display as "Internal Server Error" in toast messages.
- **Impact:** This is a shared utility fix that benefits all existing pages too.
- **Files:** `src/server/ui/lib/api-config.ts`

### 1. Add TypeScript types
- [x] Add `LearningSpace`, `GetLearningSpacesResp`, `LearningSpaceSession`, `LearningSpaceSkill` types
- **Files:** `src/server/ui/types/index.ts`

### 2. Create server actions
- [x] Implement all 10 API wrapper functions following the `agent_skills/actions.ts` pattern
  - Each function: `"use server"`, returns `Promise<ApiResponse<T>>`, uses `getAuthHeaders()`, wraps in `try/catch` with `handleResponse<T>()` / `handleError()`
  - `getLearningSpaces(limit: number, cursor?: string, user?: string, timeDesc?: boolean, filterByMeta?: string)` — GET with query params via `URLSearchParams`. Always append `limit` and `time_desc`. Only append `cursor` if defined. Only append `user` if defined (NOT empty string — caller passes `undefined` for no filter). Only append `filter_by_meta` if defined (caller validates JSON and passes `undefined` for no filter).
    **Critical — use explicit `!== undefined` checks** (not truthiness) when appending optional params to `URLSearchParams`, because `params.append("user", undefined)` serializes as the string literal `"undefined"`:
    ```
    const params = new URLSearchParams({
      limit: limit.toString(),
      time_desc: (timeDesc ?? false).toString(),
    });
    if (cursor !== undefined) params.append("cursor", cursor);
    if (user !== undefined) params.append("user", user);
    if (filterByMeta !== undefined) params.append("filter_by_meta", filterByMeta);
    ```
  - `getLearningSpace(id)` — GET by ID
  - `createLearningSpace(user?, meta?)` — POST with JSON body `{ user, meta }`
  - `updateLearningSpace(id, meta)` — PATCH (for future use)
  - `deleteLearningSpace(id)` — DELETE, typed as `Promise<ApiResponse<null>>`
  - `learnFromSession(id, sessionId)` — POST with `{ session_id: string }`
  - `listSpaceSkills(id)` — GET, typed as `Promise<ApiResponse<AgentSkill[]>>`
  - `includeSkill(id, skillId)` — POST with `{ skill_id: string }`
  - `excludeSkill(id, skillId)` — DELETE, typed as `Promise<ApiResponse<null>>`
  - `listSpaceSessions(id)` — GET, typed as `Promise<ApiResponse<LearningSpaceSession[]>>`
- **Files:** `src/server/ui/app/learning_spaces/actions.ts` (new)

### 3. Add i18n translations
- [x] Add `"learningSpaces"` key to `sidebar` section (for nav item label)
- [x] Add `"learningSpaces"` top-level section with all UI strings:
  - Page: `title`, `description`
  - List table columns: `id`, `user` (resolved identifier), `meta`, `createdAt`, `actions`
  - Detail skills table columns: `name`, `skillDescription`, `files`
  - Detail sessions table columns: `sessionId`, `actions`
  - Actions: `create`, `delete`, `refresh`, `details`, `includeSkill`, `excludeSkill`, `learnFromSession`, `viewInSkills`, `viewSession`, `remove`
  - Dialogs: `createTitle`, `createDescription` (mention auto-created default skills), `deleteConfirmTitle`, `deleteConfirmDescription`, `includeSkillTitle`, `includeSkillDescription`, `excludeSkillConfirmTitle`, `excludeSkillConfirmDescription`, `learnTitle`, `learnDescription`
  - Form: `userPlaceholder`, `metaPlaceholder`, `skillIdPlaceholder`, `sessionIdPlaceholder`, `invalidJson`
  - Buttons: `cancel`, `confirm`, `close`
  - Tabs: `skillsTab`, `sessionsTab`
  - States: `noSpaces`, `noSpacesMatching`, `noSkills`, `noSessions`, `loading`, `notFound`
  - Errors: `createError`, `deleteError`, `includeError`, `excludeError`, `learnError`, `fetchError`
  - Success: `createSuccess`, `deleteSuccess`, `includeSuccess`, `excludeSuccess`, `learnSuccess`
  - Detail header: `backToList`, `spaceId`, `userId`, `metaLabel`
- **Files:** `src/server/ui/messages/en.json`, `src/server/ui/messages/zh.json`

### 4. Add sidebar navigation entry
- [x] Import `BookOpen` from `lucide-react`
- [x] Add `{ title: t("learningSpaces"), url: "/learning_spaces", icon: BookOpen }` to `otherNavItems` array
- Active state already works via existing logic: `pathname === item.url || pathname.startsWith(item.url + "/")`
- **Files:** `src/server/ui/components/app-sidebar.tsx`

### 5. Create list page (`/learning_spaces`)
- [x] Create the main learning spaces list page with:
  - `"use client"` directive, `useTranslations("learningSpaces")` for i18n, `useRouter()` from `next/navigation`
  - State: `spaces: LearningSpace[]`, `userMap: Map<string, string>` (user_id → identifier), `isLoading: boolean`, `isRefreshing: boolean`, `filterUser: string`, `filterMeta: string`, `metaJsonError: boolean`, `createDialogOpen: boolean`, `deleteDialogOpen: boolean`, `deleteTargetId: string | null`, `isCreating: boolean`, `isDeleting: boolean`
  - **Data loading:** `fetchSpaces(user, meta)` accepts filter params explicitly (avoids stale closures) and loads all pages via cursor loop (same pattern as `agent_skills/page.tsx`). Wrap in `useCallback` with empty deps so the function reference is stable for the `useEffect` deps array:
    ```
    const fetchSpaces = useCallback(async (userFilter?: string, metaFilter?: string) => {
      setIsLoading(true);
      try {
        const allSpaces: LearningSpace[] = [];
        let cursor: string | undefined = undefined;
        let hasMore = true;
        while (hasMore) {
          const res = await getLearningSpaces(
            50, cursor,
            userFilter || undefined,   // omit empty string
            true,                       // time_desc=true (newest-first)
            metaFilter || undefined     // omit empty/invalid JSON
          );
          if (res.code !== 0) { console.error(res.message); break; }
          allSpaces.push(...(res.data?.items || []));
          cursor = res.data?.next_cursor;
          hasMore = res.data?.has_more || false;
        }
        setSpaces(allSpaces);
        // Resolve user identifiers in batch
        const userIds = [...new Set(allSpaces.map(s => s.user_id).filter(Boolean))] as string[];
        if (userIds.length > 0) {
          const usersRes = await getUsers(200); // fetch users (reuse from users page actions)
          if (usersRes.code === 0 && usersRes.data?.items) {
            const map = new Map<string, string>();
            for (const u of usersRes.data.items) {
              map.set(u.id, u.identifier);
            }
            setUserMap(map);
          }
        }
      } catch (error) {
        console.error("Failed to load learning spaces:", error);
      } finally {
        setIsLoading(false);
      }
    }, []);  // stable: no closure deps (setIsLoading, setSpaces, getLearningSpaces, getUsers are all stable)
    ```
    **Important**: pass `undefined` (not empty string `""`) for optional params that are empty — the Go API interprets `?user=` as a filter for empty user identifier. `getLearningSpaces` action must NOT append params whose value is `undefined`.
  - **Compute `validMeta` before calling fetch** — derive from `filterMeta` and `metaJsonError`:
    ```
    // Compute valid meta JSON string for API call (or undefined if empty/invalid)
    const getValidMeta = (meta: string, hasError: boolean): string | undefined => {
      if (!meta || hasError) return undefined;
      return meta;
    };
    ```
  - **Initial load + filter reload (single `useEffect`):**
    ```
    const isFirstRender = useRef(true);
    useEffect(() => {
      const validMeta = getValidMeta(filterMeta, metaJsonError);
      // On first render: fetch immediately (no debounce delay)
      if (isFirstRender.current) {
        isFirstRender.current = false;
        fetchSpaces(filterUser || undefined, validMeta);
        return;
      }
      // On subsequent filter changes: debounce 500ms
      if (filterMeta && metaJsonError) return; // invalid JSON — skip fetch
      const timer = setTimeout(() => fetchSpaces(filterUser || undefined, validMeta), 500);
      return () => clearTimeout(timer);
    }, [filterUser, filterMeta, metaJsonError]);
    ```
    This avoids the double-fetch bug: a single `useEffect` handles both initial load (immediate) and filter changes (debounced). No separate `useEffect(() => { fetchSpaces() }, [])`.
    **Note:** `fetchSpaces` is wrapped in `useCallback([], ...)` making it referentially stable, so it can safely be omitted from the `useEffect` deps (or included — either way it won't cause extra renders). The deps `[filterUser, filterMeta, metaJsonError]` are the only values that trigger re-evaluation. `metaJsonError` is included so the effect re-evaluates when JSON validity changes (e.g., user corrects invalid JSON and the fetch should proceed).
  - **Filters:** Two `Input` fields — user identifier and meta JSON:
    - User filter: `onChange` updates `filterUser` state. No validation needed.
    - Meta filter: `onChange` updates `filterMeta` state. On each change, validate via `JSON.parse` — set `metaJsonError = true` if invalid. Show `text-destructive text-xs` hint below input when `metaJsonError && filterMeta !== ""`. The `useEffect` above skips the fetch when `metaJsonError` is true.
  - **User identifier resolution:** After `fetchSpaces` loads all spaces, collect unique non-null `user_id` values, fetch users via `getUsers` (reuse from users page actions), and build a `userMap: Map<string, string>` mapping `user_id → identifier`. Store in state as `userMap`. This avoids N+1 lookups — one batch fetch covers all rows. If resolution fails, log and fall back to short UUID display.
  - **Table columns:** ID (first 8 chars + "…"), User (`userMap.get(space.user_id) ?? space.user_id?.slice(0, 8) + "…"`, or "—" if `user_id` is null), Meta (`meta !== null ? JSON.stringify(meta)` truncated to 50 chars, or "—" if `null`), Created At (`toLocaleString()`), Actions column
  - **Actions column:** "Details" `Button` variant `secondary` size `sm` → `router.push(...)`, "Delete" `Button` variant `secondary` size `sm` with `className="text-destructive hover:text-destructive"` and `Trash2` icon → opens `AlertDialog`. Both buttons use `e.stopPropagation()` in their `onClick` handlers to prevent the row-level click from also firing navigation (see Row click below).
  - **Create dialog:** `Dialog` with:
    - `Input` for user identifier (optional), placeholder: `"e.g. alice@example.com"`
    - `Textarea` for meta JSON (optional), placeholder: `'{"key": "value"}'`
    - JSON validation on meta before submit — if invalid, show inline error, disable submit button
    - On submit: call `createLearningSpace(user || undefined, parsedMeta || undefined)`. On success (`res.code === 0`): `toast.success()`, close dialog, reset form, refresh list. On error: `toast.error(res.message)`.
    - "Cancel" button closes dialog
    - **Note:** The API automatically creates 2 default skills (daily-logs, user-general-facts) when a learning space is created. The create dialog description should mention this: `t("createDescription")` = "Create a new learning space. Two default skills will be automatically included."
  - **Delete dialog:** `AlertDialog` with confirmation text including short space ID. On confirm: call `deleteLearningSpace(id)`. On success: `toast.success()`, refresh list. On error: `toast.error(res.message)`.
  - **Row click:** `onClick={() => router.push(\`/learning_spaces/${space.id}\`)}` on `<TableRow>` with `className="cursor-pointer"`. **Important:** action buttons in the row (Details, Delete) must call `e.stopPropagation()` in their `onClick` to prevent the row click from also firing (which would navigate away instead of opening the delete dialog).
  - **Refresh button:** Same pattern as `agent_skills`: `handleRefresh` sets `isRefreshing(true)`, calls `fetchSpaces(filterUser || undefined, getValidMeta(filterMeta, metaJsonError))` (passing current filter values explicitly, which sets `isLoading(true)` — full-page spinner shows during refresh, same as initial load), then clears `isRefreshing`. Button is `disabled` while `isRefreshing` to prevent double-clicks.
  - **Empty state:** `spaces.length === 0`:
    - If no filters active: `t("noSpaces")` — "No learning spaces found. Create one to get started."
    - If filters active: `t("noSpacesMatching")` — "No matching learning spaces found."
  - **Loading state:** Full-page centered `Loader2 animate-spin` while `isLoading` (same as `agent_skills`)
- **Files:** `src/server/ui/app/learning_spaces/page.tsx` (new)

### 6. Create detail page (`/learning_spaces/[id]`)
- [x] Create the detail page with:
  - `"use client"` directive, `useParams()` to get `id`, `useRouter()` for navigation, `useTranslations("learningSpaces")` for i18n
  - **State:** `space: LearningSpace | null`, `userIdentifier: string | null` (resolved from user_id), `skills: AgentSkill[]`, `sessions: LearningSpaceSession[]`, `isLoading: boolean`, `error: string | null`, `includeDialogOpen: boolean`, `learnDialogOpen: boolean`, `excludeTarget: AgentSkill | null` (for exclude confirmation), `isIncluding: boolean`, `isExcluding: boolean`, `isLearning: boolean`
  - **Data loading on mount:** `useEffect` fires three calls concurrently via `Promise.all`:
    ```
    const [spaceRes, skillsRes, sessionsRes] = await Promise.all([
      getLearningSpace(id),
      listSpaceSkills(id),
      listSpaceSessions(id),
    ]);
    ```
    If `spaceRes.code !== 0`: set `error = spaceRes.message`, stop (do not process skills/sessions).
    Otherwise: set `space = spaceRes.data`, `skills = skillsRes.data ?? []`, `sessions = sessionsRes.data ?? []`. Skills/sessions failures are non-fatal — just show empty arrays (the space header is the critical call).
    After setting space, if `spaceRes.data?.user_id` is non-null, resolve identifier: fetch users via `getUsers`, find matching user by `id === user_id`, set `userIdentifier = user.identifier`. If resolution fails, leave `userIdentifier` as `null` (header falls back to short UUID).
  - **Error state:** If `error` is set, show centered message (`error` text) with a "Back to Learning Spaces" `Button`. Do not render header or tabs.
  - **Back nav:** `Button` variant `ghost` with `ArrowLeft` icon, `onClick={() => router.push("/learning_spaces")}`
  - **User identifier resolution (detail page):** After fetching the space, if `space.user_id` is non-null, resolve the identifier. Fetch users via `getUsers` and find the matching user. Store resolved identifier in state `userIdentifier: string | null`. Fall back to short UUID if resolution fails.
  - **Header:** Space ID (first 8 chars), User (`userIdentifier ?? user_id?.slice(0, 8) + "…"`, or "—" if `user_id` is null), meta (if `meta !== null`: formatted via `JSON.stringify(meta, null, 2)` in `<pre>` block; if `null`: show "—"), created/updated timestamps via `toLocaleString()`
  - **Tabs component** with `defaultValue="skills"` switching between "Skills" and "Sessions"
  - **Skills tab:**
    - Table: Name, Description (truncated), Files (`Badge` with `file_index.length`), Actions
    - **"View in Skills" button:** `Button` variant `secondary` size `sm` with `ExternalLink` icon → `router.push("/agent_skills")`. Navigates to the Agent Skills page.
    - **"Remove" button:** `Button` variant `secondary` size `sm` with `className="text-destructive hover:text-destructive"` and `Trash2` icon → sets `excludeTarget` → opens `AlertDialog`
    - **Include skill dialog:** `Dialog` with `Input` for skill ID (UUID). On submit: call `includeSkill(spaceId, skillId)`. On success (`res.code === 0`): `toast.success()`, close dialog, clear input, refresh skills via `listSpaceSkills(id)`. On error: `toast.error(res.message)`. **Refresh error handling:** if `listSpaceSkills` fails after a successful include, show `toast.error(t("fetchError"))` — the skill was added server-side but the UI couldn't refresh.
    - **Exclude skill confirmation:** `AlertDialog` mentioning `excludeTarget.name`. On confirm: call `excludeSkill(spaceId, skillId)`. On success: `toast.success()`, clear `excludeTarget`, refresh skills via `listSpaceSkills(id)`. On error: `toast.error(res.message)`. **Refresh error handling:** same as include — toast on refresh failure.
    - **Empty state:** Centered `p` with `text-muted-foreground`: `t("noSkills")`
  - **Sessions tab:**
    - Table: Session ID (`session_id` field, first 8 chars + "…"), Created At (`toLocaleString()`), Actions
    - **"View Session" button:** `Button` variant `secondary` size `sm` with `ExternalLink` icon → `router.push(\`/session/${session.session_id}/messages\`)`. Navigates to the session messages page.
    - **Status column omitted for now** — can be added back later when needed. The `LearningSpaceSession.status` field is still in the TypeScript type for future use.
    - **Learn from session dialog:** `Dialog` with `Input` for session ID (UUID). On submit: call `learnFromSession(spaceId, sessionId)`. On success: `toast.success()`, close dialog, clear input, refresh sessions via `listSpaceSessions(id)`. On error: `toast.error(res.message)`. **Refresh error handling:** if `listSpaceSessions` fails after a successful learn, show `toast.error(t("fetchError"))` — the learn was triggered server-side but the UI couldn't refresh.
    - **Empty state:** Centered `p` with `text-muted-foreground`: `t("noSessions")`
  - **Loading state:** Full-page centered `Loader2 animate-spin` while `isLoading`
- **Files:** `src/server/ui/app/learning_spaces/[id]/page.tsx` (new)

## New Dependencies

None — all UI primitives (`Tabs`, `Badge`, `Table`, `Dialog`, etc.) and icons (`lucide-react`) already exist. Toast notifications use the existing `sonner` setup.

## Test Cases

### Prerequisite — handleResponse fix
- [ ] `handleResponse` extracts `msg` from Go API error responses (not hardcoded "Internal Server Error")
- [ ] `handleResponse` still works for responses with `message` field (backward compat)
- [ ] Existing pages (agent_skills, sessions) still function correctly after the fix

### List Page
- [ ] Renders full-page `Loader2` spinner on initial load
- [ ] Initial load fetches immediately (no 500ms debounce delay)
- [ ] Only ONE fetch fires on mount (no double-fetch from initial load + filter effect)
- [ ] Displays learning spaces in table format after data loads
- [ ] Shows `t("noSpaces")` empty state when no learning spaces exist and no filters active
- [ ] Shows `t("noSpacesMatching")` empty state when filters are active but no results match
- [ ] Filter by user passes `user` query param to API and triggers full data reload (server-side)
- [ ] Filter by user is debounced (500ms) — rapid typing does not cause excessive API calls
- [ ] Filter by user passes `undefined` (not empty string `""`) when input is cleared — Go API must NOT receive `?user=`
- [ ] Filter by meta passes valid JSON as `filter_by_meta` query param to API (server-side)
- [ ] Filter by meta shows inline `text-destructive` hint for invalid JSON and does NOT fetch
- [ ] Filter by meta with invalid JSON skips the debounced fetch entirely
- [ ] Clearing filter inputs triggers a reload with no filter params (`undefined`)
- [ ] Fetch loop passes `time_desc=true` for newest-first ordering
- [ ] Fetch loop uses optional chaining: `res.data?.items || []`, `res.data?.next_cursor`, `res.data?.has_more || false`
- [ ] Cursor pagination loads all pages (while loop terminates correctly when `has_more === false`)
- [ ] Cursor pagination handles API error mid-loop (breaks, shows partial data already loaded)
- [ ] Create dialog: optional user + optional meta JSON, submits successfully, success toast, dialog closes, form resets, list refreshes
- [ ] Create dialog: validates meta textarea — invalid JSON shows inline error, submit button disabled
- [ ] Create dialog: empty meta is valid (sends `undefined`, not empty string)
- [ ] Create dialog: API error shows toast with `res.message`
- [ ] Delete confirmation: shows short space ID in message, success toast, list refreshes
- [ ] Delete confirmation: API error shows toast with `res.message`
- [ ] Row click navigates to `/learning_spaces/[id]`
- [ ] Details button navigates to `/learning_spaces/[id]`
- [ ] Clicking Delete button does NOT also navigate to detail page (`e.stopPropagation()` prevents row click from firing)
- [ ] Refresh button re-fetches data (full-page spinner shows during refresh, same as initial load)
- [ ] Refresh button is `disabled` while refresh is in progress (prevents double-click)
- [ ] Table shows "—" for spaces with `user_id === null`
- [ ] Table shows resolved user identifier (e.g. `alice@example.com`) instead of UUID
- [ ] Table falls back to short UUID (first 8 chars + "…") if user resolution fails
- [ ] User resolution is a single batch fetch (not N+1 per row)
- [ ] ID column shows first 8 chars + "…"
- [ ] Meta column shows truncated JSON preview (max ~50 chars)
- [ ] Meta column shows "—" when `meta` is `null` (not the string `"null"`)
- [ ] Meta column handles extremely large meta JSON gracefully (truncation works)
- [ ] Timestamps use `toLocaleString()`
- [ ] `URLSearchParams` never serializes `undefined` as the string literal `"undefined"` — verify network request params

### Detail Page
- [ ] Fires `getLearningSpace`, `listSpaceSkills`, `listSpaceSessions` via `Promise.all` on mount
- [ ] Shows loading spinner while waiting for all three calls
- [ ] Displays header: short ID, resolved user identifier (or "—"), formatted meta JSON, timestamps
- [ ] User identifier resolved from user_id UUID via users API; falls back to short UUID if resolution fails
- [ ] Shows error state with `res.message` and "Back" button when `getLearningSpace` fails (code !== 0)
- [ ] Error state does NOT render tabs or sub-resource data
- [ ] Back button navigates to `/learning_spaces`
- [ ] Meta displayed as formatted JSON in `<pre>` block when non-null
- [ ] Meta shows "—" when `null` (not the string `"null"` or empty `<pre>` block)
- [ ] Skills/sessions errors handled gracefully (empty arrays shown, no crash)

### Detail Page — Skills Tab (default)
- [ ] Skills tab is the default active tab (`defaultValue="skills"`)
- [ ] Shows skills table with name, description, file count badge
- [ ] Shows `t("noSkills")` when no skills associated
- [ ] "View in Skills" button navigates to `/agent_skills` with `ExternalLink` icon
- [ ] Include skill dialog: submits skill ID, success toast, dialog closes, input clears, skills refresh
- [ ] Include skill dialog: error toast with `res.message` on 404 (skill not found)
- [ ] Include skill dialog: error toast with `res.message` on 409 ("skill already included" or "skill with name already exists")
- [ ] Include skill dialog: if refresh (`listSpaceSkills`) fails after successful include, shows `toast.error(t("fetchError"))`
- [ ] Include skill dialog: submit button is disabled while `isIncluding` is true (prevents double-submit)
- [ ] Exclude skill: `AlertDialog` mentions skill name, success toast, skills refresh
- [ ] Exclude skill: error toast with `res.message` on failure
- [ ] Exclude skill: if refresh (`listSpaceSkills`) fails after successful exclude, shows `toast.error(t("fetchError"))`
- [ ] Skills refresh calls `listSpaceSkills(id)` only (does not re-fetch space header)

### Detail Page — Sessions Tab
- [ ] Shows sessions table with `session_id` (first 8 chars, not junction `id`), created timestamp, actions column
- [ ] Shows `t("noSessions")` when no sessions exist
- [ ] "View Session" button navigates to `/session/[sessionId]/messages` with `ExternalLink` icon
- [ ] Status column is NOT rendered (omitted for now)
- [ ] Learn from session dialog: submits session ID, success toast, dialog closes, input clears, sessions refresh
- [ ] Learn from session dialog: error toast with `res.message` on 404 (session not found)
- [ ] Learn from session dialog: error toast with `res.message` on 409 ("session already learned by another space")
- [ ] Learn from session dialog: if refresh (`listSpaceSessions`) fails after successful learn, shows `toast.error(t("fetchError"))`
- [ ] Learn from session dialog: submit button is disabled while `isLearning` is true (prevents double-submit)
- [ ] Sessions refresh calls `listSpaceSessions(id)` only (does not re-fetch space header)

### Navigation
- [ ] Sidebar shows "Learning Spaces" item with `BookOpen` icon
- [ ] Sidebar highlights when on `/learning_spaces`
- [ ] Sidebar highlights when on `/learning_spaces/[id]` (startsWith match)
- [ ] i18n label matches `sidebar.learningSpaces` key
