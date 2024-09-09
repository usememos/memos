<p align="center">
  <a href="https://clerk.com?utm_source=github&utm_medium=clerk_types" target="_blank" rel="noopener noreferrer">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://images.clerk.com/static/logo-dark-mode-400x400.png">
      <img src="https://images.clerk.com/static/logo-light-mode-400x400.png" height="64">
    </picture>
  </a>
  <br />
  <h1 align="center">@clerk/types</h1>
</p>

<div align="center">

[![Chat on Discord](https://img.shields.io/discord/856971667393609759.svg?logo=discord)](https://clerk.com/discord)
[![Clerk documentation](https://img.shields.io/badge/documentation-clerk-green.svg)](https://clerk.com/docs?utm_source=github&utm_medium=clerk_types)
[![Follow on Twitter](https://img.shields.io/twitter/follow/ClerkDev?style=social)](https://twitter.com/intent/follow?screen_name=ClerkDev)

[Changelog](https://github.com/clerk/javascript/blob/main/packages/types/CHANGELOG.md)
·
[Report a Bug](https://github.com/clerk/javascript/issues/new?assignees=&labels=needs-triage&projects=&template=BUG_REPORT.yml)
·
[Request a Feature](https://feedback.clerk.com/roadmap)
·
[Get help](https://clerk.com/contact/support?utm_source=github&utm_medium=clerk_types)

</div>

---

## Getting Started

This package provides the TypeScript type declarations for Clerk's SDKs.

> [!NOTE]
> Clerk's SDKs automatically include their own type definitions so typically it's not necessary to install `@clerk/types` separately.

### Installation

```sh
npm install @clerk/types --save-dev
```

## Usage

Import types from `@clerk/types` like so:

```ts
import type { OAuthStrategy } from '@clerk/types';

export type OAuthProps = {
  oAuthOptions: OAuthStrategy[];
  error?: string;
  setError?: React.Dispatch<React.SetStateAction<string | undefined>>;
};
```

You can also [override Clerk interfaces with custom types](https://clerk.com/docs/guides/custom-types?utm_source=github&utm_medium=clerk_types).

## Support

You can get in touch with us in any of the following ways:

- Join our official community [Discord server](https://clerk.com/discord)
- On [our support page](https://clerk.com/contact/support?utm_source=github&utm_medium=clerk_types)

## Contributing

We're open to all community contributions! If you'd like to contribute in any way, please read [our contribution guidelines](https://github.com/clerk/javascript/blob/main/docs/CONTRIBUTING.md) and [code of conduct](https://github.com/clerk/javascript/blob/main/docs/CODE_OF_CONDUCT.md).

## Security

`@clerk/types` follows good practices of security, but 100% security cannot be assured.

`@clerk/types` is provided **"as is"** without any **warranty**. Use at your own risk.

_For more information and to report security issues, please refer to our [security documentation](https://github.com/clerk/javascript/blob/main/docs/SECURITY.md)._

## License

This project is licensed under the **MIT license**.

See [LICENSE](https://github.com/clerk/javascript/blob/main/packages/types/LICENSE) for more information.
