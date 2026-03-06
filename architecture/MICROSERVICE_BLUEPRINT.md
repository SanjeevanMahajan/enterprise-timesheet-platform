# MICROSERVICE_BLUEPRINT.md

## Platform Services

identity-service
tenant-service
notification-service
integration-service
workflow-service
audit-service

## Product Services

project-service
task-service
issue-service
timesheet-service

## Data Services

analytics-service
search-service
file-service

## Event Topics

projects.events
tasks.events
timesheets.events
notifications.events

## Deployment Model

Each service runs independently on Cloud Run.

Services communicate via:

REST APIs
Pub/Sub events