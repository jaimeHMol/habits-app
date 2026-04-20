# 🌿 Habits App (Páramo Edition)

A minimalist, high-performance task and habit tracker built with a focus on simplicity, responsiveness, and clean architecture.

![Architecture](https://img.shields.io/badge/Architecture-Hexagonal-blue)
![Backend](https://img.shields.io/badge/Backend-FastAPI-009688)
![Frontend](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-646CFF)
![Database](https://img.shields.io/badge/Database-SQLite-003B57)

## ✨ Features

- **Intuitive Board**: Organize tasks across **Daily**, **Monthly**, **Annually**, and **To-Do** columns.
- **Multi-language Support (New)**: Full interface available in **English** and **Spanish**, with user preference persisted in the profile.
- **Task-Linked Alerts**: Automated, mandatory reminders for **Monthly** and **Annually** tasks. They trigger 3 times during your workday (Start, Middle, and End) on the due day until the task is completed.
- **Lock-Resistant Timers**: Improved focused timers that stay accurate even when the mobile device is locked or the app is in the background.
- **Real-time Sync**: Automatic data refresh whenever you return to the app or switch tabs, ensuring consistency across multiple devices.
- **Task Types**: 
  - **Checkbox**: Standard "done/not-done" tasks.
  - **Counter**: Ideal for habits requiring multiple repetitions (e.g., "Drink 8 glasses of water").
- **Smart Recurrence & Review**: 
  - **Daily/Period Reset**: Habits automatically reset at the start of a new period.
  - **Review Modal**: At the first login of the day, a "Review Modal" helps you log forgotten completions from the previous period before the reset.
- **Wellness Reminders**: Set recurring interval-based alerts (e.g., "Stretch every 60 min") to maintain healthy habits throughout the day.
- **Markdown Support**: Rich text descriptions with support for **bold**, *italics*, ~~strikethrough~~, [links](https://google.com), and lists. Links are also supported in task titles.
- **Smart Drag & Drop**: Smoothly reorder tasks within and across columns using `@hello-pangea/dnd`.
- **Responsive Design**: Optimized for both desktop and mobile use with a modern, dark "Páramo" aesthetic and a mobile-friendly header.

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite, TypeScript, TailwindCSS, Zustand (State), Lucide (Icons).
- **Backend**: Python 3.12+, FastAPI, SQLModel (ORM), SQLite, Alembic (Migrations), Ruff (Linter).
- **Infrastructure**: Docker Compose, Nginx (Reverse Proxy with SSL).

## 📂 Project Structure

- `backend/`: Python FastAPI application following hexagonal architecture principles.
- `frontend/`: Modern React application with a component-based structure.
- `nginx.conf`: Nginx configuration for serving the frontend and proxying API requests with SSL support.
- `docker-compose.yml`: Container orchestration for the full stack.
- `Makefile`: Utility commands for a smooth development workflow.

## 🚀 Getting Started

### Prerequisites

- [Docker](https://www.docker.com/) & [Docker Compose](https://docs.docker.com/compose/)
- **Optional (for local dev)**: Node.js (22+), Python (3.12+), and `make`.

### Running with Docker

The easiest way to get the app running is using Docker:

```bash
docker-compose up --build
```

Access the app at `http://localhost` (Local) or your configured domain (Production). **Database migrations are applied automatically on startup.**

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
4. **Admin Management**: Create or update the admin user using credentials from environment variables.
   ```bash
   make manage-admin
   ```

## 🌐 Production Deployment & SSL

To enable native mobile notifications and PWA features, **HTTPS is mandatory**. This project is optimized for deployment on **Oracle Cloud** using subdomains.

### 1. DNS Configuration (Namecheap)
- Create an **A Record** in your DNS provider (e.g., Namecheap).
- **Host**: `habits` (or your preferred subdomain).
- **Value**: Your server's Public IP.

### 2. Firewall Configuration (Oracle Cloud)
Oracle Cloud instances require opening ports in two places:
1. **Cloud Console**: Networking -> VCN -> Security Lists -> Add Ingress Rules for ports `80` and `443` (TCP, Source `0.0.0.0/0`).
2. **Instance OS (iptables)**: Force the ports open at the top of the chain to bypass default reject rules:
   ```bash
   sudo iptables -I INPUT 1 -p tcp --dport 80 -j ACCEPT
   sudo iptables -I INPUT 1 -p tcp --dport 443 -j ACCEPT
   sudo apt-get install iptables-persistent && sudo netfilter-persistent save
   ```

### 3. SSL Certificate (Certbot Standalone)
Since Nginx runs inside Docker, use Certbot's standalone mode on the host to generate certificates:
1. Stop the Nginx container: `sudo docker compose stop nginx`
2. Run Certbot: 
   ```bash
   sudo certbot certonly --standalone -d habits.your-domain.com
   ```
3. Restart Nginx: `sudo docker compose up -d --build nginx`

## 🧪 Testing & Quality

Maintain code quality with built-in tests and linters:

| Component | Test Command | Lint Command |
| :--- | :--- | :--- |
| **Backend** | `make test-back` | `make lint-back` |
| **Frontend** | `make test-front` | `make lint-front` |

## 🗄️ Database Migrations

The project uses **Alembic** to manage database schema changes safely and reliably.

### Best Practices Followed:
- **Linear History**: All migrations follow a single line of evolution (no branching).
- **Sequential Naming**: Migrations use a 3-digit prefix (e.g., `001_initial.py`, `002_add_field.py`) for easy reading.
- **Transactional Consistency**: Changes are handled through autogenerated scripts that are automatically formatted with Ruff.

### Common Commands:

1. **Create a Migration**: Run this after changing a model in `src/domain/models.py`.
   ```bash
   make migration-create msg="add_field_to_task"
   ```
2. **Apply Migrations**: Execute pending changes on the database.
   ```bash
   make migrate
   ```
3. **Rollback**: Revert the last change if something went wrong.
   ```bash
   make migrate-undo
   ```

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
