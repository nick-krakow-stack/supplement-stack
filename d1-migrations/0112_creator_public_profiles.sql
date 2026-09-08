PRAGMA foreign_keys = ON;

-- Publication state only: party name, slug, type and avatar remain canonical in parties.
-- No backfill: every existing Creator/Brand stays non-public until explicit owner consent.
CREATE TABLE creator_public_profiles (
  party_id INTEGER PRIMARY KEY REFERENCES parties(id) ON DELETE RESTRICT,
  description TEXT NOT NULL CHECK (length(description) BETWEEN 40 AND 180),
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
  identity_json TEXT NOT NULL CHECK (json_valid(identity_json)),
  identity_invalidated_at TEXT,
  consent_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  consent_at TEXT NOT NULL,
  consent_version TEXT NOT NULL CHECK (consent_version = 'creator-public-profile-v1'),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  submitted_at TEXT NOT NULL,
  moderated_by INTEGER REFERENCES users(id) ON DELETE RESTRICT,
  moderated_at TEXT,
  moderation_reason TEXT CHECK (moderation_reason IS NULL OR length(moderation_reason) BETWEEN 5 AND 500),
  published_at TEXT,
  withdrawn_at TEXT,
  updated_at TEXT NOT NULL,
  CHECK (status <> 'approved' OR ((published_at IS NOT NULL OR identity_invalidated_at IS NOT NULL) AND moderated_by IS NOT NULL AND moderated_at IS NOT NULL AND withdrawn_at IS NULL)),
  CHECK (status <> 'rejected' OR (moderation_reason IS NOT NULL AND moderated_by IS NOT NULL AND moderated_at IS NOT NULL)),
  CHECK (status <> 'withdrawn' OR withdrawn_at IS NOT NULL)
);

CREATE INDEX idx_creator_public_profiles_status ON creator_public_profiles(status, submitted_at, party_id);

-- A later restoration of old identity bytes must not resurrect an earlier consent/review.
-- Unrelated party settings deliberately do not invalidate an approved public profile.
CREATE TRIGGER creator_public_profile_identity_changed
AFTER UPDATE OF name, slug, type, public_profile_image_url ON parties
WHEN OLD.name IS NOT NEW.name OR OLD.slug IS NOT NEW.slug OR OLD.type IS NOT NEW.type
  OR OLD.public_profile_image_url IS NOT NEW.public_profile_image_url
BEGIN
  UPDATE creator_public_profiles
  SET identity_invalidated_at = CURRENT_TIMESTAMP, published_at = NULL,
    version = version + 1, updated_at = CURRENT_TIMESTAMP
  WHERE party_id = NEW.id;
END;
