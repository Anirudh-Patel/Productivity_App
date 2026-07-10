-- Migration 008: Notifications & Reminders System
-- Adds comprehensive notification and reminder functionality

-- Create notification_preferences table for user notification settings
CREATE TABLE IF NOT EXISTS notification_preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL DEFAULT 1 REFERENCES users(id) ON DELETE CASCADE,

    -- Notification type settings
    due_reminders_enabled BOOLEAN DEFAULT 1,
    reminder_minutes_before INTEGER DEFAULT 15, -- Default reminder time before due date
    overdue_alerts_enabled BOOLEAN DEFAULT 1,
    recurring_reminders_enabled BOOLEAN DEFAULT 1,

    -- Daily notifications
    daily_agenda_enabled BOOLEAN DEFAULT 1,
    daily_agenda_time TEXT DEFAULT '08:00', -- HH:MM format
    weekly_planning_enabled BOOLEAN DEFAULT 0,
    weekly_planning_time TEXT DEFAULT '18:00', -- Sunday evening

    -- Achievement & streak notifications
    achievement_notifications_enabled BOOLEAN DEFAULT 1,
    streak_notifications_enabled BOOLEAN DEFAULT 1,
    timer_notifications_enabled BOOLEAN DEFAULT 1,
    timer_reminder_minutes INTEGER DEFAULT 120, -- Remind if timer running >2 hours

    -- Quiet hours
    quiet_hours_enabled BOOLEAN DEFAULT 0,
    quiet_hours_start TEXT, -- HH:MM format
    quiet_hours_end TEXT, -- HH:MM format

    -- Notification style
    sound_enabled BOOLEAN DEFAULT 1,
    priority_filter TEXT DEFAULT 'all' CHECK (priority_filter IN ('all', 'high', 'medium_high')),

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user_id)
);

-- Create scheduled_notifications table for pending notifications
CREATE TABLE IF NOT EXISTS scheduled_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL DEFAULT 1 REFERENCES users(id) ON DELETE CASCADE,
    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,

    -- Notification details
    notification_type TEXT NOT NULL CHECK (notification_type IN (
        'due_soon', 'due_tomorrow', 'overdue', 'recurring_created',
        'task_starting', 'daily_agenda', 'weekly_planning',
        'achievement', 'streak_risk', 'timer_reminder'
    )),
    title TEXT NOT NULL,
    message TEXT NOT NULL,

    -- Scheduling
    scheduled_for DATETIME NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'cancelled', 'snoozed')),

    -- Snooze tracking
    snoozed_until DATETIME,
    snooze_count INTEGER DEFAULT 0,

    -- Metadata
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    action_url TEXT, -- Deep link to task/page

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    sent_at DATETIME,

    -- Index for efficient querying
    CHECK (scheduled_for >= created_at)
);

-- Create notification_history table for tracking sent notifications
CREATE TABLE IF NOT EXISTS notification_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL DEFAULT 1 REFERENCES users(id) ON DELETE CASCADE,
    task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
    scheduled_notification_id INTEGER REFERENCES scheduled_notifications(id) ON DELETE SET NULL,

    -- Notification details
    notification_type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,

    -- Delivery tracking
    sent_at DATETIME NOT NULL,
    action_taken TEXT CHECK (action_taken IN ('dismissed', 'snoozed', 'completed', 'opened', 'none')),
    action_taken_at DATETIME,

    -- Metadata
    priority TEXT,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Add reminder fields to tasks table
ALTER TABLE tasks ADD COLUMN reminder_enabled BOOLEAN DEFAULT 0;
ALTER TABLE tasks ADD COLUMN reminder_minutes_before INTEGER; -- NULL uses default from preferences
ALTER TABLE tasks ADD COLUMN custom_reminder_times TEXT; -- JSON array of additional reminder times
ALTER TABLE tasks ADD COLUMN last_reminder_sent_at DATETIME;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_user ON scheduled_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_task ON scheduled_notifications(task_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_scheduled_for ON scheduled_notifications(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_status ON scheduled_notifications(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_type ON scheduled_notifications(notification_type);

CREATE INDEX IF NOT EXISTS idx_notification_history_user ON notification_history(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_task ON notification_history(task_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_sent_at ON notification_history(sent_at);
CREATE INDEX IF NOT EXISTS idx_notification_history_type ON notification_history(notification_type);

-- Create trigger to update notification_preferences updated_at
CREATE TRIGGER IF NOT EXISTS update_notification_preferences_timestamp
AFTER UPDATE ON notification_preferences
FOR EACH ROW
BEGIN
    UPDATE notification_preferences SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Create trigger to mark scheduled notification as sent
CREATE TRIGGER IF NOT EXISTS mark_notification_sent
AFTER UPDATE OF status ON scheduled_notifications
WHEN NEW.status = 'sent' AND OLD.status != 'sent'
BEGIN
    UPDATE scheduled_notifications SET sent_at = CURRENT_TIMESTAMP WHERE id = NEW.id;

    -- Log to history
    INSERT INTO notification_history (
        user_id, task_id, scheduled_notification_id,
        notification_type, title, message, sent_at, priority
    ) VALUES (
        NEW.user_id, NEW.task_id, NEW.id,
        NEW.notification_type, NEW.title, NEW.message, CURRENT_TIMESTAMP, NEW.priority
    );
END;

-- Create trigger to auto-schedule due date reminders when task is created/updated
CREATE TRIGGER IF NOT EXISTS auto_schedule_due_reminder
AFTER INSERT ON tasks
WHEN NEW.due_date IS NOT NULL AND NEW.reminder_enabled = 1
BEGIN
    INSERT INTO scheduled_notifications (
        user_id, task_id, notification_type, title, message, scheduled_for, priority
    )
    SELECT
        1,
        NEW.id,
        'due_soon',
        'Task Due Soon',
        'Task "' || NEW.title || '" is due soon',
        datetime(NEW.due_date, '-' || COALESCE(NEW.reminder_minutes_before, 15) || ' minutes'),
        CASE
            WHEN NEW.priority = 'urgent' THEN 'high'
            WHEN NEW.priority = 'high' THEN 'high'
            WHEN NEW.priority = 'medium' THEN 'medium'
            ELSE 'low'
        END
    WHERE datetime(NEW.due_date, '-' || COALESCE(NEW.reminder_minutes_before, 15) || ' minutes') > CURRENT_TIMESTAMP;
END;

-- Create trigger to update reminder when task due date changes
CREATE TRIGGER IF NOT EXISTS update_due_reminder
AFTER UPDATE OF due_date, reminder_enabled, reminder_minutes_before ON tasks
WHEN NEW.due_date IS NOT NULL AND NEW.reminder_enabled = 1 AND (OLD.due_date != NEW.due_date OR OLD.reminder_enabled != NEW.reminder_enabled OR OLD.reminder_minutes_before != NEW.reminder_minutes_before)
BEGIN
    -- Cancel old reminders
    UPDATE scheduled_notifications
    SET status = 'cancelled'
    WHERE task_id = NEW.id AND notification_type = 'due_soon' AND status = 'pending';

    -- Schedule new reminder
    INSERT INTO scheduled_notifications (
        user_id, task_id, notification_type, title, message, scheduled_for, priority
    )
    SELECT
        1,
        NEW.id,
        'due_soon',
        'Task Due Soon',
        'Task "' || NEW.title || '" is due soon',
        datetime(NEW.due_date, '-' || COALESCE(NEW.reminder_minutes_before, 15) || ' minutes'),
        CASE
            WHEN NEW.priority = 'urgent' THEN 'high'
            WHEN NEW.priority = 'high' THEN 'high'
            WHEN NEW.priority = 'medium' THEN 'medium'
            ELSE 'low'
        END
    WHERE datetime(NEW.due_date, '-' || COALESCE(NEW.reminder_minutes_before, 15) || ' minutes') > CURRENT_TIMESTAMP;
END;

-- Create view for pending notifications
CREATE VIEW IF NOT EXISTS v_pending_notifications AS
SELECT
    sn.id,
    sn.user_id,
    sn.task_id,
    sn.notification_type,
    sn.title,
    sn.message,
    sn.scheduled_for,
    sn.priority,
    sn.action_url,
    t.title as task_title,
    t.category as task_category,
    t.due_date as task_due_date
FROM scheduled_notifications sn
LEFT JOIN tasks t ON sn.task_id = t.id
WHERE sn.status = 'pending'
  AND sn.scheduled_for <= datetime('now', '+5 minutes')
ORDER BY sn.scheduled_for ASC, sn.priority DESC;

-- Create view for overdue tasks that need notification
CREATE VIEW IF NOT EXISTS v_overdue_tasks_for_notification AS
SELECT
    t.id,
    t.title,
    t.due_date,
    t.priority,
    t.last_reminder_sent_at
FROM tasks t
WHERE t.status = 'active'
  AND t.due_date < CURRENT_TIMESTAMP
  AND (t.last_reminder_sent_at IS NULL OR t.last_reminder_sent_at < datetime('now', '-1 hour'))
ORDER BY t.priority DESC, t.due_date ASC;

-- Initialize default notification preferences for existing users
INSERT OR IGNORE INTO notification_preferences (user_id) VALUES (1);

-- Initialize reminder fields for existing tasks
UPDATE tasks SET reminder_enabled = 0 WHERE reminder_enabled IS NULL;
