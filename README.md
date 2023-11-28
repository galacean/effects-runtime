# Galacean Effects Runtime

Galacean Effects runtime, It can load and render cool animation effects, The APIs provided by effects-core allow your engine to quickly access animation data such as layer and particle animation.

## [Integration Guide](https://galacean.antgroup.com/effects/#/user/ti4f2yx1rot4hs1n)

## [API Documentation](https://galacean.antgroup.com/effects/#/api)

## Development

### Environment Setup

- Node.js `>= 16.0.0`
- [Pnpm](https://pnpm.io/)  `latest`
  - Install:
    - `npm install -g pnpm`
  - Upgrade：
    - `pnpm install -g pnpm`

### Getting Started

``` bash
# 1. Install dependencies (first time)
pnpm install
# 2. Start the demo
pnpm dev
```

> Open in browser: http://localhost:8080/

## Plugin Example

``` bash
# demo
pnpm --filter @galacean/xxx dev
```

> Open in browser: http://localhost:8081/demo/

### Low-End Device Testing

``` bash
# Run the legacy version of the demo
pnpm preview
```

## Testing

``` bash
pnpm test
```

> Open in browser: http://localhost:9090/

### Installing Single Packages

``` bash
# Install to the root directory
pnpm add ajv@^6.5.3 -w -D
# Install to a specific package
pnpm add ajv@^6.5.3 --filter @galacean/effects-core
```

## Other Commands

``` bash
# lint
pnpm lint
# Type checking
pnpm check:ts
# Clean all ignore files
pnpm clean:all
# Build packages
pnpm build
# Build plugins
pnpm build:plugins
# Generate API documentation
pnpm build:docs
# Build a specific package
pnpm --filter @galacean/xxx build
```
