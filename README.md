# 🌿 Habits App (Páramo Edition)

A minimalist, high-performance task and habit tracker built with a focus on simplicity, responsiveness, and clean architecture.

![Architecture](https://img.shields.io/badge/Architecture-Hexagonal-blue)
![Backend](https://img.shields.io/badge/Backend-FastAPI-009688)
![Frontend](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-646CFF)
![Database](https://img.shields.io/badge/Database-SQLite-003B57)

## ✨ Features

- **Intuitive Board**: Organize tasks across **Daily**, **Monthly**, **Annually**, and **To-Do** columns.
- **Task Types**: 
  - **Checkbox**: Standard "done/not-done" tasks.
  - **Counter**: Ideal for habits requiring multiple repetitions (e.g., "Drink 8 glasses of water").
- **Task-Linked Alerts (New)**: Automated, mandatory reminders for **Monthly** and **Annually** tasks. They trigger 3 times during your workday (Start, Middle, and End) on the due day until the task is completed.
- **Focused Timers**: Integrated countdown timer for tasks with a defined duration, helping you stay focused on a single activity.
- **Smart Recurrence & Review**: 
  - **Daily/Period Reset**: Habits automatically reset at the start of a new period.
  - **Review Modal**: At the first login of the day, a "Review Modal" helps you log forgotten completions from the previous period before the reset.
- **Wellness Reminders**: Set recurring interval-based alerts (e.g., "Stretch every 60 min") to maintain healthy habits throughout the day.
- **Markdown Support**: Rich text descriptions with support for **bold**, *italics*, ~~strikethrough~~, [links](https://google.com), and lists.
- **Smart Drag & Drop**: Smoothly reorder tasks within and across columns using `@hello-pangea/dnd`.
- **Priority System**: Visual categorization of tasks (Muted, Important/Frailejón, Critical/Tierra).
- **Responsive Design**: Optimized for both desktop and mobile use with a modern, dark "Páramo" aesthetic.
- **Secure Auth & Invites**: Robust user authentication and session management with a built-in **Invite Code** generation system for new users.

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

## 🛡️ Database Backups

The application includes an automated backup system:
- **Schedule**: Runs daily at **4:00 AM** (Colombia Time - `America/Bogota`).
- **Retention**: Keeps backups for **30 days**.
- **Location**: Backups are stored in the `./backups` directory on the host.

To trigger a backup manually:
```bash
make backup-manual
```

---
*Built with care for productivity enthusiasts.*
