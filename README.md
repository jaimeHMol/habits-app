# 🌿 Habits App (Páramo Edition)

A minimalist, high-performance task and habit tracker built with a focus on simplicity, responsiveness, and clean architecture.

![Architecture](https://img.shields.io/badge/Architecture-Hexagonal-blue)
![Backend](https://img.shields.io/badge/Backend-FastAPI-009688)
![Frontend](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-646CFF)
![Database](https://img.shields.io/badge/Database-SQLite-003B57)

## ✨ Features

- **Intuitive Board**: Organize tasks across **Daily**, **Monthly**, **Annually**, and **To-Do** columns.
- **Local-First & Offline Support**: Enjoy a "Zero-Loading-Screen" experience. Data is persisted locally for instant startup, and changes are synced in the background when connection is restored. Supports creation, completion, and deletion of tasks even while offline.
- **Optimistic UI**: Every interaction (adding, pinning, or completing a task) happens in 0ms, giving immediate feedback before the server responds.
- **Delightful Micro-interactions**: Celebrate your wins with a subtle **Confetti** burst and a synthesized **Audio Arpeggio** (Web Audio API) upon task completion. 
- **In-App Progress Visuals**: Task cards feature a dynamic **Background Progress Bar** that reflects the remaining time of your active focus timer.
- **Multi-language Support**: Full interface available in **English** and **Spanish**, with user preference persisted in the profile.
- **Pin Tasks**: Keep your most important items at the top of Monthly and Annually columns, above auto-sorted due dates.
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
docker compose up -d --build
```

> [!WARNING]
> **Avoid using `sudo` with Docker Compose if possible.**
> If your `docker-compose.yml` mounts host directories using the tilde (`~`) character (e.g., `~/conf/nginx`), running `sudo docker compose` will cause the tilde to resolve to the root user's home directory (`/root`) instead of your user's home directory (e.g., `/home/ubuntu`). This can lead to Docker silently mounting empty folders into your containers.
> 
> If you **must** use `sudo`, you can pass the correct home directory using an environment variable:
> `sudo HOME=/home/ubuntu docker compose up -d`

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

### 3. SSL Certificate (Certbot Standalone & Auto-Renewal)

Since Nginx runs inside Docker, use Certbot's standalone mode on the host to generate and renew certificates:

#### Manual Generation / Emergency Renewal:
1. Stop the Nginx container to free port 80:
   ```bash
   sudo docker compose stop nginx
   ```
2. Renew or generate the certificate:
   ```bash
   # To renew an existing expired certificate:
   sudo certbot renew

   # Or for initial generation:
   # sudo certbot certonly --standalone -d habits.your-domain.com
   ```
3. Restart Nginx:
   ```bash
   sudo docker compose up -d nginx
   ```

#### Automatic Renewal Configuration (Recommended):
On Ubuntu, Certbot has a systemd timer/cron job that runs renewal checks automatically in the background. However, since Nginx binds to port 80, the background renewal will fail unless we tell Certbot to temporarily stop Nginx during the challenge.

To automate this, configure **pre** and **post** hooks in Certbot. Run the following command on your server (replace `/path/to/habits-app` with the absolute path to your project folder on the host):
```bash
sudo certbot renew --pre-hook "docker compose -f /path/to/habits-app/docker-compose.yml stop nginx" --post-hook "docker compose -f /path/to/habits-app/docker-compose.yml up -d nginx"
```
Certbot will save these hooks in `/etc/letsencrypt/renewal/habits.jaimehmol.me.conf` and use them automatically in all future background renewals, ensuring zero manual intervention.

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

## 🔐 Security & Infrastructure Improvements

The application has been hardened following industry best practices to ensure data integrity and protection against common web vulnerabilities.

### Security Features
- **XSS Protection (HttpOnly Cookies):** Authentication tokens are no longer stored in `localStorage`. They are now handled via `HttpOnly`, `Secure`, and `SameSite=Lax` cookies, making them inaccessible to malicious scripts.
- **Brute Force Protection:** Nginx is configured with `limit_req` to rate-limit requests to the `/auth/` endpoints.
- **OWASP Headers:** Essential security headers (HSTS, X-Frame-Options, X-Content-Type-Options) are enforced via Nginx.
- **Restricted CORS:** Cross-Origin Resource Sharing is restricted to authorized domains only (configured via `CORS_ORIGINS_STR` in `.env`).
- **Secret Enforcement:** The backend will fail to start if `SECRET_KEY` or `ADMIN_PASSWORD` are not explicitly provided in the environment.

### Infrastructure & Stability
- **Docker Resource Limits:** Containers are restricted in CPU and RAM (e.g., Backend limited to 512MB, Frontend 256MB) to prevent server-wide crashes due to resource exhaustion.
- **Named Volumes:** The SQLite database is stored in a managed Docker volume (`habit_data`) mapped to `/app/data/` inside the container. This improves performance and prevents host-level file permission issues.
- **Automated Backups:** A dedicated backup service performs an atomic copy of the SQLite database daily at **4:00 AM** (America/Bogota) and keeps a **30-day rotation**. Backups are stored in the `./backups` directory on the host.

## 🔔 Native Push Notifications (Mobile/PWA)

The application supports native mobile notifications even when the browser is closed. Due to technical limitations in the PWA standard and bugs in common Python libraries, several critical workarounds were implemented:

### 🛠️ Technical Workarounds
1.  **PNG Icons Only**: Android Chrome **fails silently** if a notification uses an SVG icon. All push notifications are hardcoded to use `/pwa-192x192.png`.
2.  **Library Bypass (The "Nuclear Fix")**: Standard libraries like `pywebpush` and `py-vapid` suffer from a `TypeError: curve must be an EllipticCurve instance` when used with modern versions of the `cryptography` library. 
    - **Solution**: We bypassed the high-level library constructors. VAPID tokens are signed manually using `PyJWT` (ES256), and payloads are encrypted using the low-level `http_ece` engine.
3.  **Background Timers (Doze Mode & Data Races)**: To reliably trigger focus timers when the device is locked:
    - The backend sets the `Urgency: high` header to wake Android from "Doze Mode".
    - The Service Worker sets `requireInteraction: true` and a distinct, long vibration pattern (`[500, 200, 500, 200, 1000]`) to simulate an alarm.
    - To prevent a data race where unlocking the phone causes the frontend to revert a server-completed task, frontend timers send explicit state (`targetState=true`) instead of "blind" toggling.
4.  **Nginx Proxying**: New API routes under `/push/` must be explicitly proxied in `nginx.conf` to reach the backend.
5.  **Service Worker Lifecycle**: Mobile browsers are aggressive with caching. When updating notification logic, users must often clear site data in Chrome settings to register the new `sw.js`.

### 🔑 VAPID Key Management
VAPID keys are the security handshake between your server and Google/Apple.
1.  **Generate Keys**: Run `make vapid-gen` in your local environment.
2.  **Configure `.env`**: Copy the `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` to your server's `.env`.
3.  **Contact Email**: Set `VAPID_SUBJECT=mailto:your-email@example.com` as required by the protocol.

### 📱 Mobile Setup
- **HTTPS is Mandatory**: Push notifications will not work over plain HTTP.
- **Add to Home Screen**: On Android and iOS (16.4+), the app must be installed as a PWA (via "Add to Home Screen") to receive background notifications reliably.

---

## 🛠 Maintenance & Troubleshooting

### Viewing Logs
```bash
# General logs
sudo docker compose logs -f

# Auth/Nginx rate limit logs
sudo docker compose logs -f nginx
```

### Accessing the Database
Since the database is now in a managed volume, you can access it via the container:
```bash
sudo docker compose exec backend sqlite3 /app/data/habits.db
```

### Manual Backup
```bash
sudo docker compose exec backup /usr/local/bin/backup.sh
```

### Future Considerations
1. **CSP Policy:** If adding external scripts to the frontend, the Content-Security-Policy header in `nginx.conf` may need adjustment.
2. **Database Migrations:** Always run `make migration-create msg="description"` after changing models and test the migration locally before deploying.
3. **Environment Variables:** Ensure `.env` is never committed to version control and contains strong secrets in production.

---
*Built with care for productivity enthusiasts.*
