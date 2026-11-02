CREATE TABLE organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('port', 'restoration', 'operator')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  role TEXT NOT NULL CHECK (role IN ('port', 'restoration', 'admin')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE listings (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('supply', 'demand')),
  title TEXT NOT NULL,
  organization TEXT NOT NULL,
  location TEXT NOT NULL,
  volume REAL NOT NULL CHECK (volume > 0),
  material TEXT NOT NULL,
  period TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'matched', 'closed')),
  updated_at TEXT NOT NULL
);

CREATE TABLE matches (
  id TEXT PRIMARY KEY,
  supply_id TEXT NOT NULL REFERENCES listings(id),
  demand_id TEXT NOT NULL REFERENCES listings(id),
  project_name TEXT NOT NULL,
  status TEXT NOT NULL,
  score REAL NOT NULL,
  distance_km REAL NOT NULL,
  matched_volume REAL NOT NULL,
  assignee TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  size INTEGER NOT NULL,
  project_id TEXT NOT NULL REFERENCES matches(id),
  object_key TEXT,
  uploaded_by TEXT NOT NULL,
  uploaded_at TEXT NOT NULL
);

CREATE TABLE spatial_datasets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  format TEXT NOT NULL,
  feature_count INTEGER,
  size INTEGER NOT NULL,
  status TEXT NOT NULL,
  object_key TEXT,
  uploaded_at TEXT NOT NULL
);

CREATE TABLE activities (
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  at TEXT NOT NULL
);

CREATE INDEX idx_listings_kind_status ON listings(kind, status);
CREATE INDEX idx_matches_status_updated ON matches(status, updated_at DESC);
CREATE INDEX idx_documents_project ON documents(project_id, uploaded_at DESC);
CREATE INDEX idx_activities_at ON activities(at DESC);

INSERT INTO organizations (id, name, type) VALUES
  ('org-bpa', '부산항만공사', 'port'),
  ('org-busan', '부산광역시 연안관리팀', 'restoration'),
  ('org-siltda', 'siltDA 운영센터', 'operator');

INSERT INTO users (id, email, name, organization_id, role) VALUES
  ('user-port', 'port@example.invalid', '김해진', 'org-bpa', 'port'),
  ('user-restoration', 'restoration@example.invalid', '이수연', 'org-busan', 'restoration'),
  ('user-admin', 'admin@example.invalid', '박현우', 'org-siltda', 'admin');
