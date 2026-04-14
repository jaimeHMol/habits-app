.PHONY: setup dev-back dev-front test-back test-front clean-db reset-all

# --- Instalación ---
setup:
	@echo "Installing backend dependencies..."
	cd backend && pip install -r requirements.txt
	@echo "Installing frontend dependencies..."
	cd frontend && npm install

# --- Servidores de Desarrollo ---
dev-back:
	@echo "Starting FastAPI..."
	cd backend && uvicorn src.main:app --reload

dev-front:
	@echo "Starting Vite/React..."
 	# cd frontend && npm run dev
	npm run dev

# --- Pruebas ---
test-back:
	@echo "Starting test suite in Python..."
	cd backend && python -m pytest -v

test-front:
	@echo "Starting test suite in React..."
	cd frontend && npm run test

# --- Utilidades de Base de Datos ---
clean-db:
	@echo "Deleting SQLite database..."
	rm -f backend/habits.db
	@echo "Database cleaned. It will be recreated when starting the server."

reset-all: clean-db setup
	@echo "Project reset to its initial state."