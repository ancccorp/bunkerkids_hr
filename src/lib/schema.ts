// SQLite schema. Dates are stored as 'YYYY-MM-DD', times as 'HH:MM', durations in minutes.
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS departments (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  parent_id   INTEGER REFERENCES departments(id),
  approver_id INTEGER            -- 결재권자 (users.id)
);

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL,
  title         TEXT,                       -- 직무/직책
  email         TEXT NOT NULL UNIQUE,
  personal_email TEXT,
  phone         TEXT,
  employee_no   TEXT,                       -- 사번
  join_date     TEXT NOT NULL,              -- 입사일
  leave_date    TEXT,                       -- 퇴사(예정)일
  status        TEXT NOT NULL DEFAULT '재직', -- 재직 | 수습 | 휴직 | 퇴사예정 | 퇴사
  department_id INTEGER REFERENCES departments(id),
  role          TEXT NOT NULL DEFAULT 'member', -- admin | member
  color         TEXT NOT NULL DEFAULT '#f97066'
);

CREATE TABLE IF NOT EXISTS notices (
  id           INTEGER PRIMARY KEY,
  title        TEXT NOT NULL,
  emoji        TEXT,
  category     TEXT NOT NULL DEFAULT '일반',
  body         TEXT NOT NULL,
  author_id    INTEGER NOT NULL REFERENCES users(id),
  target       TEXT NOT NULL DEFAULT '전체 구성원',
  published_at TEXT NOT NULL,
  hidden       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS notice_reactions (
  notice_id INTEGER NOT NULL REFERENCES notices(id) ON DELETE CASCADE,
  user_id   INTEGER NOT NULL REFERENCES users(id),
  emoji     TEXT NOT NULL,
  PRIMARY KEY (notice_id, user_id, emoji)
);

CREATE TABLE IF NOT EXISTS notice_comments (
  id         INTEGER PRIMARY KEY,
  notice_id  INTEGER NOT NULL REFERENCES notices(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS leave_types (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  icon        TEXT NOT NULL,
  is_annual   INTEGER NOT NULL DEFAULT 0,   -- 연차 (잔여 차감 대상)
  grant_minutes INTEGER,                    -- 신청 시 부여량 (NULL = 제한 없음)
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS leave_grants (
  user_id       INTEGER NOT NULL REFERENCES users(id),
  leave_type_id INTEGER NOT NULL REFERENCES leave_types(id),
  year          INTEGER NOT NULL,
  minutes       INTEGER NOT NULL,
  PRIMARY KEY (user_id, leave_type_id, year)
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id            INTEGER PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id),
  leave_type_id INTEGER NOT NULL REFERENCES leave_types(id),
  start_date    TEXT NOT NULL,
  end_date      TEXT NOT NULL,
  unit          TEXT NOT NULL,        -- day | am | pm | hours
  start_time    TEXT,                 -- unit=hours 일 때
  end_time      TEXT,
  minutes       INTEGER NOT NULL,     -- 총 사용 시간(분)
  reason        TEXT,
  status        TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected | cancelled
  approver_id   INTEGER REFERENCES users(id),
  created_at    TEXT NOT NULL,
  decided_at    TEXT
);

CREATE TABLE IF NOT EXISTS work_records (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  date       TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time   TEXT NOT NULL,
  UNIQUE (user_id, date)
);

CREATE TABLE IF NOT EXISTS documents (
  id         INTEGER PRIMARY KEY,
  template   TEXT NOT NULL,       -- 지출결의서 등
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  amount     INTEGER,
  author_id  INTEGER NOT NULL REFERENCES users(id),
  status     TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected | cancelled
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS approval_steps (
  id          INTEGER PRIMARY KEY,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  step        INTEGER NOT NULL,
  approver_id INTEGER NOT NULL REFERENCES users(id),
  status      TEXT NOT NULL DEFAULT 'waiting', -- waiting | pending | approved | rejected
  comment     TEXT,
  decided_at  TEXT
);

CREATE TABLE IF NOT EXISTS kudos (
  id         INTEGER PRIMARY KEY,
  from_id    INTEGER NOT NULL REFERENCES users(id),
  to_id      INTEGER NOT NULL REFERENCES users(id),
  emoji      TEXT NOT NULL,
  message    TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`;
