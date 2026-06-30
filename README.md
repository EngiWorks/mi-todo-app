# Mi Lista de Tareas — Full Stack

Aplicación de lista de tareas con **Node.js**, **Express**, **SQLite** y frontend en HTML/CSS/JavaScript vanilla.

## Estructura del proyecto

```
mi-todo-app/
├── package.json          # Scripts y dependencias
├── vercel.json           # Configuración de despliegue en Vercel
├── README.md
├── api/
│   └── index.js          # Entrada serverless (Vercel)
├── server/
│   ├── index.js          # Servidor local (npm run dev)
│   ├── app.js            # App Express compartida
│   ├── db.js             # Conexión SQLite
│   ├── tasks.db          # Base de datos local (se crea automáticamente)
│   └── routes/
│       └── tasks.js      # Rutas REST
└── frontend/
    ├── index.html        # Interfaz de usuario (estático en Vercel)
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

## Despliegue en Vercel

### Requisitos

- Cuenta en [Vercel](https://vercel.com)
- Node.js **22+** en el proyecto (necesario para `node:sqlite` en serverless)

### Pasos

1. Sube el repositorio a GitHub/GitLab/Bitbucket.
2. En Vercel: **Add New Project** → importa el repositorio.
3. Vercel detecta `vercel.json` automáticamente. No cambies la configuración.
4. Pulsa **Deploy**.

### Cómo funciona en Vercel

| Componente | Comportamiento |
|------------|----------------|
| `frontend/` | Se sirve como sitio estático (`outputDirectory`) |
| `api/index.js` | Función serverless que ejecuta Express para `/api/*` |
| `vercel.json` | Enruta `/api/tasks` → función serverless |

### Importante: SQLite en serverless

En Vercel la base de datos se guarda en `/tmp`, que es **efímero**:

- Los datos pueden perderse entre despliegues o reinicios de funciones.
- Para producción real se recomienda [Vercel Postgres](https://vercel.com/storage/postgres), [Turso](https://turso.tech/) o [PlanetScale](https://planetscale.com/).

### Despliegue con CLI

```bash
npm i -g vercel
vercel
```

## Tecnologías

- **Backend:** Node.js, Express, SQLite, CORS
- **Frontend:** HTML5, CSS3, JavaScript (vanilla), Tailwind CDN
- **Persistencia:** SQLite (las tareas ya no usan `localStorage`)
- **Deploy:** Vercel (serverless + estático)