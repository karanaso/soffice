# data-persistence Specification

## Purpose

Defines how the application stores documents behind one behavior contract while allowing the same build to run on a local SQLite database or a shared PostgreSQL database.

## Requirements

### Requirement: Selectable database backend

The system SHALL read the database backend from configuration at startup. SQLite SHALL be used when no backend is configured, and PostgreSQL SHALL be used when a PostgreSQL connection URL is provided. An unsupported backend or unusable connection setting SHALL stop startup with an error that names the offending setting and does not include credentials.

#### Scenario: Start with default configuration
- **WHEN** the application starts without a database backend configured
- **THEN** it uses a SQLite database at the configured or default data location

#### Scenario: Start with PostgreSQL
- **WHEN** the application starts with a valid PostgreSQL connection URL
- **THEN** it connects to PostgreSQL and performs all document operations there

#### Scenario: Invalid database configuration
- **WHEN** the configured backend is unsupported or its connection settings are invalid
- **THEN** startup fails with a message identifying the setting, and any password in the configuration is not printed

### Requirement: Identical storage behavior across backends

The system SHALL expose one document storage contract used by all features, and the same request SHALL produce the same observable outcome on SQLite and PostgreSQL. The contract SHALL cover listing, creating, reading, renaming, and deleting documents, including stable identifiers and creation and modification timestamps.

#### Scenario: Same operation on both backends
- **WHEN** the same sequence of document operations is performed against SQLite and against PostgreSQL
- **THEN** both produce equivalent documents, ordering, and error outcomes

#### Scenario: Data survives restart
- **WHEN** a document is created and the application is restarted against the same database
- **THEN** the document is still listed with the same identifier, name, type, and timestamps

### Requirement: Document names are unique regardless of case

Storage SHALL enforce that no two documents share a name when compared case-insensitively. Concurrent attempts to create or rename to the same name SHALL result in exactly one success and a conflict outcome for the others.

#### Scenario: Concurrent duplicate creation
- **WHEN** two create requests use the same name in different letter case at the same time
- **THEN** one document is created and the other request reports a name conflict

#### Scenario: Rename collision is rejected
- **WHEN** a rename would make two documents share a name regardless of case
- **THEN** storage rejects the rename and the original names remain unchanged

### Requirement: Schema is prepared automatically

The system SHALL apply all pending database schema changes during startup before serving requests. Migrations SHALL be safe to re-run, SHALL preserve existing documents, and a failed migration SHALL stop startup rather than serve requests against a partial schema.

#### Scenario: First startup
- **WHEN** the application starts against an empty database
- **THEN** it creates the current schema and begins serving requests

#### Scenario: Repeat startup
- **WHEN** the application starts against a database that already has the current schema
- **THEN** startup succeeds without duplicating schema objects or losing documents

#### Scenario: Migration failure
- **WHEN** a migration fails during startup
- **THEN** the application does not begin serving requests and reports the migration failure

### Requirement: Storage health is observable

The system SHALL provide a health endpoint that reports whether the application is running and whether the configured database is reachable. The response SHALL identify the active backend but SHALL NOT expose connection strings, credentials, or document contents.

#### Scenario: Healthy storage
- **WHEN** the health endpoint is requested while the configured database is reachable
- **THEN** it reports a healthy application and storage along with the backend type

#### Scenario: Unreachable storage
- **WHEN** the health endpoint is requested while the configured database is unreachable
- **THEN** it reports storage as unhealthy with a non-sensitive reason and a non-success status
