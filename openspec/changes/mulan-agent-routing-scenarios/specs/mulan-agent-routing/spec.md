## ADDED Requirements

### Requirement: Mulan as the Authenticated Home Agent

Authenticated users SHALL enter the product through the Mulan agent surface at `/home`, not through a landing or onboarding page.

#### Scenario: Authenticated root visit

- **GIVEN** a signed-in user
- **WHEN** the user opens `/`
- **THEN** the system redirects the user to `/home`
- **AND** `/home` displays the Mulan agent interaction surface

#### Scenario: Landing page is not exposed

- **WHEN** navigation, root routing, and public app routes are inspected
- **THEN** no active landing or onboarding page is exposed as the primary product entry

### Requirement: Mulan-owned Employee Launching

Employee-related actions initiated from Mulan SHALL be launched inside the Mulan interface.

#### Scenario: Single employee recommendation

- **GIVEN** the user asks Mulan for help that maps to one employee
- **WHEN** Mulan finishes intent recognition
- **THEN** Mulan displays a single employee recommendation card inside the Mulan interface
- **AND** confirming the card starts the employee interaction without redirecting to `/chat`

#### Scenario: Multi-employee group recommendation

- **GIVEN** the user asks Mulan for work requiring multiple employees
- **WHEN** Mulan recommends a team
- **THEN** Mulan displays a group creation recommendation inside the Mulan interface
- **AND** confirming the recommendation creates the group chat inline
- **AND** the user remains in the Mulan interface

### Requirement: Mulan Three-layer Routing

Mulan SHALL route user messages through three product layers: simple LLM conversation, employee or scenario recommendation, and complex Mission creation.

#### Scenario: Simple conversation

- **WHEN** the user sends a greeting, casual question, or low-complexity message
- **THEN** Mulan responds directly through the LLM conversation path
- **AND** no employee, scenario, group, or Mission is created

#### Scenario: Employee before scenario

- **WHEN** a user request can reasonably match both a specific employee and a scenario
- **THEN** Mulan prioritizes the employee recommendation
- **AND** the scenario is only used when no employee match is sufficiently confident or the user explicitly asks for a reusable process

#### Scenario: Scenario before Mission

- **WHEN** a user request matches a reusable scenario but does not require new multi-step planning
- **THEN** Mulan recommends that scenario
- **AND** no Mission is created until the user confirms execution

#### Scenario: Complex task creates Mission

- **WHEN** a user request requires multiple coordinated steps, multiple employees, or persisted task progress
- **THEN** Mulan creates a Mission after confirmation
- **AND** the Mission status and involved employees are shown inside the Mulan interface

### Requirement: Skills Excluded from Mulan Routing Targets

Mulan intent recognition SHALL NOT expose skills as direct routing targets.

#### Scenario: Intent output excludes skills

- **WHEN** `/api/chat/intent` returns a Mulan routing result
- **THEN** the result target is one of `llm`, `employee`, `scenario`, or `mission`
- **AND** the response does not ask the Mulan UI to render or launch a skill directly

#### Scenario: Employee internals may still use skills

- **GIVEN** an employee has skills configured internally
- **WHEN** that employee handles a user task
- **THEN** the employee execution logic may use its skills
- **AND** those skills are not displayed as Mulan-level route targets

### Requirement: Mulan Pinned in Chat Center

The chat center SHALL keep Mulan as the first and default employee entry.

#### Scenario: Chat center opens

- **WHEN** a user opens `/chat` without selecting another employee
- **THEN** Mulan is selected by default
- **AND** Mulan appears before other employees in the employee list
