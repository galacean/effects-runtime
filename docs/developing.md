# How to build Galacean Effects and the examples

## Prerequisites

- Node.js `>= 16.0.0`
- [Pnpm](https://pnpm.io/)  `latest`
  - Install:
    - `npm install -g pnpm`
  - Upgrade：
    - `pnpm install -g pnpm`

## Quick Start

``` bash
# 1. clone from github
git clone https://github.com/galacean/effects-runtime \
  && cd effects-runtime
# 2. Install dependencies (first time)
pnpm install
# 3. Start the demo
pnpm dev
```

> Open in browser: http://localhost:8080/

## Build

``` bash
# Build packages
pnpm build
# Build plugins
pnpm build:plugins
```

## Plugin Example

``` bash
# demo
pnpm --filter @galacean/xxx dev
```

> Open in browser: http://localhost:8081/demo/

## Testing

``` bash
pnpm test
```

> Open in browser: http://localhost:9090/

### Low-End Device Testing

``` bash
# Run the legacy version of the demo
pnpm preview
```

## Other Commands

``` bash
# lint
pnpm lint
# Type checking
pnpm check:ts
# Clean all ignore files
pnpm clean:all
# Generate API documentation
pnpm build:docs
# Build a specific package
pnpm --filter @galacean/xxx build
```

Installing Single Packages:

``` bash
# Install to the root directory
pnpm add ajv@^6.5.3 -w -D
# Install to a specific package
pnpm add ajv@^6.5.3 --filter @galacean/effects-core
```
