# CLAUDE.md - Memos Project Documentation

## Project Overview

**Memos** is a modern, open-source, self-hosted knowledge management and note-taking platform designed for privacy-conscious users and organizations. It provides a lightweight yet powerful solution for capturing, organizing, and sharing thoughts with comprehensive Markdown support and cross-platform accessibility.

### Key Technologies

- **Backend**: Go 1.24 with gRPC and Protocol Buffers
- **Frontend**: React 18 with TypeScript, Vite, and Tailwind CSS
- **Database**: SQLite (default), MySQL, PostgreSQL support
- **API**: RESTful HTTP/gRPC with grpc-gateway
- **Authentication**: JWT-based with OAuth2 providers

## Architecture Overview

### Backend Structure

```text
server/
├── router/
│   ├── api/v1/          # API v1 services and handlers
│   ├── frontend/        # Static frontend assets
│   └── rss/            # RSS feed generation
├── runner/             # Background job runners
└── profiler/           # Performance profiling
```

### Protocol Buffers & API

```text
proto/
├── api/v1/             # Public API definitions
│   ├── user_service.proto
│   ├── workspace_service.proto
│   ├── shortcut_service.proto
│   ├── idp_service.proto
│   └── webhook_service.proto
└── store/              # Internal data structures
    ├── workspace_setting.proto
    ├── user_setting.proto
    └── ...
```

### Data Layer

```text
store/
├── db/                 # Database drivers
│   ├── sqlite/
│   ├── mysql/
│   └── postgres/
├── migration/          # Database migrations
├── cache/              # Caching layer
└── test/               # Test utilities
```

## Recent Major Refactoring: Google AIP Compliance

### Overview

We recently completed a comprehensive refactoring to align the API with Google API Improvement Proposals (AIP) for resource-oriented API design. This involved updating protocol buffers, backend services, and frontend TypeScript code.

### Key Changes Made

#### 1. Protocol Buffer Refactoring

- **Resource Patterns**: Implemented standard resource naming (e.g., `users/{user}`, `workspace/settings/{setting}`)
- **Field Behaviors**: Added proper field annotations (`REQUIRED`, `OUTPUT_ONLY`, `IMMUTABLE`)
- **HTTP Annotations**: Updated REST mappings to follow RESTful conventions
- **Service Consolidation**: Merged `workspace_setting_service.proto` into `workspace_service.proto`

#### 2. Backend Service Updates

- **Resource Name Handling**: Added robust parsing for resource names
- **Method Signatures**: Updated to use resource names instead of raw IDs
- **Error Handling**: Improved error responses with proper gRPC status codes
- **Permission Checks**: Enhanced authorization based on user roles

#### 3. Frontend TypeScript Migration

- **Resource Name Utilities**: Helper functions for extracting IDs from resource names
- **State Management**: Updated MobX stores to use new resource formats
- **Component Updates**: React components now handle new API structures
- **Type Safety**: Enhanced TypeScript definitions for better type checking

## Development Workflow

### Code Quality Standards

- **golangci-lint**: Comprehensive linting with 15+ linters enabled
- **Protocol Buffer Generation**: `buf generate` for type-safe API generation
- **Frontend Linting**: ESLint + TypeScript strict mode

### Build Process

```bash
# Backend build
sh ./scripts/build.sh

# Frontend build
cd web && pnpm build

# Protocol buffer generation
cd proto && buf generate

# Linting
golangci-lint run --timeout=3m
cd web && pnpm lint
```

### Testing Commands

```bash
# Run all tests
go test ./...

# Specific service tests
go test ./server/router/api/v1/... -v

# Test with coverage
go test -cover ./...
```

## Frontend Architecture

### Technology Stack

- **React 18**: Modern React with hooks and functional components
- **TypeScript**: Strict type checking for better development experience
- **Vite**: Fast build tool and development server
- **Tailwind CSS**: Utility-first CSS framework
- **MobX**: State management for reactive data flows

### Key Components

```text
web/src/
├── components/          # Reusable UI components
├── pages/              # Route-based page components
├── store/              # MobX state management
│   └── v2/             # Updated stores for AIP compliance
├── types/              # TypeScript type definitions
│   └── proto/          # Generated from Protocol Buffers
└── utils/              # Utility functions and helpers
```

## API Design Principles

### Resource-Oriented Design

Following Google AIP standards:

- **Resource Names**: Hierarchical, human-readable identifiers
- **Standard Methods**: List, Get, Create, Update, Delete patterns
- **Field Behaviors**: Clear annotations for API contracts
- **HTTP Mapping**: RESTful URL structures

### Error Handling

- **gRPC Status Codes**: Proper error classification
- **Detailed Messages**: Helpful error descriptions
- **Field Validation**: Input validation with clear feedback

### Authentication & Authorization

- **JWT Tokens**: Stateless authentication
- **Role-Based Access**: Host, User role differentiation
- **Context Propagation**: User context through request pipeline

## Database Schema

### Core Entities

- **Users**: User accounts with roles and permissions
- **Workspaces**: Workspace configuration and settings
- **Identity Providers**: OAuth2 and other auth providers
- **Webhooks**: External integration endpoints
- **Shortcuts**: User-defined quick actions

### Migration Strategy

- **Version-Controlled**: Database schema changes tracked
- **Multi-Database**: Support for SQLite, MySQL, PostgreSQL
- **Backward Compatibility**: Careful migration planning

## Deployment Options

### Docker

```dockerfile
# Multi-stage build for optimized images
FROM golang:1.24-alpine AS backend
FROM node:18-alpine AS frontend
FROM alpine:latest AS production
```

### Configuration

- **Environment Variables**: Runtime configuration
- **Profile-Based**: Development, staging, production profiles
- **Database URLs**: Flexible database connection strings

## Contributing Guidelines

### Code Standards

1. **Protocol Buffers**: Follow AIP guidelines for new services
2. **Go Code**: Use `golangci-lint` configuration
3. **TypeScript**: Strict mode with comprehensive type checking
4. **Testing**: Write tests for new features using TestService helpers

### Pull Request Process

1. **Lint Checking**: All linters must pass
2. **Test Coverage**: New code should include tests
3. **Documentation**: Update relevant documentation
4. **AIP Compliance**: New APIs should follow [AIP](https://google.aip.dev/) standards
