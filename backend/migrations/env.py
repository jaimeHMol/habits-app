import sys
import os
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from alembic import context
from sqlmodel import SQLModel

# Add the project root to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import your models so they are registered with SQLModel.metadata
from src.domain.models import *  # noqa
from src.core.config import settings

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Set the target metadata for autogenerate
target_metadata = SQLModel.metadata


def process_revision_directives(context, revision, directives):
    """Custom hook to enforce sequential revision IDs (001, 002, etc.)."""
    if config.get_main_option("revision_environment") == "true":
        script = context.script
        # Get the current head
        heads = script.get_heads()
        if not heads:
            next_num = 1
        else:
            # Assumes linear history
            last_rev = heads[0]
            try:
                next_num = int(last_rev) + 1
            except ValueError:
                # Fallback: scan versions directory for highest number
                import os

                versions_dir = os.path.join(script.dir, "versions")
                files = os.listdir(versions_dir)
                nums = [
                    int(f.split("_")[0]) for f in files if f.split("_")[0].isdigit()
                ]
                next_num = max(nums) + 1 if nums else 1

        for directive in directives:
            directive.rev_id = f"{next_num:03d}"
            next_num += 1


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = settings.database_url
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        process_revision_directives=process_revision_directives,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    # We use the database URL from our centralized settings
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = settings.database_url

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            # Critical for SQLite: allows altering tables by recreating them
            render_as_batch=True,
            process_revision_directives=process_revision_directives,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
