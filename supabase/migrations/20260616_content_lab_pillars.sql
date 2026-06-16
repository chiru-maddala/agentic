-- Add pillar and published_at columns
ALTER TABLE content_lab ADD COLUMN IF NOT EXISTS pillar text;
ALTER TABLE content_lab ADD COLUMN IF NOT EXISTS published_at timestamptz;

-- Drop old constraint first, then migrate data, then add new constraint
ALTER TABLE content_lab DROP CONSTRAINT IF EXISTS content_lab_status_check;

UPDATE content_lab SET status = 'new' WHERE status = 'pending';
UPDATE content_lab SET status = 'ready' WHERE status = 'generated';

ALTER TABLE content_lab ADD CONSTRAINT content_lab_status_check
  CHECK (status IN ('new', 'ready', 'published'));
