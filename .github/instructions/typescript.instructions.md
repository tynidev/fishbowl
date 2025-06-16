---
applyTo: '**/*.ts?(x)'
---
# GitHub Copilot Instructions for TypeScript/React Development

## Project Context
This is a TypeScript/React application. When generating code, follow these guidelines:

## Code Style & Conventions

## Patterns to Follow
- Use early returns to reduce nesting
- Reduce nesting where possible

### TypeScript
- Use TypeScript strict mode
- Prefer explicit type annotations over type inference for function parameters and return types
- Use interfaces for object shapes, types for unions/intersections
- Avoid using `any` type - use `unknown` or proper types instead
- Use const assertions where appropriate
- Prefer named exports over default exports

### Component Structure
```typescript
// 1. Imports
// 2. Type definitions
// 3. Component definition
// 4. Styled components (if using styled-components)
// 5. Helper functions
```

### Testing
- Write unit tests using Jest and React Testing Library
- Test user behavior, not implementation details
- Aim for high coverage on business logic
- Use data-testid attributes for test selection

## Dependencies to Prefer
- Testing: Jest

## Code Quality
- Implement proper TypeScript types (no implicit any)
- Write self-documenting code with clear variable names

## Security
- Sanitize user inputs
- Use environment variables for sensitive data
- Keep dependencies updated

When generating code, prioritize:
1. Type safety
2. Readability
3. Performance
4. Maintainability
5. Testability