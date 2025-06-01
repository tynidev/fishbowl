# PowerShell API Testing Suite

This directory contains a comprehensive collection of PowerShell scripts for testing the Fishbowl game API. These scripts provide automated testing capabilities for various aspects of the application including functionality, performance, error handling, and user workflows.

## Quick Start

1. **Start the backend server** (from the backend directory):
   ```bash
   npm run dev
   ```

2. **Run the main test menu**:
   ```powershell
   .\run-tests.ps1
   ```

## Test Scripts Overview

### 🎯 `run-tests.ps1` - Main Test Runner
**Purpose**: Central menu system to run all available tests with customizable parameters.

**Features**:
- Interactive menu interface
- Custom base URL configuration
- Parameter customization for each test type
- Organized test execution workflow

**Usage**:
```powershell
.\run-tests.ps1
```

### 🔧 `test-api.ps1` - Comprehensive API Testing
**Purpose**: Tests all API endpoints with various scenarios and validates responses.

**Features**:
- Complete API endpoint coverage
- Response validation
- Error handling verification
- Data integrity checks

**Usage**:
```powershell
.\test-api.ps1 [-baseUrl "http://localhost:3001"]
```

### 🎮 `test-game-lifecycle.ps1` - End-to-End Game Flow
**Purpose**: Tests complete game workflows from creation to phrase submission.

**Features**:
- Full game lifecycle testing
- Player management workflows
- Round progression testing
- Realistic game scenarios

**Usage**:
```powershell
.\test-game-lifecycle.ps1 [-baseUrl "http://localhost:3001"]
```

**Test Flow**:
1. Create new game with configuration
2. Add multiple players
3. Progress through game rounds
4. Submit phrases and validate scoring
5. Clean up test data

### ⚡ `test-load.ps1` - Performance & Load Testing
**Purpose**: Evaluates system performance under concurrent load conditions.

**Features**:
- Concurrent game creation testing
- Multiple simultaneous players
- Performance metrics collection
- Stress testing scenarios

**Usage**:
```powershell
.\test-load.ps1 [-baseUrl "http://localhost:3001"] [-concurrentGames 5] [-playersPerGame 6]
```

**Parameters**:
- `concurrentGames`: Number of games to create simultaneously (default: 5)
- `playersPerGame`: Number of players per game (default: 6)

### ⚙️ `test-config.ps1` - Configuration Testing
**Purpose**: Validates game configuration with all possible combinations and edge cases.

**Features**:
- Valid configuration testing
- Invalid parameter validation
- Edge case handling
- Boundary value testing

**Usage**:
```powershell
.\test-config.ps1 [-baseUrl "http://localhost:3001"]
```

**Test Coverage**:
- Team counts (2-8 teams)
- Round durations (30-300 seconds)
- Phrase counts (10-100 phrases)
- Invalid parameter handling

### 🚨 `test-errors.ps1` - Error Handling & Robustness
**Purpose**: Tests system robustness with malformed requests and error conditions.

**Features**:
- Malformed JSON testing
- Invalid endpoint testing
- Missing parameter validation
- Error response verification

**Usage**:
```powershell
.\test-errors.ps1 [-baseUrl "http://localhost:3001"]
```

**Test Types**:
- Invalid JSON payloads
- Missing required fields
- Non-existent game IDs
- Boundary value violations

### 🎛️ `test-console.ps1` - Interactive Testing Interface
**Purpose**: Provides an interactive command-line interface for manual API testing.

**Features**:
- Interactive menu system
- Real-time API testing
- State management
- Custom request building

**Usage**:
```powershell
.\test-console.ps1 [-baseUrl "http://localhost:3001"]
```

**Interactive Commands**:
- Create/join games
- Manage players
- Execute custom API calls
- View game state

### 📊 `test-monitor.ps1` - Continuous Performance Monitoring
**Purpose**: Provides continuous monitoring with performance alerts and detailed logging.

**Features**:
- Continuous performance monitoring
- Response time tracking
- Error rate monitoring
- Detailed logging and alerts

**Usage**:
```powershell
.\test-monitor.ps1 [-baseUrl "http://localhost:3001"] [-duration 300] [-interval 10]
```

**Parameters**:
- `duration`: Total monitoring duration in seconds (default: 300)
- `interval`: Check interval in seconds (default: 10)

## Configuration

### Default Settings
- **Base URL**: `http://localhost:3001`
- **Content Type**: `application/json`
- **Timeout**: 30 seconds per request

### Environment Variables
You can set the following environment variables to customize default behavior:
```powershell
$env:FISHBOWL_API_URL = "http://localhost:3001"
$env:FISHBOWL_TEST_TIMEOUT = "30"
```

## Common Parameters

All test scripts support the following common parameters:

| Parameter | Description | Default |
|-----------|-------------|---------|
| `-baseUrl` | API base URL | `http://localhost:3001` |
| `-verbose` | Enable verbose output | `false` |
| `-help` | Show help information | - |

## Test Data Management

### Automatic Cleanup
All test scripts automatically clean up test data after execution to prevent database pollution.

### Manual Cleanup
If tests are interrupted, you can manually clean up test data:
```powershell
# Get all games and delete test games
$games = Invoke-RestMethod -Uri "$baseUrl/games" -Method GET
$games | Where-Object { $_.name -like "*Test*" } | ForEach-Object {
    Invoke-RestMethod -Uri "$baseUrl/games/$($_.id)" -Method DELETE
}
```

## Troubleshooting

### Common Issues

1. **Server Not Running**
   ```
   Error: Unable to connect to server
   Solution: Start the backend server with 'npm run dev'
   ```

2. **Port Conflicts**
   ```
   Error: Connection refused
   Solution: Check if port 3001 is available or update baseUrl
   ```

3. **Permission Issues**
   ```
   Error: Execution policy
   Solution: Run 'Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser'
   ```

### Debug Mode
Run any script with `-verbose` flag for detailed debugging information:
```powershell
.\test-api.ps1 -verbose
```

## Integration with Development Workflow

### Pre-commit Testing
Run comprehensive tests before committing:
```powershell
.\run-tests.ps1
# Select option 1 (All Tests) from the menu
```

### CI/CD Integration
These scripts can be integrated into CI/CD pipelines:
```yaml
# Example GitHub Actions step
- name: Run API Tests
  run: |
    cd backend/tests/powershell
    pwsh -File run-tests.ps1 -automated
```

## Contributing

When adding new test scripts:
1. Follow the naming convention: `test-[purpose].ps1`
2. Include proper parameter documentation
3. Implement cleanup functionality
4. Add entry to `run-tests.ps1` menu
5. Update this README with script documentation

## API Coverage

These tests cover all major API endpoints:

- **Games**: Create, read, update, delete
- **Players**: Join, leave, manage
- **Configuration**: Team settings, round timing, phrase counts
- **Gameplay**: Round progression, phrase submission, scoring
- **Device Sessions**: Session management, player devices

## Performance Benchmarks

Expected performance characteristics:
- **Game Creation**: < 100ms
- **Player Join**: < 50ms
- **Configuration Update**: < 200ms
- **Concurrent Load (5 games)**: All operations < 500ms

## Support

For issues or questions about the testing suite:
1. Check the troubleshooting section above
2. Review individual script documentation
3. Examine verbose output for debugging information
4. Check server logs for backend-related issues
