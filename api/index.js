/**
 * ============================================
 * Punto de entrada serverless para Vercel
 * ============================================
 *
 * Vercel enruta /api/* hacia esta función.
 * El frontend se sirve como estático desde /frontend (vercel.json).
 */

const { createApp } = require('../server/app');

// En Vercel solo exponemos la API; el frontend lo sirve Vercel como estático
const app = createApp({ serveStatic: false });

module.exports = app;