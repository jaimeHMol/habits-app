.PHONY: setup dev-back dev-front test-back test-front lint-back lint-front clean-db reset-all

# --- Instalación ---
setup:
	@echo "Installing backend dependencies..."
	cd backend && . venv/bin/activate && pip install -r requirements.txt && pip install ruff
	@echo "Installing frontend dependencies..."
	cd frontend && npm install

# --- Servidores de Desarrollo ---
dev-back:
	@echo "Starting FastAPI..."
	cd backend && . venv/bin/activate && uvicorn src.main:app --reload

dev-front:
	@echo "Starting Vite/React..."
	cd frontend && npm run dev

# --- Pruebas y Linting ---
test-back:
	@echo "Starting test suite in Python..."
	cd backend && . venv/bin/activate && python3 -m pytest -v

test-front:
	@echo "Starting test suite in React..."
	cd frontend && npm run test

lint-back:
	@echo "Running Ruff (linter/formatter)..."
	cd backend && . venv/bin/activate && ruff check . && ruff format --check .

lint-front:
	@echo "Running ESLint..."
	cd frontend && npm run lint

# --- Utilidades de Base de Datos ---
clean-db:
	@echo "Deleting SQLite database..."
	rm -f backend/habits.db
	@echo "Database cleaned. It will be recreated when starting the server."

reset-all: clean-db setup
	@echo "Project reset to its initial state."
