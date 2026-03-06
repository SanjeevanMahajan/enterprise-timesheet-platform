# CLAUDE.md — Production AI Development Contract

## Purpose
Defines the engineering rules Claude must follow when generating code for this platform.

## Architecture
Clean Architecture layers:
- Domain
- Application
- Infrastructure
- Presentation

Business logic exists ONLY in Domain or Application layers.

## Technology Stack
Backend: Python 3.12, FastAPI, SQLAlchemy, Pydantic
Cloud: Google Cloud Platform
Runtime: Cloud Run
Database: Cloud SQL (PostgreSQL)
Messaging: Pub/Sub
Cache: Redis (Memorystore)

## Multi‑Tenancy
All tables include:
tenant_id

All queries enforce tenant isolation.

## Event Driven Design
Events:
ProjectCreated
TaskAssigned
TimeLogCreated
TimesheetSubmitted
TimesheetApproved

Events are published to Pub/Sub topics.

## Security
OAuth2 / OpenID Connect
RBAC roles:
admin
manager
member
viewer

Secrets stored in Secret Manager.

## Observability
OpenTelemetry
Cloud Logging
Cloud Monitoring

## Testing
Domain coverage >=95%
Application >=85%
Overall >=80%

## Deployment
Containers deployed to Cloud Run.