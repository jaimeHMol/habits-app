.PHONY: help setup dev-back dev-front test-back test-front lint-back lint-front clean-db reset-all

# Default target when just running 'make'
.DEFAULT_GOAL := help

help: ## Show this help message
	@echo "Usage: make [target]"
	@echo ""
	@echo "Available targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

# --- Instalación ---
setup: ## Install all dependencies for backend and frontend
	@echo "Installing backend dependencies..."
	cd backend && . venv/bin/activate && pip install -r requirements.txt && pip install ruff
	@echo "Installing frontend dependencies..."
	cd frontend && npm install

# --- Servidores de Desarrollo ---
dev-back: ## Start the FastAPI backend server with hot-reload
	@echo "Starting FastAPI..."
	cd backend && . venv/bin/activate && uvicorn src.main:app --reload

dev-front: ## Start the Vite/React frontend development server
	@echo "Starting Vite/React..."
	cd frontend && npm run dev

# --- Pruebas y Linting ---
test-back: ## Run backend tests using pytest
	@echo "Starting test suite in Python..."
	cd backend && . venv/bin/activate && python3 -m pytest -v

test-front: ## Run frontend tests
	@echo "Starting test suite in React..."
	cd frontend && npm run test

lint-back: ## Run Ruff linter and formatter check on backend
	@echo "Running Ruff (linter/formatter)..."
	cd backend && . venv/bin/activate && ruff check . && ruff format --check .

lint-front: ## Run ESLint on frontend
	@echo "Running ESLint..."
	cd frontend && npm run lint

# --- Utilidades de Base de Datos ---
clean-db: ## Delete the local SQLite database
	@echo "Deleting SQLite database..."
	rm -f backend/habits.db
	@echo "Database cleaned. It will be recreated when starting the server."

reset-all: clean-db setup ## Clean database and reinstall all dependencies
	@echo "Project reset to its initial state."
