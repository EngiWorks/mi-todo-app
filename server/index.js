/**
 * ============================================
 * Servidor Express — API REST + Frontend estático
 * ============================================
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const tasksRouter = require('./routes/tasks');

const app = express();
const PORT = process.env.PORT || 3000;

// ----- Middleware global -----
app.use(cors());
app.use(express.json());

// ----- Rutas API -----
app.use('/api/tasks', tasksRouter);

// ----- Frontend estático (carpeta /frontend) -----
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

// ----- SPA fallback: servir index.html -----
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
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

app.listen(PORT, () => {
  console.log(`Servidor en http://localhost:${PORT}`);
  console.log(`API:   http://localhost:${PORT}/api/tasks`);
});