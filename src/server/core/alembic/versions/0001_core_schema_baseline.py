"""Core schema baseline before session display titles.

Revision ID: 0001_core_schema_baseline
Revises:
Create Date: 2026-04-01 00:00:00
"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0001_core_schema_baseline"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

UPGRADE_STATEMENTS = (
    "CREATE EXTENSION IF NOT EXISTS vector",
    """
    CREATE TABLE projects (
        secret_key_hmac VARCHAR(64) NOT NULL,
        secret_key_hash_phc VARCHAR(255) NOT NULL,
        encryption_enabled BOOLEAN DEFAULT 'false' NOT NULL,
        configs JSONB,
        id UUID DEFAULT gen_random_uuid() NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        PRIMARY KEY (id)
    )
    """,
    "CREATE UNIQUE INDEX ix_project_secret_key_hmac ON projects (secret_key_hmac)",
    """
    CREATE TABLE metrics (
        project_id UUID NOT NULL,
        tag VARCHAR NOT NULL,
        increment BIGINT NOT NULL,
        id UUID DEFAULT gen_random_uuid() NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        PRIMARY KEY (id),
        FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE
    )
    """,
    "CREATE INDEX idx_metric_project_id_tag_created_at ON metrics (project_id, tag, created_at)",
    """
    CREATE TABLE sandbox_logs (
        project_id UUID NOT NULL,
        backend_sandbox_id VARCHAR,
        backend_type VARCHAR NOT NULL,
        history_commands JSONB NOT NULL,
        generated_files JSONB NOT NULL,
        will_total_alive_seconds INTEGER NOT NULL,
        id UUID DEFAULT gen_random_uuid() NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        PRIMARY KEY (id),
        FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE
    )
    """,
    "CREATE INDEX ix_sandbox_log_project_id ON sandbox_logs (project_id)",
    """
    CREATE TABLE users (
        project_id UUID NOT NULL,
        identifier VARCHAR NOT NULL,
        id UUID DEFAULT gen_random_uuid() NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        PRIMARY KEY (id),
        CONSTRAINT idx_project_identifier UNIQUE (project_id, identifier),
        FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE
    )
    """,
    "CREATE INDEX ix_users_project_id ON users (project_id)",
    """
    CREATE TABLE disks (
        project_id UUID NOT NULL,
        user_id UUID,
        id UUID DEFAULT gen_random_uuid() NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        PRIMARY KEY (id),
        FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE,
        FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
    )
    """,
    "CREATE INDEX ix_disks_project_id ON disks (project_id)",
    "CREATE INDEX ix_disks_user_id ON disks (user_id)",
    """
    CREATE TABLE learning_spaces (
        project_id UUID NOT NULL,
        user_id UUID,
        meta JSONB,
        id UUID DEFAULT gen_random_uuid() NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        PRIMARY KEY (id),
        FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE,
        FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
    )
    """,
    "CREATE INDEX ix_learning_space_project_id ON learning_spaces (project_id)",
    "CREATE INDEX ix_learning_space_user_id ON learning_spaces (user_id)",
    "CREATE INDEX idx_ls_meta ON learning_spaces USING gin (meta)",
    """
    CREATE TABLE sessions (
        project_id UUID NOT NULL,
        user_id UUID,
        disable_task_tracking BOOLEAN DEFAULT 'false' NOT NULL,
        configs JSONB,
        id UUID DEFAULT gen_random_uuid() NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        PRIMARY KEY (id),
        FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE,
        FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
    )
    """,
    "CREATE INDEX ix_session_session_project_id ON sessions (id, project_id)",
    "CREATE INDEX ix_sessions_user_id ON sessions (user_id)",
    "CREATE INDEX ix_session_project_id ON sessions (project_id)",
    """
    CREATE TABLE agent_skills (
        project_id UUID NOT NULL,
        name VARCHAR NOT NULL,
        disk_id UUID NOT NULL,
        user_id UUID,
        description VARCHAR,
        meta JSONB,
        id UUID DEFAULT gen_random_uuid() NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        PRIMARY KEY (id),
        FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE,
        FOREIGN KEY(disk_id) REFERENCES disks (id) ON DELETE CASCADE,
        FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
    )
    """,
    "CREATE INDEX ix_agent_skills_user_id ON agent_skills (user_id)",
    "CREATE INDEX ix_agent_skills_project_id ON agent_skills (project_id)",
    """
    CREATE TABLE artifacts (
        disk_id UUID NOT NULL,
        path VARCHAR NOT NULL,
        filename VARCHAR NOT NULL,
        asset_meta JSONB NOT NULL,
        meta JSONB,
        id UUID DEFAULT gen_random_uuid() NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        PRIMARY KEY (id),
        CONSTRAINT idx_disk_path_filename UNIQUE (disk_id, path, filename),
        FOREIGN KEY(disk_id) REFERENCES disks (id) ON DELETE CASCADE
    )
    """,
    "CREATE INDEX ix_artifacts_disk_id ON artifacts (disk_id)",
    """
    CREATE TABLE learning_space_sessions (
        learning_space_id UUID NOT NULL,
        session_id UUID NOT NULL,
        status TEXT DEFAULT 'pending' NOT NULL,
        id UUID DEFAULT gen_random_uuid() NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        PRIMARY KEY (id),
        CONSTRAINT uq_learning_space_session_session_id UNIQUE (session_id),
        FOREIGN KEY(learning_space_id) REFERENCES learning_spaces (id) ON DELETE CASCADE,
        FOREIGN KEY(session_id) REFERENCES sessions (id) ON DELETE CASCADE
    )
    """,
    "CREATE INDEX ix_learning_space_sessions_learning_space_id ON learning_space_sessions (learning_space_id)",
    """
    CREATE TABLE session_events (
        session_id UUID NOT NULL,
        project_id UUID NOT NULL,
        type VARCHAR NOT NULL,
        data JSONB NOT NULL,
        id UUID DEFAULT gen_random_uuid() NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        PRIMARY KEY (id),
        FOREIGN KEY(session_id) REFERENCES sessions (id) ON DELETE CASCADE,
        FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE
    )
    """,
    "CREATE INDEX idx_session_event_created ON session_events (session_id, created_at)",
    "CREATE INDEX ix_session_event_project_id ON session_events (project_id)",
    """
    CREATE TABLE tasks (
        session_id UUID NOT NULL,
        project_id UUID NOT NULL,
        "order" INTEGER NOT NULL,
        data JSONB NOT NULL,
        status VARCHAR DEFAULT 'pending' NOT NULL,
        is_planning BOOLEAN DEFAULT 'false' NOT NULL,
        id UUID DEFAULT gen_random_uuid() NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        PRIMARY KEY (id),
        CONSTRAINT ck_status CHECK (status IN ('success', 'failed', 'running', 'pending')),
        CONSTRAINT uq_session_id_order UNIQUE (session_id, "order"),
        FOREIGN KEY(session_id) REFERENCES sessions (id) ON DELETE CASCADE,
        FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE
    )
    """,
    "CREATE INDEX ix_task_project_id ON tasks (project_id)",
    "CREATE INDEX ix_task_session_id_status ON tasks (session_id, status)",
    "CREATE INDEX ix_task_session_id ON tasks (session_id)",
    "CREATE INDEX ix_task_session_id_task_id ON tasks (session_id, id)",
    """
    CREATE TABLE learning_space_skills (
        id UUID DEFAULT gen_random_uuid() NOT NULL,
        learning_space_id UUID NOT NULL,
        skill_id UUID NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        PRIMARY KEY (id),
        CONSTRAINT idx_ls_skill_unique UNIQUE (learning_space_id, skill_id),
        FOREIGN KEY(learning_space_id) REFERENCES learning_spaces (id) ON DELETE CASCADE,
        FOREIGN KEY(skill_id) REFERENCES agent_skills (id) ON DELETE CASCADE
    )
    """,
    "CREATE INDEX ix_learning_space_skills_skill_id ON learning_space_skills (skill_id)",
    "CREATE INDEX ix_learning_space_skills_learning_space_id ON learning_space_skills (learning_space_id)",
    """
    CREATE TABLE messages (
        session_id UUID NOT NULL,
        role VARCHAR NOT NULL,
        parts_asset_meta JSONB NOT NULL,
        parent_id UUID,
        task_id UUID,
        session_task_process_status VARCHAR DEFAULT 'pending' NOT NULL,
        id UUID DEFAULT gen_random_uuid() NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        PRIMARY KEY (id),
        CONSTRAINT ck_message_role CHECK (role IN ('user', 'assistant', 'tool', 'function')),
        FOREIGN KEY(session_id) REFERENCES sessions (id) ON DELETE CASCADE,
        FOREIGN KEY(parent_id) REFERENCES messages (id) ON DELETE CASCADE,
        FOREIGN KEY(task_id) REFERENCES tasks (id) ON DELETE SET NULL
    )
    """,
    "CREATE INDEX ix_message_session_id ON messages (session_id)",
    "CREATE INDEX ix_message_parent_id ON messages (parent_id)",
    "CREATE INDEX idx_session_created ON messages (session_id, created_at)",
)

DOWNGRADE_STATEMENTS = (
    "DROP TABLE IF EXISTS messages CASCADE",
    "DROP TABLE IF EXISTS learning_space_skills CASCADE",
    "DROP TABLE IF EXISTS tasks CASCADE",
    "DROP TABLE IF EXISTS session_events CASCADE",
    "DROP TABLE IF EXISTS learning_space_sessions CASCADE",
    "DROP TABLE IF EXISTS artifacts CASCADE",
    "DROP TABLE IF EXISTS agent_skills CASCADE",
    "DROP TABLE IF EXISTS sessions CASCADE",
    "DROP TABLE IF EXISTS learning_spaces CASCADE",
    "DROP TABLE IF EXISTS disks CASCADE",
    "DROP TABLE IF EXISTS users CASCADE",
    "DROP TABLE IF EXISTS sandbox_logs CASCADE",
    "DROP TABLE IF EXISTS metrics CASCADE",
    "DROP TABLE IF EXISTS projects CASCADE",
)


def upgrade() -> None:
    for statement in UPGRADE_STATEMENTS:
        op.execute(statement)


def downgrade() -> None:
    for statement in DOWNGRADE_STATEMENTS:
        op.execute(statement)
