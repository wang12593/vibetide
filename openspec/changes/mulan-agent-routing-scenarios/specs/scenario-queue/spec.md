## ADDED Requirements

### Requirement: Scenario Product Naming

User-facing workflow concepts SHALL be named "场景".

#### Scenario: Navigation and pages use scenario naming

- **WHEN** a user views navigation, page titles, buttons, cards, empty states, and confirmations for reusable workflows
- **THEN** the UI uses "场景" instead of "工作流"

#### Scenario: Internal workflow schema remains compatible

- **WHEN** scenario UI reads or writes existing workflow template data
- **THEN** it continues using the existing internal schema and identifiers
- **AND** no database table rename is required for this change

### Requirement: BullMQ-only Async Dispatch

New or modified asynchronous intent, scenario, and Mission dispatch SHALL use BullMQ.

#### Scenario: No Inngest runtime dependency

- **WHEN** runtime source code and package dependencies are inspected
- **THEN** no Inngest package or runtime integration is required for intent, scenario, or Mission dispatch

#### Scenario: Queue definitions have workers or are removed

- **WHEN** a BullMQ queue is defined for intent, scenario, or Mission dispatch
- **THEN** the project registers a worker for that queue
- **OR** removes the unused queue definition

#### Scenario: Documentation matches runtime

- **WHEN** OpenSpec project context and developer documentation describe background jobs
- **THEN** they describe BullMQ and Redis-backed workers
- **AND** they do not describe Inngest as the active background job system
