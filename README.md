# 🌿 Habits App (Páramo Edition)

A minimalist, high-performance task and habit tracker built with a focus on simplicity, responsiveness, and clean architecture.

![Architecture](https://img.shields.io/badge/Architecture-Hexagonal-blue)
![Backend](https://img.shields.io/badge/Backend-FastAPI-009688)
![Frontend](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-646CFF)
![Database](https://img.shields.io/badge/Database-SQLite-003B57)

## ✨ Features

- **Intuitive Board**: Organize tasks across Daily, Monthly, Annually, and To-Do columns.
- **Markdown Support**: Rich text descriptions with support for **bold**, *italics*, ~~strikethrough~~, [links](https://google.com), and lists.
- **Smart Drag & Drop**: Smoothly reorder tasks within and across columns using `@hello-pangea/dnd`.
- **Priority System**: Visual categorization of tasks (Muted, Important/Frailejón, Critical/Tierra).
- **Responsive Design**: Optimized for both desktop and mobile use with a modern, dark "Páramo" aesthetic.
- **Secure Auth**: Robust user authentication and session management.

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite, TypeScript, TailwindCSS, Zustand (State), Lucide (Icons).
- **Backend**: Python 3.12+, FastAPI, SQLModel (ORM), SQLite, Pydantic, Ruff (Linter).
- **Infrastructure**: Docker Compose, Nginx (Reverse Proxy).

## 📂 Project Structure

- `backend/`: Python FastAPI application following hexagonal architecture principles.
- `frontend/`: Modern React application with a component-based structure.
- `nginx.conf`: Nginx configuration for serving the frontend and proxying API requests.
- `docker-compose.yml`: Container orchestration for the full stack.
- `Makefile`: Utility commands for a smooth development workflow.

## 🚀 Getting Started

### Prerequisites

- [Docker](https://www.docker.com/) & [Docker Compose](https://docs.docker.com/compose/)
- **Optional (for local dev)**: Node.js (22+), Python (3.12+), and `make`.

### Running with Docker (Recommended)

The easiest way to get the app running is using Docker:

```bash
docker-compose up --build
```

Access the app at `http://localhost`.

### Local Development

Use the included `Makefile` to simplify common tasks:

1. **Setup**: Install all dependencies.
   ```bash
   make setup
   ```
2. **Backend**: Start the FastAPI server (with hot-reload).
   ```bash
   make dev-back
   ```
3. **Frontend**: Start the Vite development server.
   ```bash
   make dev-front
   ```

## 🧪 Testing & Quality

Maintain code quality with built-in tests and linters:

| Component | Test Command | Lint Command |
| :--- | :--- | :--- |
| **Backend** | `make test-back` | `make lint-back` |
| **Frontend** | `make test-front` | `make lint-front` |

## 💾 Database Persistence

The SQLite database is stored at `backend/habits.db`. When using Docker, this file is mounted as a volume to ensure your data persists across container restarts.

---
*Built with care for productivity enthusiasts.*
