/**
 * ============================================
 * TaskFlow — Tablero Kanban
 * ============================================
 */

const API_TASKS = '/api/tasks';
const API_PROJECTS = '/api/projects';
const THEME_STORAGE_KEY = 'mi-todo-app-theme';
const PROJECT_STORAGE_KEY = 'mi-todo-app-active-project';

const DEFAULT_PRIORITY = 'medium';
const DEFAULT_STATUS = 'todo';

const COLUMNS = [
  { id: 'todo', label: 'Por Hacer', color: '#6366f1', icon: '○' },
  { id: 'in_progress', label: 'En Progreso', color: '#f59e0b', icon: '◐' },
  { id: 'done', label: 'Terminada', color: '#10b981', icon: '●' },
];

const PRIORITY_CONFIG = {
  high:   { label: 'Alta',  cssClass: 'high' },
  medium: { label: 'Media', cssClass: 'medium' },
  low:    { label: 'Baja',  cssClass: 'low' },
};

const VALID_PRIORITIES = Object.keys(PRIORITY_CONFIG);
const VALID_STATUSES = COLUMNS.map((c) => c.id);

const STATUS_INDEX = { todo: 0, in_progress: 1, done: 2 };

const PROJECT_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#64748b'];

/* ----- DOM ----- */

const sidebar            = document.getElementById('sidebar');
const sidebarOverlay     = document.getElementById('sidebar-overlay');
const sidebarOpen        = document.getElementById('sidebar-open');
const sidebarClose       = document.getElementById('sidebar-close');
const projectList        = document.getElementById('project-list');
const addProjectForm     = document.getElementById('add-project-form');
const projectNameInput   = document.getElementById('project-name-input');
const projectTitle       = document.getElementById('project-title');
const projectColorDot    = document.getElementById('project-color-dot');
const renameProjectBtn   = document.getElementById('rename-project-btn');
const deleteProjectBtn   = document.getElementById('delete-project-btn');
const addTaskBtn         = document.getElementById('add-task-btn');
const kanbanBoard        = document.getElementById('kanban-board');
const taskCounter        = document.getElementById('task-counter');
const themeToggle        = document.getElementById('theme-toggle');
const errorBanner        = document.getElementById('error-banner');

const taskModal          = document.getElementById('task-modal');
const modalBackdrop      = document.getElementById('modal-backdrop');
const modalClose         = document.getElementById('modal-close');
const modalCancel        = document.getElementById('modal-cancel-btn');
const modalDelete        = document.getElementById('modal-delete-btn');
const taskForm           = document.getElementById('task-form');
const modalTitle         = document.getElementById('modal-title');
const modalTitleInput    = document.getElementById('modal-title-input');
const modalProjectSelect = document.getElementById('modal-project-select');
const modalDescription   = document.getElementById('modal-description-input');
const modalPriority      = document.getElementById('modal-priority-select');
const modalStatus        = document.getElementById('modal-status-select');
const modalDueDate       = document.getElementById('modal-due-date-input');
const modalSaveBtn       = document.getElementById('modal-save-btn');

/* ----- Estado ----- */

/** @type {Array<{id:number,name:string,color:string,taskCount:number,pendingCount:number}>} */
let projects = [];

/** @type {Array<{id:number,text:string,description:string,priority:string,status:string,completed:boolean,createdAt:string,dueDate:string|null,projectId:number}>} */
let tasks = [];

let activeProjectId = null;
let editingProjectId = null;
let editingTaskId = null;
let isLoading = false;
let colorIndex = 0;
let draggedTaskId = null;
let didDrag = false;
let suppressProjectClick = false;

const DRAG_MIME = 'application/x-taskflow-task';

/* ============================================
   API
   ============================================ */

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

function mapApiProject(p) {
  return {
    id: p.id,
    name: p.name,
    color: p.color,
    taskCount: p.task_count ?? 0,
    pendingCount: p.pending_count ?? 0,
    createdAt: p.created_at,
  };
}

function mapApiTask(apiTask) {
  return {
    id: apiTask.id,
    text: apiTask.text,
    description: apiTask.description || '',
    priority: VALID_PRIORITIES.includes(apiTask.priority) ? apiTask.priority : DEFAULT_PRIORITY,
    status: VALID_STATUSES.includes(apiTask.status) ? apiTask.status : DEFAULT_STATUS,
    completed: Boolean(apiTask.completed),
    createdAt: apiTask.created_at,
    dueDate: isValidDueDate(apiTask.due_date) ? apiTask.due_date : null,
    projectId: apiTask.project_id,
  };
}

async function fetchProjects() {
  return (await apiRequest(API_PROJECTS)).map(mapApiProject);
}

async function fetchTasks(projectId) {
  return (await apiRequest(`${API_TASKS}?project_id=${projectId}`)).map(mapApiTask);
}

function showError(message) {
  errorBanner.textContent = message;
  errorBanner.classList.remove('hidden');
}

function hideError() {
  errorBanner.classList.add('hidden');
  errorBanner.textContent = '';
}

function setLoading(loading) {
  isLoading = loading;
  addTaskBtn.disabled = loading || !activeProjectId;
  projectNameInput.disabled = loading;
  modalSaveBtn.disabled = loading;
}

/* ============================================
   PROYECTOS
   ============================================ */

function getActiveProject() {
  return projects.find((p) => p.id === activeProjectId) ?? null;
}

function nextProjectColor() {
  const color = PROJECT_COLORS[colorIndex % PROJECT_COLORS.length];
  colorIndex += 1;
  return color;
}

async function reloadProjects() {
  projects = await fetchProjects();
  renderProjects();
  populateProjectSelect();

  if (projects.length === 0) return;

  const stored = Number(localStorage.getItem(PROJECT_STORAGE_KEY));
  const exists = projects.some((p) => p.id === stored);

  if (!activeProjectId || !projects.some((p) => p.id === activeProjectId)) {
    activeProjectId = exists ? stored : projects[0].id;
    localStorage.setItem(PROJECT_STORAGE_KEY, String(activeProjectId));
  }

  updateProjectHeader();
}

async function selectProject(id) {
  if (activeProjectId === id) {
    closeSidebar();
    return;
  }

  activeProjectId = id;
  editingProjectId = null;
  localStorage.setItem(PROJECT_STORAGE_KEY, String(id));
  updateProjectHeader();
  closeSidebar();

  try {
    setLoading(true);
    hideError();
    tasks = await fetchTasks(id);
    renderBoard();
  } catch (error) {
    showError(error.message);
  } finally {
    setLoading(false);
  }
}

async function createProject(name) {
  const trimmed = name.trim();
  if (!trimmed || isLoading) return;

  try {
    setLoading(true);
    hideError();

    const created = await apiRequest(API_PROJECTS, {
      method: 'POST',
      body: JSON.stringify({ name: trimmed, color: nextProjectColor() }),
    });

    await reloadProjects();
    activeProjectId = created.id;
    localStorage.setItem(PROJECT_STORAGE_KEY, String(created.id));
    projectNameInput.value = '';
    await selectProject(created.id);
  } catch (error) {
    showError(error.message);
  } finally {
    setLoading(false);
  }
}

async function renameProject(id, newName) {
  const trimmed = newName.trim();
  if (!trimmed) return false;

  const project = projects.find((p) => p.id === id);
  if (!project || project.name === trimmed) return false;

  try {
    hideError();
    await apiRequest(`${API_PROJECTS}/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name: trimmed }),
    });
    await reloadProjects();
    updateProjectHeader();
    return true;
  } catch (error) {
    showError(error.message);
    return false;
  }
}

async function deleteProject(id) {
  const project = projects.find((p) => p.id === id);
  if (!project || isLoading) return;

  if (projects.length <= 1) {
    showError('No puedes eliminar el último proyecto.');
    return;
  }

  const confirmed = window.confirm(
    `¿Eliminar el proyecto "${project.name}" y todas sus tareas?`
  );
  if (!confirmed) return;

  try {
    setLoading(true);
    hideError();
    await apiRequest(`${API_PROJECTS}/${id}`, { method: 'DELETE' });

    if (activeProjectId === id) activeProjectId = null;
    editingProjectId = null;
    closeModal();

    await reloadProjects();
    if (activeProjectId) {
      tasks = await fetchTasks(activeProjectId);
    } else {
      tasks = [];
    }
    renderBoard();
  } catch (error) {
    showError(error.message);
  } finally {
    setLoading(false);
  }
}

function updateProjectHeader() {
  const project = getActiveProject();

  if (!project) {
    projectTitle.textContent = 'Sin proyectos';
    projectColorDot.style.background = '#94a3b8';
    return;
  }

  projectTitle.textContent = project.name;
  projectColorDot.style.background = project.color;
}

function populateProjectSelect() {
  modalProjectSelect.innerHTML = '';
  projects.forEach((p) => {
    const opt = document.createElement('option');
    opt.value = String(p.id);
    opt.textContent = p.name;
    modalProjectSelect.appendChild(opt);
  });
}

function renderProjects() {
  projectList.innerHTML = '';

  projects.forEach((project) => {
    const li = document.createElement('li');
    const isActive = project.id === activeProjectId;
    const isEditing = editingProjectId === project.id;

    if (isEditing) {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'project-edit-input';
      input.value = project.name;
      input.maxLength = 50;

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); finishProjectEdit(project.id, input.value); }
        if (e.key === 'Escape') { e.preventDefault(); cancelProjectEdit(); }
      });
      input.addEventListener('blur', () => finishProjectEdit(project.id, input.value));

      li.appendChild(input);
      projectList.appendChild(li);
      requestAnimationFrame(() => { input.focus(); input.select(); });
      return;
    }

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `project-item${isActive ? ' project-item--active' : ''}`;
    btn.dataset.projectId = String(project.id);
    btn.innerHTML = `
      <span class="project-item__dot" style="background:${project.color}"></span>
      <span class="project-item__name">${escapeHtml(project.name)}</span>
      <span class="project-item__count">${project.pendingCount || project.taskCount}</span>
    `;
    btn.addEventListener('click', () => {
      if (suppressProjectClick || didDrag) return;
      selectProject(project.id);
    });
    btn.addEventListener('dblclick', (e) => {
      e.preventDefault();
      startProjectEdit(project.id);
    });

    btn.addEventListener('dragover', (e) => {
      if (!isTaskDragEvent(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      btn.classList.add('project-item--drag-over');
    });

    btn.addEventListener('dragleave', (e) => {
      if (!btn.contains(e.relatedTarget)) {
        btn.classList.remove('project-item--drag-over');
      }
    });

    btn.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      btn.classList.remove('project-item--drag-over');

      const payload = getDragPayload(e);
      if (!payload) return;

      const targetProjectId = project.id;
      if (payload.projectId === targetProjectId) return;

      suppressProjectClick = true;
      setTimeout(() => { suppressProjectClick = false; }, 300);

      await moveTask(payload.taskId, { projectId: targetProjectId });
    });

    li.appendChild(btn);
    projectList.appendChild(li);
  });
}

function startProjectEdit(id) {
  editingProjectId = id;
  renderProjects();
}

async function finishProjectEdit(id, newName) {
  const trimmed = newName.trim();
  const project = projects.find((p) => p.id === id);

  editingProjectId = null;

  if (!trimmed || !project || project.name === trimmed) {
    renderProjects();
    return;
  }

  await renameProject(id, trimmed);
  renderProjects();
}

function cancelProjectEdit() {
  editingProjectId = null;
  renderProjects();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ============================================
   TAREAS
   ============================================ */

async function reloadTasks() {
  if (!activeProjectId) { tasks = []; renderBoard(); return; }
  tasks = await fetchTasks(activeProjectId);
  await reloadProjects();
  renderBoard();
}

async function saveTask(data) {
  const payload = {
    text: data.text.trim(),
    description: data.description.trim(),
    priority: data.priority,
    status: data.status,
    due_date: isValidDueDate(data.dueDate) ? data.dueDate : null,
    project_id: Number(data.projectId),
  };

  if (!payload.text) throw new Error('El título es obligatorio.');

  if (data.id) {
    return apiRequest(`${API_TASKS}/${data.id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  return apiRequest(API_TASKS, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

function getDragPayload(event) {
  try {
    const raw = event.dataTransfer.getData(DRAG_MIME);
    if (raw) return JSON.parse(raw);
  } catch { /* fallback abajo */ }

  const taskId = Number(event.dataTransfer.getData('text/plain') || draggedTaskId);
  if (!taskId) return null;

  const task = tasks.find((t) => t.id === taskId);
  return task
    ? { taskId: task.id, status: task.status, projectId: task.projectId }
    : { taskId, status: DEFAULT_STATUS, projectId: activeProjectId };
}

function setDragPayload(event, task) {
  const payload = { taskId: task.id, status: task.status, projectId: task.projectId };
  event.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload));
  event.dataTransfer.setData('text/plain', String(task.id));
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.dropEffect = 'move';
}

function isTaskDragEvent(event) {
  if (draggedTaskId) return true;
  const types = event.dataTransfer?.types;
  if (!types || types.length === 0) return false;
  for (let i = 0; i < types.length; i += 1) {
    if (types[i] === 'text/plain' || types[i] === DRAG_MIME) return true;
  }
  return false;
}

function clearDragHighlights() {
  document.querySelectorAll('.kanban-column__body--drag-over').forEach((el) => {
    el.classList.remove('kanban-column__body--drag-over');
  });
  document.querySelectorAll('.project-item--drag-over').forEach((el) => {
    el.classList.remove('project-item--drag-over');
  });
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function captureCardPositions() {
  const positions = new Map();
  document.querySelectorAll('.kanban-card[data-id]').forEach((card) => {
    positions.set(card.dataset.id, card.getBoundingClientRect());
  });
  return positions;
}

function getMoveDirection(fromStatus, toStatus) {
  const from = STATUS_INDEX[fromStatus] ?? 0;
  const to = STATUS_INDEX[toStatus] ?? 0;
  if (to > from) return 'forward';
  if (to < from) return 'backward';
  return 'none';
}

function pulseColumn(status) {
  const col = document.querySelector(`.kanban-column--${status}`);
  if (!col) return;

  col.classList.add('kanban-column--receive');
  col.addEventListener('animationend', () => col.classList.remove('kanban-column--receive'), { once: true });

  const count = col.querySelector('.kanban-column__count');
  if (count) {
    count.classList.add('kanban-column__count--pulse');
    count.addEventListener('animationend', () => count.classList.remove('kanban-column__count--pulse'), { once: true });
  }
}

function pulseProject(projectId) {
  const btn = document.querySelector(`.project-item[data-project-id="${projectId}"]`);
  if (!btn) return;

  btn.classList.add('project-item--receive');
  btn.addEventListener('animationend', () => btn.classList.remove('project-item--receive'), { once: true });
}

function runMoveAnimations(beforePositions, { movedTaskId, fromStatus, toStatus }) {
  if (prefersReducedMotion() || !beforePositions) return;

  const movedId = String(movedTaskId);
  const direction = getMoveDirection(fromStatus, toStatus);
  const enterClass = direction === 'backward' ? 'kanban-card--enter-back' : 'kanban-card--enter-forward';

  document.querySelectorAll('.kanban-card[data-id]').forEach((card) => {
    const id = card.dataset.id;

    if (id === movedId) {
      card.classList.add(enterClass);
      card.addEventListener('animationend', () => card.classList.remove(enterClass), { once: true });
      return;
    }

    const before = beforePositions.get(id);
    if (!before) return;

    const after = card.getBoundingClientRect();
    const dx = before.left - after.left;
    const dy = before.top - after.top;
    if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;

    card.classList.add('kanban-card--flip');
    card.style.transform = `translate(${dx}px, ${dy}px)`;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        card.style.transform = 'translate(0, 0)';
      });
    });

    const cleanup = () => {
      card.classList.remove('kanban-card--flip');
      card.style.transform = '';
    };
    card.addEventListener('transitionend', cleanup, { once: true });
    setTimeout(cleanup, 500);
  });

  if (toStatus) pulseColumn(toStatus);
}

function animateCardSpawn(taskId) {
  if (prefersReducedMotion()) return;

  requestAnimationFrame(() => {
    const card = document.querySelector(`.kanban-card[data-id="${taskId}"]`);
    if (!card) return;
    card.classList.add('kanban-card--spawn');
    card.addEventListener('animationend', () => card.classList.remove('kanban-card--spawn'), { once: true });
    pulseColumn(card.closest('.kanban-column')?.dataset.status);
  });
}

function animateCardExit(taskId) {
  if (prefersReducedMotion()) return Promise.resolve();

  const card = document.querySelector(`.kanban-card[data-id="${taskId}"]`);
  if (!card) return Promise.resolve();

  return new Promise((resolve) => {
    const done = () => resolve();
    card.classList.add('kanban-card--exit');
    card.addEventListener('animationend', done, { once: true });
    setTimeout(done, 320);
  });
}

async function moveTask(id, { status, projectId }, optimistic = true) {
  const task = tasks.find((t) => t.id === id);
  if (!task || isLoading) return false;

  const newStatus = status ?? task.status;
  const newProjectId = projectId ?? task.projectId;

  if (task.status === newStatus && task.projectId === newProjectId) return false;

  const payload = {};
  if (newStatus !== task.status) payload.status = newStatus;
  if (newProjectId !== task.projectId) payload.project_id = newProjectId;

  const snapshot = { ...task };
  const fromStatus = task.status;
  const isColumnMove = newProjectId === activeProjectId && newStatus !== fromStatus;
  const isProjectMove = newProjectId !== activeProjectId && snapshot.projectId === activeProjectId;

  if (optimistic) {
    const beforePositions = isColumnMove ? captureCardPositions() : null;

    if (isProjectMove) {
      await animateCardExit(id);
    }

    task.status = newStatus;
    task.completed = newStatus === 'done';
    task.projectId = newProjectId;
    if (newProjectId !== activeProjectId) {
      tasks = tasks.filter((t) => t.id !== id);
    }
    renderBoard();
    renderProjects();

    if (isColumnMove && beforePositions) {
      requestAnimationFrame(() => {
        runMoveAnimations(beforePositions, {
          movedTaskId: id,
          fromStatus,
          toStatus: newStatus,
        });
      });
    }

    if (isProjectMove) {
      pulseProject(newProjectId);
    }
  }

  try {
    hideError();
    await apiRequest(`${API_TASKS}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    await reloadProjects();
    if (newProjectId === activeProjectId) {
      tasks = await fetchTasks(activeProjectId);
      renderBoard();
    }
    return true;
  } catch (error) {
    if (optimistic) {
      if (snapshot.projectId === activeProjectId && newProjectId !== activeProjectId) {
        tasks.push(snapshot);
        tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      } else {
        Object.assign(task, snapshot);
      }
      renderBoard();
      renderProjects();
    }
    showError(error.message);
    return false;
  }
}

async function deleteTask(id) {
  try {
    hideError();
    await apiRequest(`${API_TASKS}/${id}`, { method: 'DELETE' });
    closeModal();
    await reloadTasks();
  } catch (error) {
    showError(error.message);
  }
}

async function clearDoneTasks() {
  const doneTasks = tasks.filter((t) => t.status === 'done');
  if (doneTasks.length === 0 || isLoading || !activeProjectId) return;

  const confirmed = window.confirm(
    `¿Eliminar ${doneTasks.length} tarea${doneTasks.length > 1 ? 's' : ''} terminada${doneTasks.length > 1 ? 's' : ''}?`
  );
  if (!confirmed) return;

  try {
    setLoading(true);
    hideError();
    await apiRequest(`${API_TASKS}/done/bulk?project_id=${activeProjectId}`, { method: 'DELETE' });
    await reloadTasks();
  } catch (error) {
    showError(error.message);
  } finally {
    setLoading(false);
  }
}

function getTasksByStatus(status) {
  return tasks.filter((t) => t.status === status);
}

/* ============================================
   MODAL
   ============================================ */

function openModal(taskId = null, defaultStatus = DEFAULT_STATUS) {
  editingTaskId = taskId;
  hideError();

  if (taskId) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    modalTitle.textContent = 'Editar tarea';
    modalTitleInput.value = task.text;
    modalDescription.value = task.description;
    modalPriority.value = task.priority;
    modalStatus.value = task.status;
    modalDueDate.value = task.dueDate || '';
    modalProjectSelect.value = String(task.projectId);
    modalDelete.classList.remove('hidden');
  } else {
    modalTitle.textContent = 'Nueva tarea';
    modalTitleInput.value = '';
    modalDescription.value = '';
    modalPriority.value = DEFAULT_PRIORITY;
    modalStatus.value = defaultStatus;
    modalDueDate.value = '';
    modalProjectSelect.value = String(activeProjectId || projects[0]?.id || '');
    modalDelete.classList.add('hidden');
  }

  taskModal.classList.remove('hidden');
  document.body.classList.add('modal-open');
  requestAnimationFrame(() => modalTitleInput.focus());
}

function closeModal() {
  editingTaskId = null;
  taskModal.classList.add('hidden');
  document.body.classList.remove('modal-open');
  taskForm.reset();
}

async function handleModalSubmit(e) {
  e.preventDefault();
  if (isLoading) return;

  try {
    setLoading(true);
    hideError();

    const existingTask = editingTaskId ? tasks.find((t) => t.id === editingTaskId) : null;
    const newStatus = modalStatus.value;
    const savedProjectId = Number(modalProjectSelect.value);
    const beforePositions = existingTask
      && savedProjectId === activeProjectId
      && existingTask.status !== newStatus
      ? captureCardPositions()
      : null;

    const saved = await saveTask({
      id: editingTaskId,
      text: modalTitleInput.value,
      description: modalDescription.value,
      priority: modalPriority.value,
      status: newStatus,
      dueDate: modalDueDate.value,
      projectId: modalProjectSelect.value,
    });

    closeModal();

    if (savedProjectId !== activeProjectId) {
      await selectProject(savedProjectId);
    } else if (!editingTaskId) {
      await reloadTasks();
      animateCardSpawn(saved.id);
    } else {
      await reloadTasks();
      if (beforePositions && existingTask) {
        requestAnimationFrame(() => {
          runMoveAnimations(beforePositions, {
            movedTaskId: editingTaskId,
            fromStatus: existingTask.status,
            toStatus: newStatus,
          });
        });
      }
    }
  } catch (error) {
    showError(error.message);
  } finally {
    setLoading(false);
  }
}

/* ============================================
   UTILIDADES
   ============================================ */

function isValidDueDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
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
  if (!task.dueDate || task.status === 'done') return false;
  return parseDueDate(task.dueDate) < getTodayAtMidnight();
}

function isDueToday(task) {
  if (!task.dueDate || task.status === 'done') return false;
  return parseDueDate(task.dueDate).getTime() === getTodayAtMidnight().getTime();
}

function formatDueDate(dateStr) {
  const date = parseDueDate(dateStr);
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function updateCounter() {
  const pending = tasks.filter((t) => t.status !== 'done').length;
  const overdue = tasks.filter((t) => isOverdue(t)).length;
  const total = tasks.length;
  const project = getActiveProject();

  if (!project) {
    taskCounter.textContent = 'Crea un proyecto para empezar';
  } else if (isLoading && total === 0) {
    taskCounter.textContent = 'Cargando tareas...';
  } else if (total === 0) {
    taskCounter.textContent = 'Proyecto vacío — crea tu primera tarea';
  } else if (pending === 0) {
    taskCounter.textContent = '¡Todas las tareas terminadas!';
  } else if (overdue > 0) {
    taskCounter.textContent = `${pending} activa${pending > 1 ? 's' : ''} · ${overdue} vencida${overdue > 1 ? 's' : ''}`;
  } else if (pending === 1) {
    taskCounter.textContent = '1 tarea activa';
  } else {
    taskCounter.textContent = `${pending} tareas activas`;
  }
}

/* ============================================
   KANBAN — RENDERIZADO
   ============================================ */

function createPriorityBadge(priority) {
  const config = PRIORITY_CONFIG[priority];
  const badge = document.createElement('span');
  badge.className = `priority-badge priority-badge--${config.cssClass}`;
  badge.textContent = config.label;
  return badge;
}

function createKanbanCard(task) {
  const config = PRIORITY_CONFIG[task.priority];
  const card = document.createElement('article');
  card.className = `kanban-card kanban-card--priority-${config.cssClass}`;
  if (isOverdue(task)) card.classList.add('kanban-card--overdue');
  if (task.status === 'done') card.classList.add('kanban-card--done');
  card.dataset.id = String(task.id);
  card.draggable = !isLoading;

  const handle = document.createElement('div');
  handle.className = 'kanban-card__handle';
  handle.setAttribute('role', 'button');
  handle.setAttribute('tabindex', '0');
  handle.setAttribute('aria-label', `Mover tarea: ${task.text}`);
  handle.title = 'Arrastrar para mover';
  handle.innerHTML = `
    <svg class="kanban-card__grip" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="9" cy="7" r="1.5"/><circle cx="15" cy="7" r="1.5"/>
      <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
      <circle cx="9" cy="17" r="1.5"/><circle cx="15" cy="17" r="1.5"/>
    </svg>
  `;

  const content = document.createElement('div');
  content.className = 'kanban-card__content';
  content.setAttribute('role', 'button');
  content.setAttribute('tabindex', '0');
  content.setAttribute('aria-label', `Editar tarea: ${task.text}`);

  const title = document.createElement('h4');
  title.className = 'kanban-card__title';
  title.textContent = task.text;
  content.appendChild(title);

  if (task.description) {
    const desc = document.createElement('p');
    desc.className = 'kanban-card__description';
    desc.textContent = task.description;
    content.appendChild(desc);
  }

  const meta = document.createElement('div');
  meta.className = 'kanban-card__meta';
  meta.appendChild(createPriorityBadge(task.priority));

  if (task.dueDate) {
    const due = document.createElement('span');
    due.className = 'task-due-date';
    if (isOverdue(task)) due.classList.add('task-due-date--overdue');
    else if (isDueToday(task)) due.classList.add('task-due-date--today');
    due.innerHTML = `
      <svg class="task-due-date__icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
      </svg>
      ${formatDueDate(task.dueDate)}
    `;
    meta.appendChild(due);
  }

  content.appendChild(meta);
  card.append(handle, content);

  const openTask = () => {
    if (didDrag) return;
    openModal(task.id);
  };

  content.addEventListener('click', openTask);
  content.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openTask();
    }
  });

  handle.addEventListener('click', (e) => e.stopPropagation());

  handle.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') e.preventDefault();
  });

  card.addEventListener('dragstart', (e) => {
    if (isLoading || !e.target.closest('.kanban-card__handle')) {
      e.preventDefault();
      return;
    }

    didDrag = true;
    draggedTaskId = task.id;
    card.classList.add('kanban-card--dragging');
    setDragPayload(e, task);

    projectList.classList.add('project-list--drag-active');

    if (window.innerWidth <= 768) {
      sidebar.classList.add('sidebar--open');
      sidebarOverlay.classList.remove('hidden');
    }
  });

  card.addEventListener('dragend', () => {
    card.classList.remove('kanban-card--dragging');
    draggedTaskId = null;
    projectList.classList.remove('project-list--drag-active');
    clearDragHighlights();
    setTimeout(() => { didDrag = false; }, 0);
  });

  return card;
}

function createKanbanColumn(column) {
  const columnTasks = getTasksByStatus(column.id);

  const col = document.createElement('section');
  col.className = `kanban-column kanban-column--${column.id}`;
  col.dataset.status = column.id;
  col.setAttribute('aria-label', column.label);

  const header = document.createElement('header');
  header.className = 'kanban-column__header';
  header.innerHTML = `
    <div class="kanban-column__title-row">
      <span class="kanban-column__indicator" style="background:${column.color}"></span>
      <h3 class="kanban-column__title">${column.label}</h3>
      <span class="kanban-column__count">${columnTasks.length}</span>
    </div>
  `;

  if (column.id === 'todo') {
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'kanban-column__add';
    addBtn.setAttribute('aria-label', 'Agregar tarea');
    addBtn.title = 'Agregar tarea';
    addBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>`;
    addBtn.addEventListener('click', () => openModal(null, 'todo'));
    header.appendChild(addBtn);
  }

  if (column.id === 'done' && columnTasks.length > 0) {
    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'kanban-column__clear';
    clearBtn.title = 'Limpiar terminadas';
    clearBtn.setAttribute('aria-label', 'Limpiar tareas terminadas');
    clearBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>`;
    clearBtn.addEventListener('click', clearDoneTasks);
    header.appendChild(clearBtn);
  }

  const body = document.createElement('div');
  body.className = 'kanban-column__body';
  body.dataset.status = column.id;

  const highlightColumn = () => body.classList.add('kanban-column__body--drag-over');
  const unhighlightColumn = () => body.classList.remove('kanban-column__body--drag-over');

  const handleColumnDragOver = (e) => {
    if (!isTaskDragEvent(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    highlightColumn();
  };

  const handleColumnDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    unhighlightColumn();

    const payload = getDragPayload(e);
    if (!payload) return;

    await moveTask(payload.taskId, { status: column.id });
  };

  col.addEventListener('dragover', handleColumnDragOver);
  col.addEventListener('dragleave', (e) => {
    if (!col.contains(e.relatedTarget)) unhighlightColumn();
  });
  col.addEventListener('drop', handleColumnDrop);

  if (columnTasks.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'kanban-column__empty';
    empty.textContent = column.id === 'todo' ? 'Arrastra tareas aquí o crea una nueva' : 'Sin tareas';
    body.appendChild(empty);
  } else {
    columnTasks.forEach((task) => body.appendChild(createKanbanCard(task)));
  }

  col.append(header, body);
  return col;
}

function renderBoard() {
  kanbanBoard.innerHTML = '';

  if (!activeProjectId) {
    const empty = document.createElement('div');
    empty.className = 'kanban-empty';
    empty.innerHTML = `
      <div class="empty-state__icon">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7"/>
        </svg>
      </div>
      <p class="empty-state__title">Crea un proyecto para empezar</p>
      <p class="empty-state__subtitle">Usa el panel lateral para organizar tus tareas</p>
    `;
    kanbanBoard.appendChild(empty);
    updateCounter();
    return;
  }

  COLUMNS.forEach((col) => kanbanBoard.appendChild(createKanbanColumn(col)));
  updateCounter();
}

/* ============================================
   SIDEBAR Y TEMA
   ============================================ */

function openSidebar() {
  sidebar.classList.add('sidebar--open');
  sidebarOverlay.classList.remove('hidden');
}

function closeSidebar() {
  sidebar.classList.remove('sidebar--open');
  sidebarOverlay.classList.add('hidden');
}

function getTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  const isDark = theme === 'dark';
  themeToggle.setAttribute('aria-label', isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
}

function toggleTheme() {
  setTheme(getTheme() === 'dark' ? 'light' : 'dark');
}

/* ============================================
   EVENTOS E INICIO
   ============================================ */

addProjectForm.addEventListener('submit', (e) => {
  e.preventDefault();
  createProject(projectNameInput.value);
});

addTaskBtn.addEventListener('click', () => openModal(null, DEFAULT_STATUS));
taskForm.addEventListener('submit', handleModalSubmit);
modalClose.addEventListener('click', closeModal);
modalCancel.addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', closeModal);
modalDelete.addEventListener('click', () => {
  if (editingTaskId && window.confirm('¿Eliminar esta tarea?')) {
    deleteTask(editingTaskId);
  }
});

renameProjectBtn.addEventListener('click', () => {
  if (!activeProjectId) return;
  if (window.innerWidth <= 768) openSidebar();
  startProjectEdit(activeProjectId);
});

deleteProjectBtn.addEventListener('click', () => {
  if (activeProjectId) deleteProject(activeProjectId);
});

themeToggle.addEventListener('click', toggleTheme);
sidebarOpen.addEventListener('click', openSidebar);
sidebarClose.addEventListener('click', closeSidebar);
sidebarOverlay.addEventListener('click', closeSidebar);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !taskModal.classList.contains('hidden')) {
    closeModal();
  }
});

document.addEventListener('dragover', (e) => {
  if (!isTaskDragEvent(e)) return;
  if (window.innerWidth <= 768 && e.clientX < 72) {
    sidebar.classList.add('sidebar--open');
    sidebarOverlay.classList.remove('hidden');
  }
});

async function init() {
  const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  setTheme(storedTheme === 'dark' || storedTheme === 'light' ? storedTheme : getTheme());

  try {
    setLoading(true);
    await reloadProjects();
    if (activeProjectId) {
      tasks = await fetchTasks(activeProjectId);
      renderBoard();
    }
  } catch (error) {
    showError(`No se pudo conectar con el servidor: ${error.message}`);
    taskCounter.textContent = 'Error al cargar';
  } finally {
    setLoading(false);
  }
}

init();