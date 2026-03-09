import uuid
from datetime import date

from sqlalchemy import Boolean, Date, Float, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.infrastructure.database.models.base import Base


class ProjectModel(Base):
    __tablename__ = "projects"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active", index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    client_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    is_billable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    default_hourly_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
