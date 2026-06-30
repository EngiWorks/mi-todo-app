/**
 * ============================================
 * Aplicación Express (compartida: local + Vercel)
 * ============================================
 *
 * Exporta createApp() sin app.listen() para poder
 * reutilizarla en server/index.js y api/index.js.
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const tasksRouter = require('./routes/tasks');

/**
 * Crea y configura la instancia de Express.
 * @param {Object} [options]
 * @param {boolean} [options.serveStatic=true] - Servir frontend (solo desarrollo local)
 * @returns {import('express').Express}
 */
function createApp({ serveStatic = true } = {}) {
  const app = express();

  // ----- Middleware global -----
  app.use(cors());
  app.use(express.json());

  // ----- Rutas API -----
  app.use('/api/tasks', tasksRouter);

  // ----- Frontend estático (solo en entorno local) -----
  if (serveStatic) {
    const frontendPath = path.join(__dirname, '..', 'frontend');

    app.use(express.static(frontendPath));

    // SPA fallback
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(frontendPath, 'index.html'));
    });
  }

  // ----- 404 para rutas API inexistentes -----
  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Ruta de API no encontrada.' });
  });

  // ----- Manejo centralizado de errores -----
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error('[Error]', err.message);

    const status = err.status || 500;
    res.status(status).json({
      error: status === 500 ? 'Error interno del servidor.' : err.message,
    });
  });

  return app;
}

module.exports = { createApp };