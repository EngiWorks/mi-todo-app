/**
 * ============================================
 * Rutas REST — /api/tasks
 * ============================================
 *
 * GET    /api/tasks       → Listar todas las tareas
 * POST   /api/tasks       → Crear tarea
 * PUT    /api/tasks/:id   → Actualizar tarea
 * DELETE /api/tasks/:id   → Eliminar tarea
 */

const express = require('express');
const { getQueries, formatTask } = require('../db');

const router = express.Router();

/**
 * Valida formato YYYY-MM-DD para due_date.
 * @param {string|null|undefined} value
 */
function isValidDueDate(value) {
  if (value === null || value === undefined || value === '') return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

/**
 * Normaliza due_date: cadena vacía → null.
 * @param {string|null|undefined} value
 */
function normalizeDueDate(value) {
  if (value === null || value === undefined || value === '') return null;
  return value;
}

/** GET /api/tasks */
router.get('/', (req, res, next) => {
  try {
    const rows = getQueries().findAll.all();
    res.json(rows.map(formatTask));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/tasks
 * Body: { text, completed?, due_date? }
 */
router.post('/', (req, res, next) => {
  try {
    const { text, completed = false, due_date = null } = req.body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'El campo "text" es obligatorio.' });
    }

    if (typeof completed !== 'boolean') {
      return res.status(400).json({ error: 'El campo "completed" debe ser booleano.' });
    }

    if (!isValidDueDate(due_date)) {
      return res.status(400).json({ error: 'Formato de due_date inválido. Usa YYYY-MM-DD.' });
    }

    const result = getQueries().insert.run(
      text.trim(),
      completed ? 1 : 0,
      normalizeDueDate(due_date),
      new Date().toISOString()
    );

    const task = getQueries().findById.get(result.lastInsertRowid);
    res.status(201).json(formatTask(task));
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/tasks/:id
 * Body parcial: { text?, completed?, due_date? }
 */
router.put('/:id', (req, res, next) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'ID de tarea inválido.' });
    }

    const existing = getQueries().findById.get(id);

    if (!existing) {
      return res.status(404).json({ error: 'Tarea no encontrada.' });
    }

    const { text, completed, due_date } = req.body;

    const updated = {
      text: text !== undefined ? text : existing.text,
      completed: completed !== undefined ? completed : Boolean(existing.completed),
      due_date: due_date !== undefined ? due_date : existing.due_date,
    };

    if (typeof updated.text !== 'string' || !updated.text.trim()) {
      return res.status(400).json({ error: 'El campo "text" no puede estar vacío.' });
    }

    if (typeof updated.completed !== 'boolean') {
      return res.status(400).json({ error: 'El campo "completed" debe ser booleano.' });
    }

    if (!isValidDueDate(updated.due_date)) {
      return res.status(400).json({ error: 'Formato de due_date inválido. Usa YYYY-MM-DD.' });
    }

    getQueries().update.run(
      updated.text.trim(),
      updated.completed ? 1 : 0,
      normalizeDueDate(updated.due_date),
      id
    );

    const task = getQueries().findById.get(id);
    res.json(formatTask(task));
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

    const existing = getQueries().findById.get(id);

    if (!existing) {
      return res.status(404).json({ error: 'Tarea no encontrada.' });
    }

    getQueries().remove.run(id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;