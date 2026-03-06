# DATABASE_SCHEMA.md

## Core Tables

users
organizations
projects
phases
tasks
issues
timelogs
timesheets
notifications
audit_logs

All tables include:

id
tenant_id
created_at
updated_at

## Example Table: projects

id
tenant_id
name
owner_id
status
start_date
end_date

## Example Table: timelogs

id
tenant_id
user_id
project_id
task_id
hours
billable
log_date