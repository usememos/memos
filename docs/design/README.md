# Design Documents

Design documents may evolve while a feature is being designed and implemented. Once implementation is complete, set `Status: Implemented` and freeze the document.

Do not update implemented designs to track later code changes. They preserve the original design and rationale; source code and tests describe current
behavior. New and unimplemented designs may still be added or revised.

The following designs have been implemented and are frozen:

- [API abuse controls](api-abuse-controls.md)
- [Configuration provisioning](configuration-provisioning.md)
- [Memos Export Format](memos-export-format.md), including the schemas under `memo-export/1.0/`
- [Multi-Spaces](multi-spaces.md)
- [Unique email](unique-email.md)

The configuration provisioning design was moved here from `docs/configuration-provisioning.md` and frozen after implementation.
