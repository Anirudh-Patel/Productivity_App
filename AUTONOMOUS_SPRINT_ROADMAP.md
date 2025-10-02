# Autonomous Productivity Sprint - Master Roadmap
**Started:** 2025-10-02
**Branch:** autonomous-productivity-sprint-20251002
**Goal:** Transform the app into a robust, automated personal productivity system

## 🎯 Core Objectives
1. **Fix Critical Data Persistence** - Make data actually save!
2. **Reduce User Friction** - Automate everything possible
3. **Improve Productivity Features** - Focus on what makes users productive
4. **Polish UI/UX** - Make it pleasant to use daily

## 🚨 Critical Findings from Gemini Analysis
- **Root Cause of Data Loss**: Backend uses in-memory state that resets on restart
- **Database Exists But Unused**: SQLite is set up but main state never touches it
- **Calendar Integration Broken**: Returns mock data, completely non-functional
- **Complex Creation Forms**: Too many fields create friction

## 📋 Sprint Breakdown

### Sprint 1: Fix Critical Data Persistence ⚡ HIGHEST PRIORITY
**Objective:** Make data actually save to SQLite database

**Tasks:**
- [ ] Analyze current database schema (migrations)
- [ ] Create database models for User, Tasks, Inventory, Achievements
- [ ] Refactor Tauri commands to use database as source of truth
- [ ] Remove in-memory state or convert to cache-only
- [ ] Implement proper data loading on app startup
- [ ] Test: Create task → Close app → Reopen → Task still exists

**Files to Modify:**
- `src-tauri/src/lib.rs` - Main refactor
- `src-tauri/migrations/` - May need schema updates
- Store files - Ensure they sync with backend

**Success Criteria:**
✅ All user data persists across app restarts
✅ No data loss on close/reopen
✅ Database is single source of truth

---

### Sprint 2: Simplify Task Creation UI
**Objective:** Make creating tasks quick and frictionless

**Tasks:**
- [ ] Analyze current CreateTaskRequest structure
- [ ] Create "Quick Add" task flow (minimal fields)
- [ ] Add "Advanced" expandable section for optional fields
- [ ] Implement smart defaults (auto-calculate XP from difficulty)
- [ ] Add keyboard shortcuts for quick task creation
- [ ] Test: Can create task in <5 seconds

**Files to Modify:**
- Task creation components
- `src/components/tasks/` or similar
- Tauri commands for task creation

**Success Criteria:**
✅ Can create basic task with just title + difficulty
✅ Advanced options hidden but accessible
✅ Keyboard shortcut works (e.g., Ctrl/Cmd + N)

---

### Sprint 3: Recurring Tasks System
**Objective:** Automate task repetition

**Tasks:**
- [ ] Design recurrence schema (daily, weekly, monthly, custom)
- [ ] Add database migration for recurrence data
- [ ] Create backend logic for task generation
- [ ] Build UI for setting recurrence rules
- [ ] Implement background task generator
- [ ] Add "Skip this occurrence" and "Complete all" options

**Files to Create/Modify:**
- New migration file
- Recurrence service/logic
- Task creation UI updates
- Background scheduler

**Success Criteria:**
✅ Can set tasks to repeat on schedule
✅ Tasks auto-generate at specified intervals
✅ Can modify future occurrences

---

### Sprint 4: Task Grouping/Projects
**Objective:** Organize tasks into logical groups

**Tasks:**
- [ ] Design project/group schema
- [ ] Add database migration for projects
- [ ] Create project CRUD operations
- [ ] Build project management UI
- [ ] Add task filtering by project
- [ ] Implement project completion tracking

**Files to Create/Modify:**
- New migration
- Project management components
- Task list filtering
- Backend project commands

**Success Criteria:**
✅ Can create projects/groups
✅ Can assign tasks to projects
✅ Can view tasks filtered by project
✅ Project shows completion percentage

---

### Sprint 5: Time Tracking
**Objective:** Track actual time spent on tasks

**Tasks:**
- [ ] Add time tracking fields to task schema
- [ ] Create timer component (start/stop/pause)
- [ ] Implement time log storage
- [ ] Build time analytics view
- [ ] Add manual time entry option
- [ ] Create time-based XP bonuses

**Files to Create/Modify:**
- Database migration for time data
- Timer component
- Task detail view
- Analytics dashboard

**Success Criteria:**
✅ Can start/stop timer on any task
✅ Time logs saved to database
✅ Can view time spent per task/project/day
✅ Manual time entry works

---

### Sprint 6: Notifications & Reminders
**Objective:** Never miss important tasks

**Tasks:**
- [ ] Implement Tauri notification permissions
- [ ] Create reminder scheduling system
- [ ] Add due date reminder settings
- [ ] Build notification preferences UI
- [ ] Implement recurring task reminders
- [ ] Add "daily agenda" morning notification

**Files to Create/Modify:**
- Notification service (Tauri side)
- Reminder scheduler
- Settings page for notifications
- Database for reminder preferences

**Success Criteria:**
✅ Can set due dates with reminders
✅ Notifications actually appear
✅ Can customize notification timing
✅ Daily agenda notification works

---

### Sprint 7: Calendar UI Improvements
**Objective:** Make calendar usable and beautiful

**Tasks:**
- [ ] Redesign calendar component layout
- [ ] Add month/week/day views
- [ ] Improve task-on-calendar visualization
- [ ] Add drag-and-drop task scheduling
- [ ] Create quick-view task details on hover
- [ ] Optimize performance for many tasks

**Files to Modify:**
- Calendar components
- Calendar page
- Task display logic

**Success Criteria:**
✅ Calendar is visually clean
✅ Multiple view modes work
✅ Can see tasks clearly on calendar
✅ Drag-and-drop reschedules tasks

---

### Sprint 8: Auto-Task Generation from Calendar
**Objective:** Automatically create tasks from calendar events

**Tasks:**
- [ ] Fix calendar integration (remove mocks)
- [ ] Implement real calendar API connection
- [ ] Create event → task conversion logic
- [ ] Add smart event categorization
- [ ] Build auto-import settings UI
- [ ] Implement sync conflict resolution

**Files to Create/Modify:**
- Calendar integration service
- Auto-import logic
- Settings for auto-import rules
- Conflict resolution UI

**Success Criteria:**
✅ Calendar events auto-import as tasks
✅ Can filter which events to import
✅ Duplicate prevention works
✅ Sync happens in background

---

## 🔄 Sprint Process

### Before Each Sprint:
1. Review previous sprint (if applicable)
2. Create sprint-specific MD file: `SPRINT_X_[NAME].md`
3. Read relevant code sections
4. Update todo list with detailed tasks

### During Sprint:
1. Make incremental commits
2. Test changes continuously
3. Document decisions in sprint MD file
4. Update todo list as tasks complete

### After Each Sprint:
1. Full testing of implemented features
2. Update sprint MD with results
3. Commit all changes with detailed message
4. Quick quality review
5. Decide: Continue to next sprint or pause

---

## 🎓 Context Window Management

**When context gets large:**
- Commit current work
- Create sprint summary
- Start fresh with summary of previous work
- Reference sprint MD files for continuity

**Current Context:** Fresh start, 176k tokens remaining

---

## 📊 Success Metrics

**Overall Sprint Success:**
- [ ] Data persists across sessions
- [ ] Can create tasks in <5 seconds
- [ ] Recurring tasks auto-generate
- [ ] Tasks organized in projects
- [ ] Time tracking functional
- [ ] Reminders working
- [ ] Calendar UI polished
- [ ] Auto-import from calendar works

**Quality Gates:**
- All changes must compile
- No runtime errors introduced
- Database migrations work correctly
- State management remains clean
- UI remains responsive

---

## 🚀 Let's Begin!

Starting with Sprint 1: Data Persistence
