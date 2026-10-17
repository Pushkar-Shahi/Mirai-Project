-- Migration 012: actor_id for authority sent notifications, phone_e164 for automated WhatsApp, and channel deliveries status support
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS actor_id BIGINT REFERENCES users(id);

CREATE INDEX IF NOT EXISTS ix_notifications_actor
  ON notifications (actor_id, send_at DESC) WHERE actor_id IS NOT NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone_e164 TEXT;

ALTER TABLE notification_deliveries DROP CONSTRAINT IF EXISTS notification_deliveries_status_check;
ALTER TABLE notification_deliveries ADD CONSTRAINT notification_deliveries_status_check
  CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'cancelled', 'skipped'));
