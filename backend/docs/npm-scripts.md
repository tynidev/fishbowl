# Backend NPM Scripts Documentation

This document explains what each npm script in the backend package.json does and when to use them.

## Production Scripts

### `npm start`
```bash
npm start
```
- **Command**: `node dist/server.js`
- **Purpose**: Starts the production server using the compiled JavaScript
- **Prerequisites**: Must run `npm run build` first to compile TypeScript
- **Use case**: Running the server in production or testing the built version
- **Port**: Default 5000 (configurable via PORT environment variable)

## Development Scripts

### `npm run dev`
```bash
npm run dev
```
- **Command**: `nodemon --exec ts-node src/server.ts`
- **Purpose**: Starts the development server with auto-restart on file changes
- **Features**:
  - Automatically restarts when TypeScript files change
  - Runs TypeScript directly without compilation step
  - Hot reload for faster development
- **Use case**: Primary development command
- **Port**: Default 5000

## Build Scripts

### `npm run build`
```bash
npm run build
```
- **Command**: `tsc`
- **Purpose**: Compiles TypeScript source code to JavaScript
- **Output**: Creates `dist/` directory with compiled JavaScript files
- **Features**:
  - Type checking during compilation
  - Generates source maps (if configured)
  - Follows tsconfig.json configuration
- **Use case**: Preparing for production deployment or testing compiled version

### `npm run clean`
```bash
npm run clean
```
- **Command**: `rimraf dist`
- **Purpose**: Removes the compiled JavaScript output directory
- **Use case**: 
  - Clean build (run before `npm run build`)
  - Removing old compiled files
  - Troubleshooting build issues

## Database Scripts

### `npm run migrate`
```bash
npm run migrate
```
- **Command**: `ts-node scripts/migrate.ts`
- **Purpose**: Runs database migrations to set up or update database schema
- **Features**:
  - Creates database tables
  - Updates existing schema
  - Applies database migrations in order
- **Use case**: 
  - First-time database setup
  - Applying schema changes
  - Database updates during development

## Testing Scripts

### `npm test`
```bash
npm test
```
- **Command**: `jest`
- **Purpose**: Runs the full test suite once
- **Features**:
  - Runs all test files (*.test.ts, *.spec.ts)
  - Displays test results and failures
  - Exits when complete
- **Use case**: 
  - CI/CD pipelines
  - Pre-commit verification
  - Final testing before deployment

### `npm run test:coverage`
```bash
npm run test:coverage
```
- **Command**: `jest --coverage`
- **Purpose**: Runs tests and generates code coverage report
- **Output**: 
  - Coverage report in terminal
  - HTML coverage report in `coverage/` directory
- **Features**:
  - Line coverage percentage
  - Function coverage
  - Branch coverage
  - Statement coverage
- **Use case**: 
  - Ensuring adequate test coverage
  - Identifying untested code paths
  - Code quality metrics

### `npm run test:watch`
```bash
npm run test:watch
```
- **Command**: `jest --watch`
- **Purpose**: Runs tests in watch mode with auto-rerun on file changes
- **Features**:
  - Automatically reruns tests when files change
  - Interactive mode with options to filter tests
  - Faster feedback during development
- **Use case**: 
  - Test-driven development (TDD)
  - Continuous testing during development
  - Quick feedback on code changes

## Code Quality Scripts

### `npm run format`
```bash
npm run format
```
- **Command**: `prettier --write src/**/*.{ts,tsx}`
- **Purpose**: Automatically formats all TypeScript files according to Prettier rules
- **Features**:
  - Fixes formatting issues
  - Applies consistent code style
  - Modifies files in place
- **Use case**: 
  - Before committing code
  - Fixing code style issues
  - Maintaining consistent formatting

### `npm run format:check`
```bash
npm run format:check
```
- **Command**: `prettier --check src/**/*.{ts,tsx}`
- **Purpose**: Checks if files follow Prettier formatting rules without modifying them
- **Features**:
  - Non-destructive check
  - Lists files that need formatting
  - Exits with error code if formatting issues found
- **Use case**: 
  - CI/CD pipeline validation
  - Pre-commit hooks
  - Verifying code style compliance

## Common Workflows

### Development Workflow
```bash
# 1. Install dependencies
npm install

# 2. Set up database
npm run migrate

# 3. Start development server
npm run dev
```

### Testing Workflow
```bash
# Run tests during development
npm run test:watch

# Check coverage
npm run test:coverage

# Final test run
npm test
```

### Production Deployment
```bash
# 1. Clean previous build
npm run clean

# 2. Build for production
npm run build

# 3. Start production server
npm start
```

### Code Quality Check
```bash
# Check formatting
npm run format:check

# Fix formatting
npm run format

# Run tests
npm test
```

## Environment Variables

These scripts respect the following environment variables:

- **PORT**: Server port (default: 5000)
- **NODE_ENV**: Environment mode (development/production)
- **DATABASE_PATH**: SQLite database file path
- **DEBUG**: Enable debug logging

## Troubleshooting

### Common Issues

1. **Port already in use**: Change PORT environment variable
2. **TypeScript errors**: Check tsconfig.json and ensure types are installed
3. **Database errors**: Run `npm run migrate` to set up database
4. **Test failures**: Check test setup and database state
5. **Build failures**: Run `npm run clean` then `npm run build`
