/**
 * ============================================
 * Base de datos SQLite
 * ============================================
 *
 * Usa better-sqlite3 (requerido). Si no está compilado,
 * cae en node:sqlite integrado como respaldo de desarrollo.
 *
 * Tabla tasks: id, text, completed, due_date, created_at
 */

const path = require('path');

const DB_PATH = path.join(__dirname, 'tasks.db');

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS tasks (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    text       TEXT    NOT NULL CHECK(length(trim(text)) > 0),
    completed  INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0, 1)),
    due_date   TEXT,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`;

/** @type {import('better-sqlite3').Database | import('node:sqlite').DatabaseSync} */
let db;

/** Inicializa la conexión con el driver disponible */
function initDatabase() {
  try {
    const Database = require('better-sqlite3');
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    console.log('[db] Usando better-sqlite3');
  } catch {
    const { DatabaseSync } = require('node:sqlite');
    db = new DatabaseSync(DB_PATH);
    console.warn('[db] better-sqlite3 no disponible — usando node:sqlite como respaldo');
  }

  db.exec(SCHEMA);
}

initDatabase();

/** Consultas preparadas (parámetros posicionales ? para compatibilidad entre drivers) */
const queries = {
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

module.exports = { db, queries, formatTask };