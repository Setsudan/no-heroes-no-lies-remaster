-- Allow guest users: nullable email/password_hash, add is_guest.
-- Run this migration before using the guest feature.

ALTER TABLE users
  ALTER COLUMN email DROP NOT NULL,
  ALTER COLUMN password_hash DROP NOT NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_guest boolean NOT NULL DEFAULT false;
