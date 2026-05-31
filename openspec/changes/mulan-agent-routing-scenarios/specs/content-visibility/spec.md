## ADDED Requirements

### Requirement: Personal Custom Content Visibility

Custom employees, skills, and scenarios SHALL be visible only to their creator unless the viewer is an administrator.

#### Scenario: Creator sees own custom content

- **GIVEN** a non-admin user creates a custom employee, skill, or scenario
- **WHEN** that user opens the corresponding list page
- **THEN** the custom item is visible to that user

#### Scenario: Other non-admin users do not see it

- **GIVEN** user A creates a custom employee, skill, or scenario
- **WHEN** user B from the same organization opens the corresponding list page
- **THEN** user B does not see user A's custom item

#### Scenario: Administrator sees all organization custom content

- **GIVEN** users in the same organization have created custom employees, skills, or scenarios
- **WHEN** an administrator opens the corresponding list page
- **THEN** the administrator can see all custom items in that organization

### Requirement: Custom Content Mutation Authorization

Custom employee, skill, and scenario mutations SHALL be allowed only for the creator or an administrator.

#### Scenario: Creator updates custom content

- **GIVEN** a non-admin user owns a custom employee, skill, or scenario
- **WHEN** that user updates or deletes the item
- **THEN** the mutation succeeds if all validation rules pass

#### Scenario: Non-owner mutation is rejected

- **GIVEN** user A owns a custom employee, skill, or scenario
- **WHEN** non-admin user B attempts to update or delete that item through a Server Action or API route
- **THEN** the system rejects the mutation
- **AND** the item remains unchanged

#### Scenario: Administrator mutates organization content

- **GIVEN** an administrator and a custom employee, skill, or scenario in the same organization
- **WHEN** the administrator updates or deletes the item
- **THEN** the mutation succeeds if all validation rules pass

### Requirement: Custom Employee Ownership

Custom employee creation SHALL persist the creator identity.

#### Scenario: Employee owner is stored

- **WHEN** a user creates a custom employee
- **THEN** the created employee row stores `createdBy` as that user's id
- **AND** subsequent visibility checks can identify the owner
