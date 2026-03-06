import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.infrastructure.database.models.base import Base


class TimeLogModel(Base):
    __tablename__ = "timelogs"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    task_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    hours: Mapped[float] = mapped_column(Float, nullable=False)
    log_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    billable: Mapped[bool] = mapped_column(Boolean, default=True)
    hourly_rate: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Timer fields
    timer_started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    timer_stopped_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # AI-generated insights (populated asynchronously by ai-service)
    ai_category: Mapped[str | None] = mapped_column(String(50), nullable=True)
    ai_quality_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    ai_suggestion: Mapped[str | None] = mapped_column(Text, nullable=True)
