/**
 * ============================================
 * Servidor local — desarrollo y producción tradicional
 * ============================================
 *
 * En Vercel NO se usa este archivo; la entrada es api/index.js.
 */

const { createApp } = require('./app');

const PORT = process.env.PORT || 3000;
const app = createApp({ serveStatic: true });

app.listen(PORT, () => {
  console.log(`Servidor en http://localhost:${PORT}`);
  console.log(`API:   http://localhost:${PORT}/api/tasks`);
});