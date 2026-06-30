/**
 * ============================================
 * Mi Lista de Tareas — Frontend (consume API REST)
 * ============================================
 *
 * Módulos:
 *   1. Constantes y configuración
 *   2. Cliente API (fetch)
 *   3. Estado de la aplicación
 *   4. Operaciones sobre tareas
 *   5. Filtrado, contador y utilidades
 *   6. Renderizado del DOM
 *   7. Edición inline
 *   8. Tema claro / oscuro
 *   9. Manejo de eventos e inicialización
 */

/* ============================================
   1. CONSTANTES Y CONFIGURACIÓN
   ============================================ */

/** URL base de la API REST */
const API_URL = '/api/tasks';

/** Clave usada en localStorage solo para el tema (no para tareas) */
const THEME_STORAGE_KEY = 'mi-todo-app-theme';

const DEFAULT_FILTER = 'all';
const DEFAULT_PRIORITY = 'medium';

const PRIORITY_CONFIG = {
  high:   { label: 'Alta',  cssClass: 'high' },
  medium: { label: 'Media', cssClass: 'medium' },
  low:    { label: 'Baja',  cssClass: 'low' },
};

const VALID_PRIORITIES = Object.keys(PRIORITY_CONFIG);

/* ----- Referencias al DOM ----- */

const addTaskForm        = document.getElementById('add-task-form');
const taskInput          = document.getElementById('task-input');
const prioritySelect     = document.getElementById('priority-select');
const dueDateInput       = document.getElementById('due-date-input');
const addTaskBtn         = document.getElementById('add-task-btn');
const taskList           = document.getElementById('task-list');
const taskCounter        = document.getElementById('task-counter');
const emptyState         = document.getElementById('empty-state');
const taskFooter         = document.getElementById('task-footer');
const clearCompletedBtn  = document.getElementById('clear-completed-btn');
const filterButtons      = document.querySelectorAll('.filter-btn');
const themeToggle        = document.getElementById('theme-toggle');
const errorBanner        = document.getElementById('error-banner');

/* ----- Estado de la aplicación ----- */

/**
 * @typedef {Object} Task
 * @property {number} id
 * @property {string} text
 * @property {boolean} completed
 * @property {'high'|'medium'|'low'} priority
 * @property {string} createdAt
 * @property {string|null} dueDate
 */

/** @type {Task[]} */
let tasks = [];

/** @type {'all' | 'pending' | 'completed'} */
let currentFilter = DEFAULT_FILTER;

/** ID de la tarea en edición (null si ninguna) */
let editingTaskId = null;

/** Indica si hay una petición en curso */
let isLoading = false;

/**
 * Caché de prioridades en memoria (la BD no persiste priority).
 * Mantiene el diseño visual durante la sesión actual.
 * @type {Map<number, string>}
 */
const priorityCache = new Map();

/* ============================================
   2. CLIENTE API (fetch)
   ============================================ */

/**
 * Realiza una petición HTTP a la API y maneja errores.
 * @param {string} url
 * @param {RequestInit} [options]
 * @returns {Promise<any>}
 */
async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Error del servidor (${response.status})`);
  }

  if (response.status === 204) return null;
  return response.json();
}

/**
 * Convierte el formato de la API (snake_case) al formato interno del frontend.
 * @param {Object} apiTask
 * @returns {Task}
 */
function mapApiTask(apiTask) {
  const cached = priorityCache.get(apiTask.id);
  const priority = cached && VALID_PRIORITIES.includes(cached) ? cached : DEFAULT_PRIORITY;

  return {
    id: apiTask.id,
    text: apiTask.text,
    completed: Boolean(apiTask.completed),
    priority,
    createdAt: apiTask.created_at,
    dueDate: isValidDueDate(apiTask.due_date) ? apiTask.due_date : null,
  };
}

/** Obtiene todas las tareas desde el servidor. */
async function fetchTasks() {
  const data = await apiRequest(API_URL);
  return data.map(mapApiTask);
}

/**
 * Crea una tarea en el servidor.
 * @param {Object} payload
 */
async function apiCreateTask(payload) {
  const data = await apiRequest(API_URL, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data;
}

/**
 * Actualiza una tarea en el servidor.
 * @param {number} id
 * @param {Object} payload
 */
async function apiUpdateTask(id, payload) {
  const data = await apiRequest(`${API_URL}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return mapApiTask(data);
}

/** Elimina una tarea del servidor. */
async function apiDeleteTask(id) {
  await apiRequest(`${API_URL}/${id}`, { method: 'DELETE' });
}

/** Muestra un mensaje de error temporal en la UI. */
function showError(message) {
  errorBanner.textContent = message;
  errorBanner.classList.remove('hidden');
}

/** Oculta el banner de error. */
function hideError() {
  errorBanner.classList.add('hidden');
  errorBanner.textContent = '';
}

/** Activa/desactiva controles mientras hay peticiones en curso. */
function setLoading(loading) {
  isLoading = loading;
  taskInput.disabled = loading;
  prioritySelect.disabled = loading;
  dueDateInput.disabled = loading;
  addTaskBtn.disabled = loading;
  clearCompletedBtn.disabled = loading;
}

/* ============================================
   3. OPERACIONES SOBRE TAREAS
   ============================================ */

/**
 * Recarga las tareas desde la API y actualiza la UI.
 */
async function reloadTasks() {
  tasks = await fetchTasks();
  render();
}

/**
 * Agrega una nueva tarea vía POST /tasks.
 */
async function addTask(text, priority, dueDate) {
  const trimmed = text.trim();
  if (!trimmed || isLoading) return;

  try {
    setLoading(true);
    hideError();

    const selectedPriority = VALID_PRIORITIES.includes(priority) ? priority : DEFAULT_PRIORITY;
    const created = await apiCreateTask({
      text: trimmed,
      due_date: isValidDueDate(dueDate) ? dueDate : null,
      completed: false,
    });

    priorityCache.set(created.id, selectedPriority);
    await reloadTasks();
    taskInput.value = '';
    dueDateInput.value = '';
    taskInput.focus();
  } catch (error) {
    showError(error.message);
  } finally {
    setLoading(false);
  }
}

/**
 * Actualiza el texto de una tarea vía PUT /tasks/:id.
 */
async function updateTaskText(id, newText) {
  const trimmed = newText.trim();
  if (!trimmed) return false;

  const task = tasks.find((t) => t.id === id);
  if (!task || task.text === trimmed) return false;

  try {
    hideError();
    await apiUpdateTask(id, { text: trimmed });
    await reloadTasks();
    return true;
  } catch (error) {
    showError(error.message);
    return false;
  }
}

/** Alterna el estado completado vía PUT /tasks/:id. */
async function toggleTask(id) {
  const task = tasks.find((t) => t.id === id);
  if (!task || isLoading) return;

  try {
    setLoading(true);
    hideError();
    await apiUpdateTask(id, { completed: !task.completed });
    await reloadTasks();
  } catch (error) {
    showError(error.message);
    render();
  } finally {
    setLoading(false);
  }
}

/**
 * Elimina una tarea con animación y DELETE /tasks/:id.
 */
async function deleteTask(id) {
  if (editingTaskId === id) editingTaskId = null;

  const listItem = taskList.querySelector(`[data-id="${id}"]`);

  const performDelete = async () => {
    try {
      hideError();
      await apiDeleteTask(id);
      await reloadTasks();
    } catch (error) {
      showError(error.message);
    }
  };

  if (listItem) {
    listItem.classList.add('task-item--leaving');
    listItem.addEventListener('animationend', () => performDelete(), { once: true });
  } else {
    await performDelete();
  }
}

/** Elimina todas las tareas completadas (varias peticiones DELETE). */
async function clearCompleted() {
  const completedTasks = tasks.filter((t) => t.completed);
  if (completedTasks.length === 0 || isLoading) return;

  const confirmed = window.confirm(
    `¿Eliminar ${completedTasks.length} tarea${completedTasks.length > 1 ? 's' : ''} completada${completedTasks.length > 1 ? 's' : ''}?`
  );
  if (!confirmed) return;

  try {
    setLoading(true);
    hideError();

    if (editingTaskId && completedTasks.some((t) => t.id === editingTaskId)) {
      editingTaskId = null;
    }

    await Promise.all(completedTasks.map((t) => apiDeleteTask(t.id)));
    await reloadTasks();
  } catch (error) {
    showError(error.message);
    await reloadTasks();
  } finally {
    setLoading(false);
  }
}

/** Cambia el filtro activo de visualización. */
function setFilter(filter) {
  currentFilter = filter;
  updateFilterUI();
  render();
}

/* ============================================
   4. FILTRADO, CONTADOR Y UTILIDADES
   ============================================ */

function getFilteredTasks() {
  let filtered;

  switch (currentFilter) {
    case 'pending':
      filtered = tasks.filter((t) => !t.completed);
      break;
    case 'completed':
      filtered = tasks.filter((t) => t.completed);
      break;
    default:
      filtered = tasks;
  }

  return sortByDueDate(filtered);
}

function isValidDueDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;

  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function parseDueDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function getTodayAtMidnight() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function isOverdue(task) {
  if (!task.dueDate || task.completed) return false;
  return parseDueDate(task.dueDate) < getTodayAtMidnight();
}

function isDueToday(task) {
  if (!task.dueDate || task.completed) return false;
  return parseDueDate(task.dueDate).getTime() === getTodayAtMidnight().getTime();
}

function sortByDueDate(taskList) {
  return [...taskList].sort((a, b) => {
    if (!a.dueDate && !b.dueDate) {
      return new Date(b.createdAt) - new Date(a.createdAt);
    }
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;

    const dateCompare = a.dueDate.localeCompare(b.dueDate);
    if (dateCompare !== 0) return dateCompare;

    return new Date(b.createdAt) - new Date(a.createdAt);
  });
}

function formatDueDate(dateStr) {
  const date = parseDueDate(dateStr);
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function formatCreatedAt(isoString) {
  const date = new Date(isoString);
  const now = new Date();

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) return 'Hoy';

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) return 'Ayer';

  return date.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function updateCounter() {
  const pending = tasks.filter((t) => !t.completed).length;
  const overdue = tasks.filter((t) => isOverdue(t)).length;
  const total   = tasks.length;

  if (isLoading && total === 0) {
    taskCounter.textContent = 'Cargando tareas...';
  } else if (total === 0) {
    taskCounter.textContent = 'Sin tareas — ¡empieza agregando una!';
  } else if (pending === 0) {
    taskCounter.textContent = '¡Todas las tareas completadas!';
  } else if (overdue > 0) {
    taskCounter.textContent = `${pending} pendiente${pending > 1 ? 's' : ''} · ${overdue} vencida${overdue > 1 ? 's' : ''}`;
  } else if (pending === 1) {
    taskCounter.textContent = '1 tarea pendiente';
  } else {
    taskCounter.textContent = `${pending} tareas pendientes`;
  }
}

function updateFooter() {
  const hasCompleted = tasks.some((t) => t.completed);
  taskFooter.classList.toggle('hidden', !hasCompleted);
}

function updateFilterUI() {
  filterButtons.forEach((btn) => {
    const isActive = btn.dataset.filter === currentFilter;
    btn.classList.toggle('filter-btn--active', isActive);
    btn.setAttribute('aria-selected', String(isActive));
  });
}

/* ============================================
   5. RENDERIZADO DEL DOM
   ============================================ */

function createPriorityBadge(priority) {
  const config = PRIORITY_CONFIG[priority];
  const badge = document.createElement('span');
  badge.className = `priority-badge priority-badge--${config.cssClass}`;
  badge.textContent = config.label;
  return badge;
}

function createDueDateLabel(task) {
  if (!task.dueDate) return null;

  const overdue = isOverdue(task);
  const dueToday = isDueToday(task);

  const label = document.createElement('span');
  label.className = 'task-due-date';
  if (overdue) label.classList.add('task-due-date--overdue');
  else if (dueToday) label.classList.add('task-due-date--today');

  const prefix = overdue ? 'Vencida:' : dueToday ? 'Vence hoy:' : 'Vence:';

  label.innerHTML = `
    <svg class="task-due-date__icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
    </svg>
    ${prefix} ${formatDueDate(task.dueDate)}
  `;

  return label;
}

function createActionButtons(task) {
  const actions = document.createElement('div');
  actions.className = 'task-actions';

  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'action-btn action-btn--edit';
  editBtn.setAttribute('aria-label', `Editar "${task.text}"`);
  editBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
    </svg>
  `;
  editBtn.addEventListener('click', () => startEditing(task.id));

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'action-btn action-btn--delete';
  deleteBtn.setAttribute('aria-label', `Eliminar "${task.text}"`);
  deleteBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
    </svg>
  `;
  deleteBtn.addEventListener('click', () => deleteTask(task.id));

  actions.append(editBtn, deleteBtn);
  return actions;
}

function createTaskContent(task) {
  const content = document.createElement('div');
  content.className = 'task-content';

  const isEditing = editingTaskId === task.id;

  if (isEditing) {
    const editInput = document.createElement('input');
    editInput.type = 'text';
    editInput.className = 'task-edit-input';
    editInput.value = task.text;
    editInput.maxLength = 200;
    editInput.setAttribute('aria-label', 'Editar texto de la tarea');

    editInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        finishEditing(task.id, editInput.value);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        cancelEditing();
      }
    });

    editInput.addEventListener('blur', () => {
      finishEditing(task.id, editInput.value);
    });

    content.appendChild(editInput);

    requestAnimationFrame(() => {
      editInput.focus();
      editInput.select();
    });
  } else {
    const textSpan = document.createElement('span');
    textSpan.className = `task-text ${task.completed ? 'task-text--completed' : ''}`;
    textSpan.textContent = task.text;
    textSpan.title = 'Doble clic para editar';
    textSpan.addEventListener('dblclick', () => startEditing(task.id));
    content.appendChild(textSpan);
  }

  const meta = document.createElement('div');
  meta.className = 'task-meta';
  meta.appendChild(createPriorityBadge(task.priority));

  const dueDateLabel = createDueDateLabel(task);
  if (dueDateLabel) meta.appendChild(dueDateLabel);

  meta.appendChild(
    Object.assign(document.createElement('span'), {
      className: 'task-date',
      textContent: `Creada: ${formatCreatedAt(task.createdAt)}`,
    })
  );

  content.appendChild(meta);
  return content;
}

function createTaskElement(task) {
  const config = PRIORITY_CONFIG[task.priority];
  const li = document.createElement('li');
  li.className = `task-item task-item--entering task-item--priority-${config.cssClass}`;

  if (isOverdue(task)) {
    li.classList.add('task-item--overdue');
  }

  li.dataset.id = String(task.id);

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'task-checkbox';
  checkbox.checked = task.completed;
  checkbox.disabled = isLoading;
  checkbox.setAttribute('aria-label', `Marcar "${task.text}" como completada`);
  checkbox.addEventListener('change', () => toggleTask(task.id));

  li.append(checkbox, createTaskContent(task), createActionButtons(task));
  return li;
}

function render() {
  const filtered = getFilteredTasks();

  taskList.innerHTML = '';

  filtered.forEach((task) => {
    taskList.appendChild(createTaskElement(task));
  });

  const isEmpty = filtered.length === 0;
  emptyState.classList.toggle('hidden', !isEmpty);
  taskList.classList.toggle('hidden', isEmpty);

  updateCounter();
  updateFooter();
}

/* ============================================
   6. EDICIÓN INLINE
   ============================================ */

function startEditing(id) {
  editingTaskId = id;
  render();
}

async function finishEditing(id, newText) {
  const trimmed = newText.trim();

  if (!trimmed) {
    cancelEditing();
    return;
  }

  const task = tasks.find((t) => t.id === id);
  if (!task || task.text === trimmed) {
    editingTaskId = null;
    render();
    return;
  }

  editingTaskId = null;
  const success = await updateTaskText(id, trimmed);

  if (!success) {
    render();
  }
}

function cancelEditing() {
  editingTaskId = null;
  render();
}

/* ============================================
   7. TEMA CLARO / OSCURO
   ============================================ */

function getTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_STORAGE_KEY, theme);

  const isDark = theme === 'dark';
  themeToggle.setAttribute('aria-label', isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
  themeToggle.title = isDark ? 'Modo claro' : 'Modo oscuro';
}

function toggleTheme() {
  setTheme(getTheme() === 'dark' ? 'light' : 'dark');
}

function initTheme() {
  setTheme(getTheme());
}

/* ============================================
   8. MANEJO DE EVENTOS E INICIALIZACIÓN
   ============================================ */

addTaskForm.addEventListener('submit', (event) => {
  event.preventDefault();
  addTask(taskInput.value, prioritySelect.value, dueDateInput.value);
});

filterButtons.forEach((btn) => {
  btn.addEventListener('click', () => setFilter(btn.dataset.filter));
});

clearCompletedBtn.addEventListener('click', clearCompleted);
themeToggle.addEventListener('click', toggleTheme);

/** Arranca la aplicación: carga tareas desde la API. */
async function init() {
  initTheme();
  updateFilterUI();

  try {
    setLoading(true);
    await reloadTasks();
    taskInput.focus();
  } catch (error) {
    showError(`No se pudo conectar con el servidor: ${error.message}`);
    taskCounter.textContent = 'Error al cargar tareas';
  } finally {
    setLoading(false);
  }
}

init();