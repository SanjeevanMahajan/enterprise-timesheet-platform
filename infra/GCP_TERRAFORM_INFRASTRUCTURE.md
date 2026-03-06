# GCP_TERRAFORM_INFRASTRUCTURE.md

## Purpose
Defines the infrastructure required for production deployment.

## Core Components

VPC Network
Cloud Run Services
Cloud SQL PostgreSQL
Redis Memorystore
Pub/Sub
Cloud Storage
Load Balancer

## Terraform Module Layout

modules/
network/
cloud_run_service/
postgresql/
pubsub/
redis/

## Example Terraform Structure

terraform/
main.tf
variables.tf
outputs.tf

## Example Resource

resource "google_cloud_run_service" "service" {
  name     = "project-service"
  location = "us-central1"
}