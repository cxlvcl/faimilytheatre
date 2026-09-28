-- Existing dates keep an unknown start time until an administrator fills it in.
ALTER TABLE events ADD COLUMN event_time TIME NULL DEFAULT NULL AFTER event_date;
