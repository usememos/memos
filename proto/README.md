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

Instance setting JSON files use the same `store.InstanceSetting` schema as storage. A usage limits file is the ordered
entry list; the last entry sets `allUsers: true`, every other entry lists positive `userIds`. A reload with invalid
configuration leaves the active configuration intact.
