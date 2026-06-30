/**
 * ============================================
 * Base de datos SQLite — Kanban
 * ============================================
 *
 * projects: id, name, color, created_at
 * tasks:    id, text, description, priority, status, due_date,
 *           completed, created_at, project_id
 *
 * status: todo | in_progress | done
 */

const path = require('path');
const os = require('os');

const VALID_STATUSES = ['todo', 'in_progress', 'done'];
const VALID_PRIORITIES = ['high', 'medium', 'low'];

/** @type {import('better-sqlite3').Database | import('node:sqlite').DatabaseSync | null} */
let db = null;

/** @type {Object | null} */
let queries = null;

function resolveDbPath() {
  if (process.env.VERCEL) return path.join(os.tmpdir(), 'tasks.db');
  return path.join(__dirname, 'tasks.db');
}

function columnExists(table, column) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  return columns.some((col) => col.name === column);
}

function migrateDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL CHECK(length(trim(name)) > 0),
      color      TEXT    NOT NULL DEFAULT '#6366f1',
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      text        TEXT    NOT NULL CHECK(length(trim(text)) > 0),
      description TEXT    DEFAULT '',
      priority    TEXT    NOT NULL DEFAULT 'medium' CHECK(priority IN ('high', 'medium', 'low')),
      status      TEXT    NOT NULL DEFAULT 'todo' CHECK(status IN ('todo', 'in_progress', 'done')),
      completed   INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0, 1)),
      due_date    TEXT,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      project_id  INTEGER REFERENCES projects(id) ON DELETE CASCADE
    )
  `);

  // Migraciones incrementales para BD existentes
  if (!columnExists('tasks', 'project_id')) {
    db.exec('ALTER TABLE tasks ADD COLUMN project_id INTEGER REFERENCES projects(id)');
  }
  if (!columnExists('tasks', 'description')) {
    db.exec("ALTER TABLE tasks ADD COLUMN description TEXT DEFAULT ''");
  }
  if (!columnExists('tasks', 'priority')) {
    db.exec("ALTER TABLE tasks ADD COLUMN priority TEXT NOT NULL DEFAULT 'medium'");
  }
  if (!columnExists('tasks', 'status')) {
    db.exec("ALTER TABLE tasks ADD COLUMN status TEXT NOT NULL DEFAULT 'todo'");
    db.exec("UPDATE tasks SET status = 'done', completed = 1 WHERE completed = 1");
    db.exec("UPDATE tasks SET status = 'todo', completed = 0 WHERE completed = 0");
  }

  let defaultProject = db.prepare("SELECT id FROM projects WHERE name = 'General' LIMIT 1").get();

  if (!defaultProject) {
    const result = db
      .prepare("INSERT INTO projects (name, color, created_at) VALUES ('General', '#6366f1', ?)")
      .run(new Date().toISOString());
    defaultProject = { id: result.lastInsertRowid };
  }

  db.prepare('UPDATE tasks SET project_id = ? WHERE project_id IS NULL').run(defaultProject.id);
  db.prepare("UPDATE tasks SET description = '' WHERE description IS NULL").run();
}

function initDatabase() {
  if (db) return;

  const dbPath = resolveDbPath();

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

  migrateDatabase();

  queries = {
    projectsFindAll: db.prepare(`
      SELECT
        p.id, p.name, p.color, p.created_at,
        COUNT(t.id) AS task_count,
        SUM(CASE WHEN t.status != 'done' THEN 1 ELSE 0 END) AS pending_count
      FROM projects p
      LEFT JOIN tasks t ON t.project_id = p.id
      GROUP BY p.id
      ORDER BY p.created_at ASC
    `),

    projectFindById: db.prepare(`
      SELECT id, name, color, created_at FROM projects WHERE id = ?
    `),

    projectInsert: db.prepare(`
      INSERT INTO projects (name, color, created_at) VALUES (?, ?, ?)
    `),

    projectUpdate: db.prepare(`
      UPDATE projects SET name = ?, color = ? WHERE id = ?
    `),

    projectDelete: db.prepare('DELETE FROM projects WHERE id = ?'),
    projectCount: db.prepare('SELECT COUNT(*) AS count FROM projects'),

    tasksFindByProject: db.prepare(`
      SELECT id, text, description, priority, status, completed,
             due_date, created_at, project_id
      FROM tasks
      WHERE project_id = ?
      ORDER BY
        CASE status WHEN 'todo' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,
        CASE WHEN due_date IS NULL THEN 1 ELSE 0 END,
        due_date ASC,
        datetime(created_at) DESC
    `),

    taskFindById: db.prepare(`
      SELECT id, text, description, priority, status, completed,
             due_date, created_at, project_id
      FROM tasks WHERE id = ?
    `),

    taskInsert: db.prepare(`
      INSERT INTO tasks (text, description, priority, status, completed, due_date, created_at, project_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `),

    taskUpdate: db.prepare(`
      UPDATE tasks
      SET text = ?, description = ?, priority = ?, status = ?,
          completed = ?, due_date = ?, project_id = ?
      WHERE id = ?
    `),

    taskDelete: db.prepare('DELETE FROM tasks WHERE id = ?'),
    tasksDeleteDoneByProject: db.prepare(`
      DELETE FROM tasks WHERE project_id = ? AND status = 'done'
    `),
    tasksDeleteByProject: db.prepare('DELETE FROM tasks WHERE project_id = ?'),
  };
}

function getQueries() {
  initDatabase();
  return queries;
}

function statusToCompleted(status) {
  return status === 'done' ? 1 : 0;
}

function formatProject(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    created_at: row.created_at,
    task_count: row.task_count ?? 0,
    pending_count: row.pending_count ?? 0,
  };
}

function formatTask(row) {
  if (!row) return null;
  return {
    id: row.id,
    text: row.text,
    description: row.description || '',
    priority: row.priority,
    status: row.status,
    completed: Boolean(row.completed),
    due_date: row.due_date,
    created_at: row.created_at,
    project_id: row.project_id,
  };
}

module.exports = {
  getQueries,
  formatProject,
  formatTask,
  VALID_STATUSES,
  VALID_PRIORITIES,
  statusToCompleted,
};