# Plan: Projects UI (Sprint 6 completion)

**Date:** 2026-07-10 · **Status:** Approved (interview answered with recommended options) · **Executor:** Claude subagent

## Problem

Sprint 6 delivered the full backend (migration 006, 5 Rust commands, gameStore actions `fetchProjects/createProject/updateProject/deleteProject/assignTaskToProject`, `Project` types) but zero UI. Projects are invisible to the user.

## Interview

**Q1: Dedicated Projects page or section within Tasks?**
- (a) **[RECOMMENDED]** Section within Tasks page: collapsible project filter bar/sidebar with project chips + a "Manage projects" modal. Personal app — tasks are the center of gravity; a separate page adds navigation for little gain.
- (b) New route + sidebar entry.
- **Chosen: (a)** — keeps everything one screen; matches Sprint 6 doc ("project filtering on tasks").

**Q2: How to assign a task to a project?**
- (a) **[RECOMMENDED]** Both: project dropdown in CreateTaskModal advanced section AND a small project selector in the task card action menu.
- (b) Only at creation time.
- **Chosen: (a)** — tasks predate projects; must be able to assign existing ones.

**Q3: Progress display?**
- (a) **[RECOMMENDED]** Project chip shows `completed/total` and a thin progress bar, using the trigger-maintained stats columns from migration 006.
- (b) Compute client-side from tasks.
- **Chosen: (a)** — DB triggers already maintain the stats; trust them.

**Q4: Visual identity?**
- (a) **[RECOMMENDED]** Use the color + icon fields already in the schema; render color dot + emoji/lucide icon in chips and task cards (small colored tag on tasks belonging to a project).
- **Chosen: (a)**.

## Implementation

1. `ProjectChipBar` component on Tasks page: "All" + one chip per active project (color dot, name, n/total, progress bar), click = filter tasks by `project_id`, plus "+ New project" chip.
2. `ProjectModal` (create/edit): name, description, color picker (preset palette), icon picker (small lucide/emoji set), delete with confirm.
3. CreateTaskModal: project `<select>` in the advanced/expanded section (options from store; value → `project_id` on CreateTaskRequest if backend supports; otherwise call `assignTaskToProject` after create).
4. Task card: show project tag (color+name); action menu item "Move to project…" → small popover listing projects + "None".
5. `fetchProjects()` on Tasks page mount.
6. Match existing styling (dark gamified theme, Tailwind, framer-motion consistent with surrounding components — read `App-style-guide.md`).

## Out of scope

Project-level XP display, archived-project views, drag-and-drop between projects.

## Verification

- `npm run build` passes; no new tsc errors in changed files.
- Create project → chip appears; assign task → tag shows; complete task → project counts update (trigger); filter works.
