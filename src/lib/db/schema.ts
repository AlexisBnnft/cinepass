export const SCHEMA = `
  CREATE TABLE IF NOT EXISTS cinemas (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    allocine_code   TEXT NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    arrondissement  INTEGER NOT NULL,
    address         TEXT,
    latitude        REAL,
    longitude       REAL,
    is_chain        INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS movies (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    allocine_id     TEXT UNIQUE,
    title           TEXT NOT NULL,
    title_original  TEXT,
    poster_url      TEXT,
    genres          TEXT,
    duration_min    INTEGER,
    director        TEXT,
    synopsis        TEXT,
    release_date    TEXT,
    allocine_url    TEXT,
    press_rating    REAL,
    user_rating     REAL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS showtimes (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    movie_id        INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    cinema_id       INTEGER NOT NULL REFERENCES cinemas(id) ON DELETE CASCADE,
    show_date       TEXT NOT NULL,
    show_time       TEXT NOT NULL,
    show_datetime   TEXT NOT NULL,
    version         TEXT DEFAULT 'VF',
    format          TEXT DEFAULT '2D',
    booking_url     TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_showtimes_date ON showtimes(show_date);
  CREATE INDEX IF NOT EXISTS idx_showtimes_movie_date ON showtimes(movie_id, show_date);
  CREATE INDEX IF NOT EXISTS idx_showtimes_cinema_date ON showtimes(cinema_id, show_date);
  CREATE INDEX IF NOT EXISTS idx_showtimes_datetime ON showtimes(show_datetime);
  CREATE INDEX IF NOT EXISTS idx_movies_allocine_id ON movies(allocine_id);

  -- Pathé booking sessions (Vista session ids), discovered from pathe.fr
  CREATE TABLE IF NOT EXISTS pathe_sessions (
    vista_ref       TEXT NOT NULL,
    session_id      INTEGER NOT NULL,
    cinema_id       INTEGER NOT NULL REFERENCES cinemas(id) ON DELETE CASCADE,
    cinema_slug     TEXT NOT NULL,
    show_slug       TEXT,
    title_norm      TEXT,
    show_datetime   TEXT NOT NULL,
    version         TEXT,
    auditorium      TEXT,
    capacity        INTEGER,
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (vista_ref, session_id)
  );

  CREATE INDEX IF NOT EXISTS idx_pathe_sessions_lookup ON pathe_sessions(cinema_id, show_datetime);
  CREATE INDEX IF NOT EXISTS idx_pathe_sessions_datetime ON pathe_sessions(show_datetime);

  -- Latest seat availability snapshot per session
  CREATE TABLE IF NOT EXISTS pathe_seats (
    vista_ref       TEXT NOT NULL,
    session_id      INTEGER NOT NULL,
    fetched_at      TEXT NOT NULL,
    room_name       TEXT,
    seats_total     INTEGER NOT NULL,
    seats_free      INTEGER NOT NULL,
    col_count       INTEGER,
    layout          TEXT,
    PRIMARY KEY (vista_ref, session_id)
  );

  -- "Refresh now" requests from the site. The seat scraper can't run on the VM
  -- (Pathé refuses datacenter IPs), so the site queues here and the residential
  -- worker picks it up within a minute.
  CREATE TABLE IF NOT EXISTS pathe_refresh_queue (
    vista_ref       TEXT NOT NULL,
    session_id      INTEGER NOT NULL,
    requested_at    TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (vista_ref, session_id)
  );

  CREATE TABLE IF NOT EXISTS scrape_runs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at      TEXT NOT NULL,
    completed_at    TEXT,
    status          TEXT NOT NULL DEFAULT 'running',
    cinemas_scraped INTEGER DEFAULT 0,
    movies_found    INTEGER DEFAULT 0,
    showtimes_found INTEGER DEFAULT 0,
    date_range_start TEXT,
    date_range_end   TEXT,
    error_log       TEXT
  );
`;
