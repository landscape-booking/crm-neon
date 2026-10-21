-- ============================================================
--  CRM المعتمرين والرحلات v5.4 - Neon (PostgreSQL) Schema
--  شغّل الملف ده مرة واحدة في Neon SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  username TEXT PRIMARY KEY,
  password TEXT NOT NULL,
  code     TEXT DEFAULT '',
  role     TEXT DEFAULT 'mowazaf',
  name     TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS clients (
  id                     TEXT PRIMARY KEY,
  agent_code             TEXT DEFAULT '',
  agent_name             TEXT DEFAULT '',
  name                   TEXT DEFAULT '',
  phone                  TEXT DEFAULT '',
  address                TEXT DEFAULT '',
  members                NUMERIC DEFAULT 1,
  program_category       TEXT DEFAULT '',
  program_name           TEXT DEFAULT '',
  turkey_sub_name        TEXT DEFAULT '',
  price                  NUMERIC DEFAULT 0,
  status                 TEXT DEFAULT '',
  postpone_date          TEXT DEFAULT '',
  is_followup            TEXT DEFAULT 'لا',
  followup_date          TEXT DEFAULT '',
  followup_day           TEXT DEFAULT '',
  created_date           TEXT DEFAULT '',
  fb1                    TEXT DEFAULT '',
  fb2                    TEXT DEFAULT '',
  paid_amount            NUMERIC DEFAULT 0,
  payment_notes          TEXT DEFAULT '',
  reviewed_by_followup   TEXT DEFAULT 'لا',
  last_modified_by_role  TEXT DEFAULT '',
  program_id             TEXT DEFAULT '',
  trip_details           JSONB,
  fb3                    TEXT DEFAULT '',
  followup_time          TEXT DEFAULT '',
  reviewed_by            TEXT DEFAULT '',
  supervisor_note        TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_clients_agent_code ON clients(lower(agent_code));
CREATE INDEX IF NOT EXISTS idx_clients_agent_name ON clients(lower(agent_name));
CREATE INDEX IF NOT EXISTS idx_clients_status    ON clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_created   ON clients(created_date);

CREATE TABLE IF NOT EXISTS omra_programs (
  name TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS turkey_programs (
  name TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS programs (
  id         TEXT PRIMARY KEY,
  category   TEXT DEFAULT '',
  name       TEXT DEFAULT '',
  details    JSONB,
  active     TEXT DEFAULT 'نعم',
  created_by TEXT DEFAULT '',
  created_at TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS admin_notes (
  id          TEXT PRIMARY KEY,
  from_user   TEXT DEFAULT '',
  to_user     TEXT DEFAULT '',
  client_id   TEXT DEFAULT '',
  client_name TEXT DEFAULT '',
  note_text   TEXT DEFAULT '',
  status      TEXT DEFAULT 'unread',
  created_at  TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_notes_to ON admin_notes(lower(to_user));

CREATE TABLE IF NOT EXISTS trip_requests (
  id                TEXT PRIMARY KEY,
  client_id         TEXT DEFAULT '',
  client_name       TEXT DEFAULT '',
  requested_by      TEXT DEFAULT '',
  requested_by_code TEXT DEFAULT '',
  proposed          JSONB,
  reason            TEXT DEFAULT '',
  status            TEXT DEFAULT 'pending',
  decided_by        TEXT DEFAULT '',
  decided_at        TEXT DEFAULT '',
  created_at        TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT DEFAULT ''
);

-- أول حساب: المدير الفني (غيّر البيانات بعد أول دخول)
INSERT INTO users (username, password, code, role, name)
VALUES ('admin', '123456', 'A00', 'tech_manager', 'المدير الفني')
ON CONFLICT (username) DO NOTHING;
