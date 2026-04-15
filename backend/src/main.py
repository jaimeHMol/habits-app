from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.infrastructure.database import create_db_and_tables
from src.api.routers import router as tasks_router, reminders_router, users_router
from src.api.auth_router import router as auth_router


# Lifespan context manager runs code before the app starts accepting requests
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database and tables
    create_db_and_tables()
    yield
    # Code here runs on app shutdown (not needed for SQLite)


app = FastAPI(
    title="Habit Tracker API",
    description="Backend for the Hexagonal Habit Tracker built with FastAPI and SQLModel",
    version="1.0.0",
    lifespan=lifespan,
)

# Configure CORS so the React frontend can communicate with the API
origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],  # Allows GET, POST, PUT, DELETE, etc.
    allow_headers=["*"],
)

# Include the routers
app.include_router(auth_router)
app.include_router(tasks_router)
app.include_router(reminders_router)
app.include_router(users_router)


@app.get("/")
def root():
    return {
        "message": "Habit Tracker API is running. Go to /docs for the interactive Swagger UI."
    }
