/**
 * ============================================
 * Rutas REST — /api/tasks (Kanban)
 * ============================================
 */

const express = require('express');
const {
  getQueries,
  formatTask,
  VALID_STATUSES,
  VALID_PRIORITIES,
  statusToCompleted,
} = require('../db');

const router = express.Router();

function isValidDueDate(value) {
  if (value === null || value === undefined || value === '') return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function normalizeDueDate(value) {
  if (value === null || value === undefined || value === '') return null;
  return value;
}

function parseProjectId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function validateStatus(status) {
  return VALID_STATUSES.includes(status);
}

function validatePriority(priority) {
  return VALID_PRIORITIES.includes(priority);
}

/** GET /api/tasks?project_id=1 */
router.get('/', (req, res, next) => {
  try {
    const projectId = parseProjectId(req.query.project_id);
    if (!projectId) {
      return res.status(400).json({ error: 'El parámetro "project_id" es obligatorio.' });
    }
    if (!getQueries().projectFindById.get(projectId)) {
      return res.status(404).json({ error: 'Proyecto no encontrado.' });
    }
    const rows = getQueries().tasksFindByProject.all(projectId);
    res.json(rows.map(formatTask));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/tasks
 * Body: { text, project_id, description?, priority?, status?, due_date? }
 */
router.post('/', (req, res, next) => {
  try {
    const {
      text,
      project_id,
      description = '',
      priority = 'medium',
      status = 'todo',
      due_date = null,
    } = req.body;

    const projectId = parseProjectId(project_id);

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'El campo "text" es obligatorio.' });
    }
    if (!projectId) {
      return res.status(400).json({ error: 'El campo "project_id" es obligatorio.' });
    }
    if (!getQueries().projectFindById.get(projectId)) {
      return res.status(404).json({ error: 'Proyecto no encontrado.' });
    }
    if (!validatePriority(priority)) {
      return res.status(400).json({ error: 'Prioridad inválida.' });
    }
    if (!validateStatus(status)) {
      return res.status(400).json({ error: 'Estatus inválido.' });
    }
    if (!isValidDueDate(due_date)) {
      return res.status(400).json({ error: 'Formato de due_date inválido.' });
    }

    const result = getQueries().taskInsert.run(
      text.trim(),
      typeof description === 'string' ? description.trim() : '',
      priority,
      status,
      statusToCompleted(status),
      normalizeDueDate(due_date),
      new Date().toISOString(),
      projectId
    );

    res.status(201).json(formatTask(getQueries().taskFindById.get(result.lastInsertRowid)));
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/tasks/:id
 * Body parcial: { text?, description?, priority?, status?, due_date?, project_id? }
 */
router.put('/:id', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'ID de tarea inválido.' });
    }

    const existing = getQueries().taskFindById.get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Tarea no encontrada.' });
    }

    const { text, description, priority, status, due_date, project_id } = req.body;

    const updated = {
      text: text !== undefined ? text : existing.text,
      description: description !== undefined ? description : (existing.description || ''),
      priority: priority !== undefined ? priority : existing.priority,
      status: status !== undefined ? status : existing.status,
      due_date: due_date !== undefined ? due_date : existing.due_date,
      project_id: project_id !== undefined ? parseProjectId(project_id) : existing.project_id,
    };

    if (typeof updated.text !== 'string' || !updated.text.trim()) {
      return res.status(400).json({ error: 'El título no puede estar vacío.' });
    }
    if (!validatePriority(updated.priority)) {
      return res.status(400).json({ error: 'Prioridad inválida.' });
    }
    if (!validateStatus(updated.status)) {
      return res.status(400).json({ error: 'Estatus inválido.' });
    }
    if (!updated.project_id || !getQueries().projectFindById.get(updated.project_id)) {
      return res.status(400).json({ error: 'Proyecto inválido.' });
    }
    if (!isValidDueDate(updated.due_date)) {
      return res.status(400).json({ error: 'Formato de due_date inválido.' });
    }

    getQueries().taskUpdate.run(
      updated.text.trim(),
      typeof updated.description === 'string' ? updated.description.trim() : '',
      updated.priority,
      updated.status,
      statusToCompleted(updated.status),
      normalizeDueDate(updated.due_date),
      updated.project_id,
      id
    );

    res.json(formatTask(getQueries().taskFindById.get(id)));
  } catch (error) {
    next(error);
  }
});

/** DELETE /api/tasks/done/bulk?project_id=1 — Limpiar columna Terminada */
router.delete('/done/bulk', (req, res, next) => {
  try {
    const projectId = parseProjectId(req.query.project_id);
    if (!projectId) {
      return res.status(400).json({ error: 'El parámetro "project_id" es obligatorio.' });
    }
    getQueries().tasksDeleteDoneByProject.run(projectId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

/** DELETE /api/tasks/:id */
router.delete('/:id', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'ID de tarea inválido.' });
    }
    if (!getQueries().taskFindById.get(id)) {
      return res.status(404).json({ error: 'Tarea no encontrada.' });
    }
    getQueries().taskDelete.run(id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;