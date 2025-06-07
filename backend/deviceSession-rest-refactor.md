# Device Sessions Refactoring Plan

## Overview
Refactor the large `deviceSessions.ts` file to follow the same pattern as the games module, separating concerns into controllers, routes, types, and utilities.

## Step-by-Step Refactoring Plan

### 1. Create Type Definitions
#### 1.1 Update `types/rest-api.ts`
- Move all device session related interfaces from `deviceSessions.ts` to `types/rest-api.ts`
- Interfaces to move:
  - `DeviceSessionResponse`
  - `PlayerInfoResponse` (check for duplicates)
  - `GameInfoResponse` (check for duplicates)
  - `GetDeviceSessionResponse`
  - `GenerateDeviceIdResponse`
  - `CheckActiveSessionResponse`
  - `ActiveSessionInfo`
  - `GetActiveSessionsResponse`
  - `DeactivateSessionRequest`
  - `DeactivateSessionResponse`
  - `CleanupSessionsResponse`

#### 1.2 Export interfaces from `types/rest-api.ts`
- Add exports for all moved interfaces
- Update import statements in dependent files

### 2. Create Device Sessions Controller
#### 2.1 Create new file `controllers/deviceSessionsController.ts`
- Follow the pattern from `gamesController.ts`
- Add file header comment documenting the controller's purpose

#### 2.2 Move route handler functions to controller
- Move all async route handler functions:
  - `generateNewDeviceId`
  - `getDeviceSessionInfo`
  - `checkActiveSession`
  - `getGameActiveSessions`
  - `deactivateSession`
  - `cleanupSessions`
- Update function signatures to match controller pattern (if needed)
- Add JSDoc comments for each function

#### 2.3 Import necessary dependencies in controller
- Import types from `types/rest-api.ts`
- Import device session manager functions
- Import database utilities
- Import Express types (`Request`, `Response`)

### 3. Create/Update Utilities
#### 3.1 Create `utils/deviceSessionUtils.ts`
- Move transformation utility functions:
  - `transformDeviceSession`
  - `transformPlayer`
  - `transformGame`
- Make functions exportable
- Add proper TypeScript types

#### 3.2 Consider shared utilities
- Check if `transformPlayer` and `transformGame` could be shared across controllers
- If so, move to a shared utility file like `utils/transformers.ts`

### 4. Simplify Routes File
#### 4.1 Update `routes/deviceSessions.ts`
- Remove all business logic, types, and utilities
- Keep only router setup and route definitions
- Follow the pattern from `games.ts`

#### 4.2 Import controller functions
- Import all handler functions from `controllers/deviceSessionsController.ts`
- Update route definitions to use imported functions

#### 4.3 Clean up exports
- Remove individual function exports
- Keep only the default router export

### 5. Update Import Statements
#### 5.1 Update files importing from `routes/deviceSessions.ts`
- Search for any files importing specific functions from the routes file
- Update them to import from the new controller location if needed

#### 5.2 Update the main routes index
- Verify `routes/index.ts` still works correctly
- No changes should be needed if using default export

### 6. Testing and Validation
#### 6.1 Verify all imports resolve correctly
- Check that all moved types are properly imported
- Ensure no circular dependencies were created

#### 6.2 Test each endpoint
- Verify all device session endpoints still function correctly
- Check error handling paths
- Validate response formats match the interfaces

### 7. Documentation Updates
#### 7.1 Create/Update README
- Consider creating a `routes/README.md` section for device sessions
- Document all device session endpoints similar to the game routes documentation
- Include request/response examples

#### 7.2 Update inline documentation
- Ensure all functions have proper JSDoc comments
- Document any complex business logic
- Add TODO comments for any future improvements identified

### 8. Code Cleanup
#### 8.1 Remove redundant code
- Check for any duplicate type definitions across files
- Remove commented-out code
- Ensure consistent naming conventions

#### 8.2 Apply consistent formatting
- Ensure consistent indentation and spacing
- Apply the same code style as other controllers and routes
- Run any linting/formatting tools

## File Structure After Refactoring
```
backend/src/
├── controllers/
│   ├── deviceSessionsController.ts (new)
│   ├── gamesController.ts
│   ├── phrasesController.ts
│   └── playersController.ts
├── routes/
│   ├── deviceSessions.ts (simplified)
│   ├── games.ts
│   ├── phrases.ts
│   ├── players.ts
│   └── index.ts
├── types/
│   └── rest-api.ts (updated)
└── utils/
    ├── deviceSessionUtils.ts (new)
    └── transformers.ts (new/optional)
```
## Benefits of This Refactoring
- **Separation of Concerns**: Routes handle routing, controllers handle business logic
- **Reusability**: Utility functions can be shared across controllers
- **Maintainability**: Easier to find and modify specific functionality
- **Consistency**: Follows the established pattern in the codebase
- **Testability**: Easier to unit test individual components