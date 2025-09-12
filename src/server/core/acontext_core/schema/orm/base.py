import uuid
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
from dataclasses import dataclass, field, fields
from pydantic import ValidationError
from sqlalchemy.orm import registry, RelationshipProperty
from sqlalchemy import Column
from sqlalchemy.sql import func
from sqlalchemy.types import DateTime

from ..utils import asUUID

# Create the registry for dataclass ORM
ORM_BASE = registry()


class BaseMixin:
    __sa_dataclass_metadata_key__ = "db"

    def __repr__(self) -> str:
        """
        Return a string representation showing only non-relationship fields.
        Automatically excludes SQLAlchemy relationship fields.
        """
        class_name = self.__class__.__name__

        # Get all dataclass fields
        field_values = []

        for field_info in fields(self):
            field_name = field_info.name

            # Skip relationship fields by checking if they have relationship metadata
            if hasattr(field_info, "metadata") and field_info.metadata:
                db_metadata = field_info.metadata.get("db")
                if db_metadata and isinstance(db_metadata, RelationshipProperty):
                    continue

            # Get the field value
            value = getattr(self, field_name, "...")
            field_values.append(f"{field_name}={value!r}")

        return f"{class_name}({', '.join(field_values)})"


@dataclass
class TimestampMixin(BaseMixin):

    created_at: datetime = field(
        init=False,
        metadata={
            "db": Column(
                DateTime(timezone=True), server_default=func.now(), nullable=False
            )
        },
    )
    updated_at: datetime = field(
        init=False,
        metadata={
            "db": Column(
                DateTime(timezone=True),
                server_default=func.now(),
                onupdate=func.now(),
                nullable=False,
            )
        },
    )


@dataclass
class CommonMixin(TimestampMixin):
    """Mixin class for common timestamp fields matching GORM autoCreateTime/autoUpdateTime"""

    id: asUUID = field(
        init=False,
        metadata={
            "db": Column(
                UUID(as_uuid=True),
                primary_key=True,
                default=uuid.uuid4,
                server_default=func.gen_random_uuid(),
            )
        },
    )
