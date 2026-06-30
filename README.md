# Mi Lista de Tareas — Full Stack

Aplicación de lista de tareas con **Node.js**, **Express**, **SQLite** y frontend en HTML/CSS/JavaScript vanilla.

## Estructura del proyecto

```
mi-todo-app/
├── package.json          # Scripts y dependencias
├── README.md
├── server/
│   ├── index.js          # Servidor Express
│   ├── db.js             # Conexión SQLite (better-sqlite3)
│   ├── tasks.db          # Base de datos (se crea automáticamente)
│   └── routes/
│       └── tasks.js      # Rutas REST
└── frontend/
    ├── index.html        # Interfaz de usuario
    ├── styles.css        # Estilos (tema claro/oscuro)
    └── app.js            # Lógica del cliente (fetch API)
```

## Requisitos

- [Node.js](https://nodejs.org/) 18 o superior
- En Windows: puede ser necesario instalar **Visual Studio Build Tools** (carga de trabajo "Desktop development with C++") para compilar `better-sqlite3`. Si la instalación falla, el servidor usa automáticamente `node:sqlite` (integrado en Node.js 22+) como respaldo.

## Instalación

```bash
# Clonar o descargar el proyecto, luego:
npm install
```

## Ejecución

### Modo desarrollo (con recarga automática)

```bash
npm run dev
```

### Modo producción

```bash
npm start
```

Abre en el navegador: **http://localhost:3000**

## API REST

Base URL: `http://localhost:3000/api/tasks`

| Método   | Ruta               | Descripción        |
|----------|--------------------|--------------------|
| `GET`    | `/api/tasks`       | Listar tareas      |
| `POST`   | `/api/tasks`       | Crear tarea        |
| `PUT`    | `/api/tasks/:id`   | Actualizar tarea   |
| `DELETE` | `/api/tasks/:id`   | Eliminar tarea     |

### Ejemplos

**Crear tarea:**

```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d "{\"text\":\"Comprar leche\",\"due_date\":\"2026-07-15\"}"
```

**Marcar como completada:**

```bash
curl -X PUT http://localhost:3000/api/tasks/1 \
  -H "Content-Type: application/json" \
  -d "{\"completed\":true}"
```

**Eliminar tarea:**

```bash
curl -X DELETE http://localhost:3000/api/tasks/1
```

## Base de datos

SQLite con tabla `tasks`:

| Campo        | Tipo    | Descripción                    |
|--------------|---------|--------------------------------|
| `id`         | INTEGER | Clave primaria autoincremental |
| `text`       | TEXT    | Texto de la tarea              |
| `completed`  | INTEGER | 0 = pendiente, 1 = completada  |
| `due_date`   | TEXT    | Fecha de vencimiento (YYYY-MM-DD), opcional |
| `created_at` | TEXT    | Fecha de creación (ISO 8601)   |

El archivo `server/tasks.db` se genera automáticamente al iniciar el servidor.

## Funcionalidades del frontend

- Agregar, editar, completar y eliminar tareas
- Filtros: Todas / Pendientes / Completadas
- Fecha de vencimiento con calendario nativo
- Tareas vencidas resaltadas en rojo
- Ordenación por fecha de vencimiento
- Modo oscuro (preferencia guardada en `localStorage`)
- Limpiar tareas completadas

## Tecnologías

- **Backend:** Node.js, Express, better-sqlite3, CORS
- **Frontend:** HTML5, CSS3, JavaScript (vanilla), Tailwind CDN
- **Persistencia:** SQLite (las tareas ya no usan `localStorage`)