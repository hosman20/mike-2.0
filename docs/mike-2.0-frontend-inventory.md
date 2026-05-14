# mike-2.0 Frontend Inventory

Read-only audit of `frontend/src/` to guide a redesign agent. All paths are absolute.

Frontend root: `/Users/z/mike-2.0/.claude/worktrees/focused-moore-5961be/frontend/`
- Next.js 16.0.3, React 19.2, App Router, Cloudflare via `@opennextjs/cloudflare`
- Tailwind v4 (`@tailwindcss/postcss`), shadcn/ui style = "new-york", baseColor = "neutral", CSS variables
- No `tailwind.config.*` file — config lives entirely in `src/app/globals.css` via `@theme inline`

Note: there are two parallel component trees:
- `src/components/` — shadcn/ui primitives + branding + providers (the "design system" tree)
- `src/app/components/` — feature/page components (assistant, projects, tabular, workflows, shared chrome)

---

## Pages (file path → current purpose → user-flow role)

### App-Router root level (`frontend/src/app/`)
- `/Users/z/mike-2.0/.claude/worktrees/focused-moore-5961be/frontend/src/app/layout.tsx` → root HTML layout, loads Inter + EB Garamond fonts, sets `<Providers>` (Auth + UserProfile), defines metadata (`title: "Mike - AI Legal Platform"`, `siteName: "Mike"`, OG image `/link-image.jpg`) → root chrome for every route.
- `/Users/z/mike-2.0/.claude/worktrees/focused-moore-5961be/frontend/src/app/page.tsx` → server component, `redirect("/assistant")` → root entry; sends authenticated users into the app.
- `/Users/z/mike-2.0/.claude/worktrees/focused-moore-5961be/frontend/src/app/error.tsx` → client error boundary with link back home → app-wide error fallback.
- `/Users/z/mike-2.0/.claude/worktrees/focused-moore-5961be/frontend/src/app/not-found.tsx` → 404 page, EB Garamond heading + neutral copy → 404 fallback.
- `/Users/z/mike-2.0/.claude/worktrees/focused-moore-5961be/frontend/src/app/global-error.tsx` → global error boundary outside (pages) tree.
- `/Users/z/mike-2.0/.claude/worktrees/focused-moore-5961be/frontend/src/app/login/page.tsx` → email/password login form via Supabase, redirects to `/assistant` on success → unauthenticated entry.
- `/Users/z/mike-2.0/.claude/worktrees/focused-moore-5961be/frontend/src/app/signup/page.tsx` → signup form (name, organisation, email, password, confirm), creates Supabase user + posts profile via `updateUserProfile()` → unauthenticated entry.
- `/Users/z/mike-2.0/.claude/worktrees/focused-moore-5961be/frontend/src/app/support/page.tsx` → feedback/support form (bug/feature/question/other) sent via Resend → in-app support.

### `(pages)` route group — authenticated app shell (`frontend/src/app/(pages)/`)
The `(pages)` group is wrapped by `(pages)/layout.tsx` which: gates on `useAuth`, renders the persistent `<AppSidebar>`, mobile menu header, and a `<main>` content slot. All routes below live inside this shell.

- `/Users/z/mike-2.0/.claude/worktrees/focused-moore-5961be/frontend/src/app/(pages)/layout.tsx` → auth gate + sidebar layout + `ChatHistoryProvider` + `SidebarContext` → app chrome for every authenticated page.
- `/Users/z/mike-2.0/.claude/worktrees/focused-moore-5961be/frontend/src/app/(pages)/assistant/page.tsx` → primary chat surface: switches between `<InitialView>` (empty state) and `<ChatView>` (active conversation), delegates to `useAssistantChat()` → main dashboard / chat entry.
- `/Users/z/mike-2.0/.claude/worktrees/focused-moore-5961be/frontend/src/app/(pages)/assistant/chat/[id]/page.tsx` → resumed chat by id, fetches via `getChat()`, mounts `<ChatView>` → persistent chat detail.
- `/Users/z/mike-2.0/.claude/worktrees/focused-moore-5961be/frontend/src/app/(pages)/projects/page.tsx` → thin wrapper around `<ProjectsOverview>` → projects index.
- `/Users/z/mike-2.0/.claude/worktrees/focused-moore-5961be/frontend/src/app/(pages)/projects/[id]/page.tsx` → wrapper around `<ProjectPage>` with `use(params)` → project detail.
- `/Users/z/mike-2.0/.claude/worktrees/focused-moore-5961be/frontend/src/app/(pages)/projects/[id]/assistant/page.tsx` → project-scoped chat (initial view).
- `/Users/z/mike-2.0/.claude/worktrees/focused-moore-5961be/frontend/src/app/(pages)/projects/[id]/assistant/chat/[chatId]/page.tsx` → project-scoped chat detail.
- `/Users/z/mike-2.0/.claude/worktrees/focused-moore-5961be/frontend/src/app/(pages)/projects/[id]/tabular-reviews/page.tsx` → tabular-review index scoped to a project.
- `/Users/z/mike-2.0/.claude/worktrees/focused-moore-5961be/frontend/src/app/(pages)/projects/[id]/tabular-reviews/[reviewId]/page.tsx` → tabular review detail inside a project.
- `/Users/z/mike-2.0/.claude/worktrees/focused-moore-5961be/frontend/src/app/(pages)/tabular-reviews/page.tsx` → global tabular review index with create/delete/list, search via `HeaderSearchBtn`, project filtering.
- `/Users/z/mike-2.0/.claude/worktrees/focused-moore-5961be/frontend/src/app/(pages)/tabular-reviews/[id]/page.tsx` → global tabular review detail.
- `/Users/z/mike-2.0/.claude/worktrees/focused-moore-5961be/frontend/src/app/(pages)/workflows/page.tsx` → wrapper around `<WorkflowList>` → workflows index.
- `/Users/z/mike-2.0/.claude/worktrees/focused-moore-5961be/frontend/src/app/(pages)/workflows/[id]/page.tsx` → workflow detail/editor.
- `/Users/z/mike-2.0/.claude/worktrees/focused-moore-5961be/frontend/src/app/(pages)/account/layout.tsx` → sub-layout with TABS array `[{id: "general", href: "/account"}, ...]` → settings nav chrome.
- `/Users/z/mike-2.0/.claude/worktrees/focused-moore-5961be/frontend/src/app/(pages)/account/page.tsx` → general account settings (display name, organisation, sign out, delete account).
- `/Users/z/mike-2.0/.claude/worktrees/focused-moore-5961be/frontend/src/app/(pages)/account/models/page.tsx` → model selection / API key settings.

User flow: unauthenticated → `/login` or `/signup` → on success → `/assistant` (initial view) → submit → push to `/assistant/chat/[id]`. Sidebar (`AppSidebar`) navigates between Assistant / Projects / Tabular Review / Workflows. Account/Support accessed via sidebar user dropdown.

---

## Component files (file path → one-line purpose)

### `src/components/` (design-system tree)
- `/Users/z/mike-2.0/.claude/worktrees/focused-moore-5961be/frontend/src/components/providers.tsx` → wraps `<AuthProvider>` and `<UserProfileProvider>` for the app root.
- `/Users/z/mike-2.0/.claude/worktrees/focused-moore-5961be/frontend/src/components/site-logo.tsx` → branded logo: `<MikeIcon>` + literal `<span>Mike</span>` in EB Garamond; sizes sm/md/lg/xl; optional link to `mikeoss.com`.
- `/Users/z/mike-2.0/.claude/worktrees/focused-moore-5961be/frontend/src/components/chat/mike-icon.tsx` → animated 12-blade fan/turbine SVG icon used as the brand mark (palettes: default/done/error).
- `/Users/z/mike-2.0/.claude/worktrees/focused-moore-5961be/frontend/src/components/ui/button.tsx` → shadcn Button with cva variants (default, destructive, outline, secondary, ghost, link; sizes default/sm/lg/icon/icon-sm/icon-lg).
- `/Users/z/mike-2.0/.claude/worktrees/focused-moore-5961be/frontend/src/components/ui/input.tsx` → shadcn Input (h-9, rounded-md, border-input, focus ring tokens).
- `/Users/z/mike-2.0/.claude/worktrees/focused-moore-5961be/frontend/src/components/ui/badge.tsx` → shadcn Badge (default/secondary/destructive/outline).
- `/Users/z/mike-2.0/.claude/worktrees/focused-moore-5961be/frontend/src/components/ui/dropdown-menu.tsx` → shadcn DropdownMenu over `@radix-ui/react-dropdown-menu`.
- `/Users/z/mike-2.0/.claude/worktrees/focused-moore-5961be/frontend/src/components/ui/cite-button.tsx` → custom (non-shadcn) citation copy button with QuoteIcon + Check feedback.
- `/Users/z/mike-2.0/.claude/worktrees/focused-moore-5961be/frontend/src/components/ui/text-search-widget.tsx` → custom Find-in-page widget (input + ArrowUp/ArrowDown/X) used over docx/pdf viewers.

### `src/app/components/assistant/` (chat surface)
- `AddDocButton.tsx` → button to attach documents to a message.
- `AssistantMessage.tsx` → renders assistant turn (markdown + citations + edits + tool calls).
- `AssistantSidePanel.tsx` → tabbed right-side panel showing documents/citations during a chat.
- `AssistantWorkflowModal.tsx` → modal for selecting/running a workflow inside the assistant.
- `ChatInput.tsx` → message composer (textarea, attach, send, model toggle).
- `ChatView.tsx` → full chat thread layout with side panel, scroll-to-bottom, modals.
- `EditCard.tsx` → inline Accept/Reject card for AI document edits.
- `InitialView.tsx` → empty chat: animated `MikeIcon` flying in next to "Hi, {name}" greeting + ChatInput.
- `ModelToggle.tsx` → switch between configured Mike models.
- `SelectAssistantProjectModal.tsx` → choose a project to scope the chat into.
- `UserMessage.tsx` → renders user turn with attachments.

### `src/app/components/projects/`
- `NewProjectModal.tsx` → create-project dialog.
- `ProjectExplorer.tsx` → file/folder tree inside a project.
- `ProjectPage.tsx` → project detail layout (header, explorer, tabs).
- `ProjectsOverview.tsx` → grid/list of all projects with create CTA.

### `src/app/components/tabular/` (spreadsheet-style review)
- `AddColumnModal.tsx` → add/edit a column with prompt + format.
- `AddNewTRModal.tsx` → create a new tabular review.
- `TRChatPanel.tsx` → chat sidebar within a tabular review.
- `TREditColumnMenu.tsx` → per-column action menu.
- `TRSidePanel.tsx` → side panel for tabular review (docs, cell detail).
- `TRTable.tsx` → main data grid.
- `TabularCell.tsx` → individual cell renderer (with citations/pills).
- `TabularReviewView.tsx` → top-level tabular review screen.
- `citation-utils.ts`, `columnFormat.ts`, `columnPresets.ts`, `exportToExcel.ts`, `pillUtils.ts`, `prompt-generator.ts` → pure helpers.

### `src/app/components/workflows/`
- `DisplayWorkflowModal.tsx` → view a saved workflow.
- `NewWorkflowModal.tsx` → create workflow dialog.
- `ShareWorkflowModal.tsx` → share/permissions dialog.
- `WFColumnViewModal.tsx`, `WFEditColumnModal.tsx` → workflow column inspect/edit.
- `WorkflowList.tsx` → list of user + built-in workflows.
- `WorkflowPromptEditor.tsx` → Tiptap-based prompt editor for a workflow step.
- `builtinWorkflows.ts`, `practices.ts` → seed data / domain helpers.

### `src/app/components/modals/`
- `credits-exhausted-modal.tsx` → "out of credits" upsell modal.
- `delete-chats-modal.tsx` → bulk-delete confirmation.
- `simple-link-dialog.tsx` → minimal copy-link dialog.

### `src/app/components/shared/` (cross-feature chrome and utilities)
- `AppSidebar.tsx` → left nav: brand row, NAV_ITEMS (Assistant/Projects/Tabular Review/Workflows), chat history, user dropdown. **Primary layout chrome.**
- `AddDocumentsModal.tsx` → general document upload modal.
- `AddProjectDocsModal.tsx` → add docs into a specific project.
- `ApiKeyMissingModal.tsx` → prompt to add an API key.
- `DocPanel.tsx`, `DocView.tsx`, `DocViewModal.tsx`, `DocxView.tsx` → document viewers (PDF/DOCX with highlights).
- `DocumentCard.tsx` → file card with metadata.
- `EmailPillInput.tsx` → multi-email input with pill chips.
- `FileDirectory.tsx` → directory listing widget.
- `HeaderSearchBtn.tsx` → page-header search trigger.
- `OwnerOnlyModal.tsx` → permission gate dialog.
- `PeopleModal.tsx` → invite/share users dialog.
- `PreResponseWrapper.tsx` → wrapper that streams "thinking…" before assistant content.
- `ProjectPicker.tsx` → dropdown to choose a project.
- `RenameableTitle.tsx` → inline-editable title.
- `RowActions.tsx` → kebab menu for list rows.
- `SidebarChatItem.tsx` → chat history row in `AppSidebar`.
- `ToolbarTabs.tsx` → tabbed toolbar primitive used in side panels.
- `UploadNewVersionModal.tsx` → upload a new version of a document.
- `VersionChip.tsx` → small "v3" pill.
- `highlightDocxQuote.ts`, `highlightQuote.ts`, `types.ts`, `useDirectoryData.ts` → helpers, shared types (`MikeMessage`, `MikeProject`, `MikeCitationAnnotation`, `MikeEditAnnotation`, `TabularReview`, …), hook.

### Contexts and lib
- `/Users/z/mike-2.0/.claude/worktrees/focused-moore-5961be/frontend/src/contexts/AuthContext.tsx` → Supabase auth state (`user`, `isAuthenticated`, `authLoading`, `signOut`).
- `/Users/z/mike-2.0/.claude/worktrees/focused-moore-5961be/frontend/src/contexts/UserProfileContext.tsx` → display name + organisation profile state.
- `/Users/z/mike-2.0/.claude/worktrees/focused-moore-5961be/frontend/src/app/contexts/ChatHistoryContext.tsx` → chat list / currentChatId / new-chat staging.
- `/Users/z/mike-2.0/.claude/worktrees/focused-moore-5961be/frontend/src/app/contexts/SidebarContext.tsx` → exposes `setSidebarOpen` to nested views (e.g. side panel auto-collapses sidebar).
- `/Users/z/mike-2.0/.claude/worktrees/focused-moore-5961be/frontend/src/lib/{auth,fileConverter,label,slug,storage,supabase,supabase-server,types,utils}.ts` → cross-cutting helpers; `utils.ts` exports `cn()` (clsx + tailwind-merge).
- `/Users/z/mike-2.0/.claude/worktrees/focused-moore-5961be/frontend/src/app/lib/mikeApi.ts`, `modelAvailability.ts` → API client and model registry.
- `/Users/z/mike-2.0/.claude/worktrees/focused-moore-5961be/frontend/src/app/hooks/*.ts` → `useAssistantChat`, `useDocumentVersions`, `useFetchDocxBytes`, `useFetchSingleDoc`, `useGenerateChatTitle`, `useSelectedModel`.

---

## Global styles & Tailwind config (current state)

File: `/Users/z/mike-2.0/.claude/worktrees/focused-moore-5961be/frontend/src/app/globals.css` (no separate `tailwind.config`).

Imports: `tailwindcss`, `tw-animate-css`. Defines `@custom-variant dark`.

`@theme inline` exposes the standard shadcn token surface (background, foreground, card, popover, primary, secondary, muted, accent, destructive, border, input, ring, chart-1..5, sidebar + sidebar-foreground/primary/accent/border/ring) plus:
- `--color-blue` / `-50` / `-100` / `-200` / `-600` / `-700` = `rgb(0, 136, 255)` ("azure") family — this is the only accent color
- `--font-sans: var(--font-inter)`, `--font-serif: var(--font-eb-garamond)` (loaded via `next/font/google` in root layout)
- `--radius` = `0.625rem` (base), with `radius-sm/md/lg/xl` derived

`:root` tokens are neutral oklch grayscale (background `oklch(1 0 0)`, primary `oklch(0.205 0 0)`, etc.); `.dark` overrides are present but dark mode is **not visibly toggled anywhere in app code** (no theme switcher found). `--color-azure: 0, 136, 255` is the only non-neutral brand color.

Base layer: `* { @apply border-border outline-ring/50 }`, `body { @apply bg-background text-foreground }`, `button { cursor: pointer }`.

Custom utility classes / scoped rules in the same file:
- `.usc-section`, `.cfr-section` → legal-document typography in EB Garamond (used by the doc viewers).
- `.workflow-editor-content` → Tiptap workflow editor styles.
- `.pdf-text-layer`, `.docx-view-container ins/del/.docx-edit-flash/.docx-edit-hidden/.docx-edit-kept` → PDF/DOCX viewer + tracked-change styling.
- `.font-eb-garamond` utility, `sidebar-fade-in`/`-2`/`-3` keyframe utilities, `scroll-left`, `shimmer` + `animate-shimmer`, `docxEditFlash`.

PostCSS config: `/Users/z/mike-2.0/.claude/worktrees/focused-moore-5961be/frontend/postcss.config.mjs` (Tailwind v4 plugin).
shadcn config: `/Users/z/mike-2.0/.claude/worktrees/focused-moore-5961be/frontend/components.json` (style "new-york", baseColor "neutral", icons "lucide", components alias `@/components`).

Net design language today: black-on-white, neutral grays, single azure accent, EB Garamond for headings/legal copy, Inter for UI. No dedicated brand color tokens beyond azure.

---

## Installed UI dep summary

From `/Users/z/mike-2.0/.claude/worktrees/focused-moore-5961be/frontend/package.json`:

| Dep | Installed | Version |
|---|---|---|
| shadcn/ui (config + 5 generated primitives) | YES (manual install — `components.json` present, `style: new-york`) | — |
| `@radix-ui/react-dropdown-menu` | YES | ^2.1.16 |
| `@radix-ui/react-slot` | YES | ^1.2.4 |
| `@radix-ui/react-icons` | YES | ^1.3.2 |
| `lucide-react` | YES | ^0.553.0 |
| `class-variance-authority` | YES | ^0.7.1 |
| `tailwind-merge` | YES | ^3.4.0 |
| `clsx` | YES | ^2.1.1 |
| `tailwindcss` | YES (v4) | ^4 |
| `tw-animate-css` | YES | ^1.4.0 |

Other notable UI deps: `@tiptap/*` (rich-text), `@uiw/react-md-editor`, `react-markdown` + `remark-gfm` + `remark-math` + `rehype-katex` + `rehype-raw`, `pdfjs-dist`, `docx-preview`, `mammoth`, `recharts`, `nextjs-toploader`, `katex`, `marked`, `exceljs`, `docx`.

Missing Radix primitives that a redesign will likely need to add via `npx shadcn add`: dialog, sheet, tabs, tooltip, popover, separator, scroll-area, label, select, switch, toast/sonner, command, avatar, card. Today only Button / Input / Badge / Dropdown / 2 custom primitives exist.

---

## Branding touchpoints (every file containing the app name)

Hard-coded "Mike" (the literal brand string, excluding domain identifier types like `MikeMessage`, `MikeIcon`, `MikeProject`):

- `/Users/z/mike-2.0/.claude/worktrees/focused-moore-5961be/frontend/src/app/layout.tsx`
  - L17 `metadataBase: new URL("https://app.mikeoss.com")`
  - L18 `title: "Mike - AI Legal Platform"`
  - L20 `description: "AI-powered legal document analysis and contract review platform."`
  - L31 `url: "https://app.mikeoss.com"`
  - L32 `siteName: "Mike"`
  - L33 `title: "Mike - AI Legal Platform"` (openGraph)
  - L41 `alt: "Mike"`
  - L47 `title: "Mike - AI Legal Platform"` (twitter)
- `/Users/z/mike-2.0/.claude/worktrees/focused-moore-5961be/frontend/src/components/site-logo.tsx`
  - L19 `https://mikeoss.com` (production landing href)
  - L42 `<span>Mike</span>` (the wordmark)
- `/Users/z/mike-2.0/.claude/worktrees/focused-moore-5961be/frontend/src/components/chat/mike-icon.tsx` → file name + `MikeIcon` component name; the SVG itself is brand-agnostic (12-blade fan/turbine) but is treated as the logo mark by `SiteLogo`.
- `/Users/z/mike-2.0/.claude/worktrees/focused-moore-5961be/frontend/src/app/login/page.tsx` L123–127 → demo disclaimer: "Mike hosted on MikeOSS.com is currently a demo service…"
- `/Users/z/mike-2.0/.claude/worktrees/focused-moore-5961be/frontend/src/app/signup/page.tsx` L258 `https://mikeoss.com/terms`, L267 `https://mikeoss.com/privacy`, L277–281 same demo disclaimer.
- `/Users/z/mike-2.0/.claude/worktrees/focused-moore-5961be/frontend/src/app/support/page.tsx` → "Mike" likely in copy (form for product feedback).

Brand-name infrastructure (file/identifier names that *will* be renamed in a larger rebrand but are not user-visible strings):
- API helper: `/Users/z/mike-2.0/.claude/worktrees/focused-moore-5961be/frontend/src/app/lib/mikeApi.ts`
- Type prefix `Mike*` throughout `frontend/src/app/components/shared/types.ts` and downstream (`MikeMessage`, `MikeCitationAnnotation`, `MikeEditAnnotation`, `MikeProject`, `MikeFile`, `MikeAttachment`, …).
- Layout component identifier `MikeLayout` in `(pages)/layout.tsx`.

Public assets that may carry brand (`/Users/z/mike-2.0/.claude/worktrees/focused-moore-5961be/frontend/public/`): `link-image.jpg` (OG image), plus Next.js stock svgs (`file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`). Favicon `/icon.svg` and `/favicon.ico` and `/apple-touch-icon.png` are referenced by `layout.tsx` metadata but not in the listing — verify on disk before redesign.

---

## Recommended migration order

Lowest blast radius first; each step is consumed by the next.

1. **Shared primitives (`src/components/ui/`)** — touch `button.tsx`, `input.tsx`, `badge.tsx`, `dropdown-menu.tsx` plus add the missing shadcn primitives the redesign needs (dialog, sheet, tabs, tooltip, label, select, card, separator, scroll-area, avatar). Refresh tokens in `src/app/globals.css` (new brand colors, replace the single `--color-blue/azure` family, possibly retune radius/typography). These primitives back literally every page — get them right once.
2. **Brand mark + design tokens** — `src/components/chat/mike-icon.tsx` (new logo SVG), `src/components/site-logo.tsx` (wordmark, sizes, link target), `src/app/layout.tsx` metadata (title/description/OG/siteName), root font choices if changing. Replace `public/link-image.jpg`, `public/icon.svg`, favicon, apple-touch-icon. Update the demo-disclaimer copy in `login/page.tsx` + `signup/page.tsx`.
3. **Layout chrome (sidebar + auth shell)** — `src/app/components/shared/AppSidebar.tsx` (NAV_ITEMS, brand row, user dropdown, chat history), `src/app/(pages)/layout.tsx` (mobile header, main wrapper, sidebar context). These define every authenticated page's frame. After primitives + brand land, this consumes both.
4. **Auth pages** — `src/app/login/page.tsx`, `src/app/signup/page.tsx`, plus `src/app/not-found.tsx` and `src/app/error.tsx`. These are isolated, share no state with the authenticated app, and are the lowest-risk place to validate the new visual language end-to-end.
5. **Dashboard / assistant surface** — `src/app/(pages)/assistant/page.tsx`, `src/app/(pages)/assistant/chat/[id]/page.tsx`, then the assistant components in order of visibility: `InitialView.tsx`, `ChatInput.tsx`, `ChatView.tsx`, `UserMessage.tsx`, `AssistantMessage.tsx`, `EditCard.tsx`, `AssistantSidePanel.tsx`, `ModelToggle.tsx`, `AddDocButton.tsx`, then the modals (`SelectAssistantProjectModal.tsx`, `AssistantWorkflowModal.tsx`).
6. **Feature surfaces** — Projects (`ProjectsOverview.tsx`, `ProjectPage.tsx`, `ProjectExplorer.tsx`, `NewProjectModal.tsx`), Tabular Reviews (`TabularReviewView.tsx`, `TRTable.tsx`, `TabularCell.tsx`, `TRChatPanel.tsx`, `TRSidePanel.tsx`, `AddColumnModal.tsx`, `AddNewTRModal.tsx`, `TREditColumnMenu.tsx`), Workflows (`WorkflowList.tsx`, `WorkflowPromptEditor.tsx`, `NewWorkflowModal.tsx`, `DisplayWorkflowModal.tsx`, `ShareWorkflowModal.tsx`, `WFColumnViewModal.tsx`, `WFEditColumnModal.tsx`). Touch document viewers (`DocPanel.tsx`, `DocView.tsx`, `DocViewModal.tsx`, `DocxView.tsx`, `DocumentCard.tsx`, `FileDirectory.tsx`, `VersionChip.tsx`) and shared modals (`AddDocumentsModal.tsx`, `AddProjectDocsModal.tsx`, `UploadNewVersionModal.tsx`, `PeopleModal.tsx`, `OwnerOnlyModal.tsx`, `ApiKeyMissingModal.tsx`, modals in `components/modals/`).
7. **Settings + support** — `src/app/(pages)/account/layout.tsx`, `src/app/(pages)/account/page.tsx`, `src/app/(pages)/account/models/page.tsx`, `src/app/support/page.tsx`. Smallest user surface, depends on primitives + chrome; safe to land last.

Out-of-scope-for-visual-redesign but worth flagging: the legal-document scoped CSS (`.usc-section`, `.cfr-section`, `.workflow-editor-content`, `.docx-view-container *`, `.pdf-text-layer`) in `globals.css` is content styling, not UI chrome — leave alone unless the typography system itself is changing.
