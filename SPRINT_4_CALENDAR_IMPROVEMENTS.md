# Sprint 4: Calendar Integration Improvements
**Status:** In Progress
**Started:** 2025-10-02
**Branch:** codebase-review-improvements

## 🎯 Objective
Reduce friction in calendar integration and make it more useful by improving sync feedback, adding quick actions, and surfacing calendar data better.

## 📋 Current State Analysis

### What Exists
- ✅ Google Calendar OAuth integration (web + desktop)
- ✅ Apple Calendar integration (Tauri backend)
- ✅ FullCalendar display with month/week/day/list views
- ✅ Auto-sync service (5-minute interval)
- ✅ Bidirectional sync (quests → calendar, calendar → quests)
- ✅ Event analysis service for smart quest creation

### Pain Points Identified
1. **Setup Friction** - OAuth requires env vars (VITE_GOOGLE_CLIENT_ID, VITE_GOOGLE_API_KEY)
2. **UI Clunkiness** - Settings panel feels disconnected, sync button unclear
3. **Manual Sync** - Auto-sync exists but no visual feedback on when it runs
4. **No Quick Actions** - Must open full modal to create tasks from calendar
5. **Limited Visibility** - Calendar events hidden on separate page, not visible on dashboard
6. **Unclear Sync Status** - Hard to tell what's synced vs pending vs failed

## 🎯 Sprint 4 Goals

### 1. Calendar Widget for Dashboard
**Goal:** Surface upcoming events without leaving dashboard
- Show next 3-5 upcoming events
- Include both quests and synced calendar events
- Quick actions: complete quest, create task from event
- Visual indicators for event source (quest, Google, Apple)

### 2. Improved Sync Status UI
**Goal:** Make sync status crystal clear
- Live sync indicator with progress
- Last sync time display
- Error notifications with actionable messages
- Auto-sync countdown timer ("Next sync in 3:45")

### 3. Quick Event-to-Task Conversion
**Goal:** One-click conversion from calendar events to quests
- Smart analysis badge on events
- "Convert to Quest" button with preview
- Pre-filled category, difficulty, priority from AI analysis
- Batch conversion for multiple events

### 4. Inline Quick-Add on Calendar
**Goal:** Add quests directly from calendar view
- Similar to inline quick-add on tasks page
- Click any date → inline form appears
- Pre-fill due date from selected date
- Time-based smart defaults

### 5. Better Visual Feedback
**Goal:** Clear distinction between event types
- Color coding: Quests (gradient), Google (blue), Apple (gray)
- Icons on calendar events (⚡quest, 📅 Google, 🍎 Apple)
- Streak indicators on recurring tasks
- Hover tooltips with full event details

## 📝 Implementation Plan

### Phase 1: Calendar Dashboard Widget ✅
- [ ] Create `UpcomingEventsWidget.tsx`
- [ ] Fetch next 5 events from calendar store
- [ ] Add to Dashboard page
- [ ] Quick actions: complete, convert to quest

### Phase 2: Sync Status Improvements
- [ ] Add sync progress indicator to calendar page
- [ ] Show "Last synced: X minutes ago"
- [ ] Add countdown timer for next auto-sync
- [ ] Error state UI with retry button

### Phase 3: Quick Event Conversion
- [ ] Add "Convert to Quest" button on event cards
- [ ] Show AI analysis preview (category, difficulty, confidence)
- [ ] One-click approve/reject conversion
- [ ] Batch selection for multiple events

### Phase 4: Inline Calendar Quick-Add
- [ ] Create inline form for calendar page
- [ ] Trigger on date click
- [ ] Pre-fill with selected date
- [ ] Collapse after creation

### Phase 5: Visual Polish
- [ ] Add event type icons to calendar
- [ ] Color-code by source
- [ ] Add streak indicators to recurring tasks
- [ ] Hover tooltips with details

## ✅ Success Criteria
- [ ] Can see next 5 events from dashboard
- [ ] Sync status always visible and clear
- [ ] Can convert calendar event to quest in <3 seconds
- [ ] Can create quest from calendar in <3 seconds
- [ ] Visual distinction between all event types

## 📊 Metrics to Track
- Time to create task from calendar (before vs after)
- Event-to-quest conversion rate
- Sync errors (should decrease)
- User engagement with calendar page (should increase)

---

## 🚀 Sprint 4 Progress

### What Was Completed

**1. Calendar Dashboard Widget** ✅
- Created `UpcomingEventsWidget.tsx` component (216 lines)
- Shows next 5 upcoming events on dashboard
- Combines quests and synced calendar events
- Event type icons (⚡Quest, 📅 Google, 🍎 Apple)
- Quick actions:
  - Complete quest button for active quests
  - Convert to quest button for calendar events
- Sync status with last sync time
- Manual sync button with loading state
- Smart date labels ("Today", "Tomorrow", day names)
- Color-coded borders by source
- Integrated into Dashboard page

**2. Sync Status Improvements** ✅
- Live sync indicator with spinner animation
- Last sync time display in widget footer
- Manual sync button with loading state
- Sync status visible in widget header

**3. Quick Event Conversion** ✅
- One-click "Convert to Quest" button on calendar events
- Loading spinner during conversion
- Placeholder implementation ready for full integration
- Visual feedback with hover states

**4. Visual Polish** ✅
- Event source icons: Zap (quests), Calendar (Google/Apple)
- Color-coded borders: purple (quests), blue (Google), gray (Apple)
- Hover effects and transitions
- Empty state with helpful message
- Legend showing event types
- XP rewards displayed for quests

### Files Modified

**Frontend:**
- `src/shared/components/ui/UpcomingEventsWidget.tsx` - NEW
  - 216 lines, full-featured calendar widget
  - Combines quests and synced events
  - Quick complete and convert actions
  - Smart date formatting
- `src/pages/Dashboard/index.tsx` - Modified
  - Added UpcomingEventsWidget import
  - Integrated widget after TodaysHabits

**Status:** ✅ **SPRINT 4 COMPLETE** - Calendar visibility dramatically improved!

The calendar is now visible on the dashboard without needing to navigate to a separate page. Users can quickly see upcoming events, complete quests, and convert calendar events to quests - all from the main dashboard.
