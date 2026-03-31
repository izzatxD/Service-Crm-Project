# Database Relationship Overview

This document summarizes the main table relationships in the initial PostgreSQL schema for the service-business management platform.

## Core Tenant Structure

- `organizations` 1-to-many `branches`
- `organizations` 1-to-many `staff_members`
- `organizations` 1-to-many `clients`
- `organizations` 1-to-many `service_categories`
- `organizations` 1-to-many `services`
- `organizations` 1-to-many `inventory_items`
- `organizations` 1-to-many `orders`
- `organizations` 1-to-many `expenses`
- `organizations` 1-to-many `audit_logs`

## Authentication and Staff

- `users` 1-to-many `staff_members`
  - One login identity can be attached to one or more staff profiles across organizations if needed in future.
  - Current schema enforces one `user` per organization in `staff_members`.

## Client and Asset Model

- `clients` many-to-1 `organizations`
- `assets` many-to-1 `clients`
- `assets` many-to-1 `organizations`
- `vehicle_profiles` 1-to-1 `assets`
  - `assets` is universal.
  - `vehicle_profiles` is auto-service specific.

## Service Catalog

- `service_categories` many-to-1 `organizations`
- `services` many-to-1 `service_categories`
- `services` many-to-1 `organizations`

## Order Workflow

- `orders` many-to-1 `organizations`
- `orders` many-to-1 `branches`
- `orders` many-to-1 `clients`
- `orders` many-to-1 `assets`
- `orders` many-to-1 `staff_members` as `created_by_staff_id`
- `orders` many-to-1 `staff_members` as `assigned_manager_id`

- `order_tasks` many-to-1 `orders`
- `order_tasks` many-to-1 `services`
- `order_tasks` many-to-1 `staff_members` as `assigned_worker_id`

- `order_task_parts` many-to-1 `order_tasks`
- `order_task_parts` many-to-1 `inventory_items`

## Inventory

- `inventory_items` many-to-1 `organizations`
- `inventory_items` many-to-1 `branches` (optional)
  - If `branch_id` is null, the item can act as organization-level stock/catalog.
  - If `branch_id` is set, the record is branch-scoped.

- `stock_movements` many-to-1 `inventory_items`
- `stock_movements` many-to-1 `staff_members` as `created_by_staff_id`

## Finance

- `payments` many-to-1 `orders`
- `payments` many-to-1 `staff_members` as `received_by_staff_id`

- `expenses` many-to-1 `organizations`
- `expenses` many-to-1 `branches` (optional)
- `expenses` many-to-1 `orders` as `related_order_id` (optional)
- `expenses` many-to-1 `staff_members` as `created_by_staff_id`

- `order_financials` 1-to-1 `orders`

## Audit

- `audit_logs` many-to-1 `organizations` (optional)
- `audit_logs` many-to-1 `users` (optional)

## High-Level Relationship Notes

- One client can own multiple assets.
- One order belongs to exactly one client and one asset.
- One order can contain many tasks.
- Each task can consume many inventory items through `order_task_parts`.
- One order can receive many payments.
- One order can have one financial snapshot in `order_financials`.
- Auto-specific data should stay in extension tables like `vehicle_profiles`, not inside `assets`.
