/**
 * ============================================
 * Base de datos SQLite
 * ============================================
 *
 * - Local: better-sqlite3 (o node:sqlite como respaldo)
 * - Vercel: node:sqlite en /tmp (filesystem efímero serverless)
 *
 * Tabla tasks: id, text, completed, due_date, created_at
 */

const path = require('path');
const os = require('os');

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS tasks (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    text       TEXT    NOT NULL CHECK(length(trim(text)) > 0),
    completed  INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0, 1)),
    due_date   TEXT,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`;

/** @type {import('better-sqlite3').Database | import('node:sqlite').DatabaseSync | null} */
let db = null;

/** @type {Object | null} */
let queries = null;

/**
 * Resuelve la ruta del archivo SQLite según el entorno.
 * En Vercel solo /tmp es escribible (datos efímeros entre despliegues).
 */
function resolveDbPath() {
  if (process.env.VERCEL) {
    return path.join(os.tmpdir(), 'tasks.db');
  }
  return path.join(__dirname, 'tasks.db');
}

/**
 * Inicializa la conexión SQLite (lazy — importante en serverless).
 */
function initDatabase() {
  if (db) return;

  const dbPath = resolveDbPath();

  // En Vercel evitamos better-sqlite3 (binarios nativos problemáticos en Lambda)
  if (process.env.VERCEL) {
    const { DatabaseSync } = require('node:sqlite');
    db = new DatabaseSync(dbPath);
    console.log(`[db] Vercel — node:sqlite en ${dbPath}`);
  } else {
    try {
      const Database = require('better-sqlite3');
      db = new Database(dbPath);
      db.pragma('journal_mode = WAL');
      console.log(`[db] better-sqlite3 en ${dbPath}`);
    } catch {
      const { DatabaseSync } = require('node:sqlite');
      db = new DatabaseSync(dbPath);
      console.warn(`[db] better-sqlite3 no disponible — node:sqlite en ${dbPath}`);
    }
  }

  db.exec(SCHEMA);

  queries = {
    findAll: db.prepare(`
      SELECT id, text, completed, due_date, created_at
      FROM tasks
      ORDER BY
        CASE WHEN due_date IS NULL THEN 1 ELSE 0 END,
        due_date ASC,
        datetime(created_at) DESC
    `),

    findById: db.prepare(`
      SELECT id, text, completed, due_date, created_at
      FROM tasks
      WHERE id = ?
    `),

    insert: db.prepare(`
      INSERT INTO tasks (text, completed, due_date, created_at)
      VALUES (?, ?, ?, ?)
    `),

    update: db.prepare(`
      UPDATE tasks
      SET text = ?, completed = ?, due_date = ?
      WHERE id = ?
    `),

    remove: db.prepare('DELETE FROM tasks WHERE id = ?'),
  };
}

/** Devuelve las consultas preparadas (inicializa la BD si hace falta). */
function getQueries() {
  initDatabase();
  return queries;
}

/**
 * Convierte una fila de SQLite al formato JSON de la API.
 * @param {Object|null} row
 */
function formatTask(row) {
  if (!row) return null;

  return {
    id: row.id,
    text: row.text,
    completed: Boolean(row.completed),
    due_date: row.due_date,
    created_at: row.created_at,
  };
}

module.exports = { getQueries, formatTask };