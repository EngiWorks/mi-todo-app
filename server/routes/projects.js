/**
 * ============================================
 * Rutas REST — /api/projects
 * ============================================
 */

const express = require('express');
const { getQueries, formatProject } = require('../db');

const router = express.Router();

const VALID_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#64748b'];

/** GET /api/projects */
router.get('/', (req, res, next) => {
  try {
    const rows = getQueries().projectsFindAll.all();
    res.json(rows.map(formatProject));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/projects
 * Body: { name, color? }
 */
router.post('/', (req, res, next) => {
  try {
    const { name, color = '#6366f1' } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'El campo "name" es obligatorio.' });
    }

    const projectColor = VALID_COLORS.includes(color) ? color : '#6366f1';

    const result = getQueries().projectInsert.run(
      name.trim(),
      projectColor,
      new Date().toISOString()
    );

    const project = getQueries().projectFindById.get(result.lastInsertRowid);
    res.status(201).json({ ...formatProject(project), task_count: 0, pending_count: 0 });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/projects/:id
 * Body: { name?, color? }
 */
router.put('/:id', (req, res, next) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'ID de proyecto inválido.' });
    }

    const existing = getQueries().projectFindById.get(id);

    if (!existing) {
      return res.status(404).json({ error: 'Proyecto no encontrado.' });
    }

    const { name, color } = req.body;

    const updatedName = name !== undefined ? name : existing.name;
    const updatedColor = color !== undefined ? color : existing.color;

    if (typeof updatedName !== 'string' || !updatedName.trim()) {
      return res.status(400).json({ error: 'El nombre no puede estar vacío.' });
    }

    const finalColor = VALID_COLORS.includes(updatedColor) ? updatedColor : existing.color;

    getQueries().projectUpdate.run(updatedName.trim(), finalColor, id);

    const rows = getQueries().projectsFindAll.all();
    const project = rows.find((r) => r.id === id);
    res.json(formatProject(project));
  } catch (error) {
    next(error);
  }
});

/** DELETE /api/projects/:id */
router.delete('/:id', (req, res, next) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'ID de proyecto inválido.' });
    }

    const existing = getQueries().projectFindById.get(id);

    if (!existing) {
      return res.status(404).json({ error: 'Proyecto no encontrado.' });
    }

    const totalProjects = getQueries().projectCount.get().count;

    if (totalProjects <= 1) {
      return res.status(400).json({ error: 'No puedes eliminar el último proyecto.' });
    }

    getQueries().tasksDeleteByProject.run(id);
    getQueries().projectDelete.run(id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;