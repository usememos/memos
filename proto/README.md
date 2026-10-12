# Guide

## Prerequisites

- [buf](https://docs.buf.build/installation)

## Generate

```sh
buf generate
```

## Format

```sh
buf format -w
```

## Deployment settings

Instance setting JSON files use the same `store.InstanceSetting` schema as storage. Usage limits explicitly set
`allUsers: {}` for an all-users default or `userId: <positive integer>` for a user. A reload with invalid configuration
leaves the active configuration intact.
