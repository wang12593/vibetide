# Project Constitution

## Project: Vibetide (Vibe Media)

### Version: 0.1.0

### Ratification Date: [PENDING]

### Last Amended: [PENDING]

---

## Principles

### Principle 1: Spec-Driven Development
All features MUST be specified before implementation. Specifications serve as the source of truth for what the system should do.

### Principle 2: AI-First Architecture
The system is designed around AI employees collaborating on content workflows. All features MUST consider the AI agent interaction model.

### Principle 3: Multi-Tenant Isolation
All data operations MUST be scoped by `organization_id`. Cross-tenant data access is strictly prohibited.

### Principle 4: Glass UI Consistency
All UI components MUST use shared primitives (GlassCard, Button, Input, etc. from `@/components/`). Custom styling overrides are prohibited.

### Principle 5: Chinese-First UX
All user-facing text MUST be in Simplified Chinese. English is only acceptable in code comments and technical identifiers.

---

## Governance

### Amendment Procedure
1. Propose changes via Spec Kit `/constitution` command
2. Review with project stakeholders
3. Update version following semantic versioning
4. Propagate changes to dependent templates

### Versioning Policy
- MAJOR: Breaking principle changes
- MINOR: New principles or expanded guidance
- PATCH: Clarifications and wording fixes

### Compliance Review
- All new features MUST pass constitution compliance check before implementation
- UI components MUST pass design system compliance
- Data operations MUST pass multi-tenant isolation check
