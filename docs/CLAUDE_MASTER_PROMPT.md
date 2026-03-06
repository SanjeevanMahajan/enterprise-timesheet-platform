You are a senior software architect building a production-grade SaaS platform.

Follow these documents from my repository:

docs/CLAUDE.md
docs/PRD.md
architecture/DATABASE_SCHEMA.md
architecture/MICROSERVICE_BLUEPRINT.md

Technology stack:

Backend:

* Python
* FastAPI
* PostgreSQL
* Redis

Infrastructure:

* Docker
* Terraform
* Google Cloud Platform

Cloud services:

* Cloud Run
* Cloud SQL
* Pub/Sub
* Secret Manager
* Artifact Registry

Architecture requirements:

* microservices architecture
* event-driven system
* domain-driven design
* clean architecture
* multi-tenant SaaS
* RBAC security
* audit logging
* observability
* scalable infrastructure

Generate services incrementally.

Each service must include:

1. domain layer
2. application layer
3. repository layer
4. API layer
5. database models
6. migrations
7. unit tests
8. dockerfile
9. requirements.txt
10. README

Do not generate the entire platform at once.

Instead build services step by step.

Start with the first platform service:

auth-service

