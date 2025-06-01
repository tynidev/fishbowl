# PowerShell API Testing Suite Runner
# Main entry point for all API testing scripts

param(
    [string]$BaseUrl = "http://localhost:3001/api",
    [string]$TestType = "menu"
)

function Show-Menu {
    Clear-Host
    Write-Host "????????????????????????????????????????????????????????????????" -ForegroundColor Cyan
    Write-Host "?                 FISHBOWL API TESTING SUITE                   ?" -ForegroundColor Cyan
    Write-Host "????????????????????????????????????????????????????????????????" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Base URL: $BaseUrl" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Available Test Scripts:" -ForegroundColor Yellow
    Write-Host " 1. [*] Complete API Test          - Run comprehensive API tests" -ForegroundColor White
    Write-Host " 2. [>] Game Lifecycle Test        - Test full game flow" -ForegroundColor White
    Write-Host " 3. [!] Load Testing               - Test performance under load" -ForegroundColor White
    Write-Host " 4. [+] Configuration Testing      - Test all config combinations" -ForegroundColor White
    Write-Host " 5. [X] Error Handling Tests       - Test error scenarios" -ForegroundColor White
    Write-Host " 6. [-] Interactive Console        - Manual testing interface" -ForegroundColor White
    Write-Host " 7. [@] Performance Monitor        - Continuous monitoring" -ForegroundColor White
    Write-Host " 8. [#] Custom Test Parameters     - Run with custom settings" -ForegroundColor White
    Write-Host ""
    Write-Host " 0. Exit" -ForegroundColor Gray
    Write-Host ""
}

function Run-TestScript {
    param($ScriptName, $Parameters = @{})
    
    $scriptPath = Join-Path $PSScriptRoot $ScriptName
    
    if (-not (Test-Path $scriptPath)) {
        Write-Host "Script not found: $scriptPath" -ForegroundColor Red
        return
    }
    
    Write-Host "`nRunning: $ScriptName" -ForegroundColor Cyan
    Write-Host ""
    
    try {
        if ($Parameters.Count -gt 0) {
            & $scriptPath @Parameters
        } else {
            & $scriptPath -BaseUrl $BaseUrl
        }
    }
    catch {
        Write-Host "Error running script: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Write-Host "`nScript completed. Press any key to return to menu..." -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

function Get-CustomParameters {
    Write-Host "Custom Test Parameters:" -ForegroundColor Yellow
    Write-Host ""
    
    $baseUrl = Read-Host "Base URL [$BaseUrl]"
    if (-not $baseUrl) { $baseUrl = $BaseUrl }
    
    $playerCount = Read-Host "Number of players per game [4]"
    if (-not $playerCount -or -not [int]::TryParse($playerCount, [ref]$null)) { $playerCount = 4 }
    else { $playerCount = [int]$playerCount }
    
    $gameCount = Read-Host "Number of games for load test [3]"
    if (-not $gameCount -or -not [int]::TryParse($gameCount, [ref]$null)) { $gameCount = 3 }
    else { $gameCount = [int]$gameCount }
    
    $teamCount = Read-Host "Number of teams [2]"
    if (-not $teamCount -or -not [int]::TryParse($teamCount, [ref]$null)) { $teamCount = 2 }
    else { $teamCount = [int]$teamCount }
    
    return @{
        BaseUrl = $baseUrl
        PlayerCount = $playerCount
        GameCount = $gameCount
        TeamCount = $teamCount
    }
}

# Handle command line test type
if ($TestType -ne "menu") {
    switch ($TestType.ToLower()) {
        "api" { Run-TestScript "test-api.ps1" }
        "lifecycle" { Run-TestScript "test-game-lifecycle.ps1" }
        "load" { Run-TestScript "test-load.ps1" }
        "config" { Run-TestScript "test-config.ps1" }
        "errors" { Run-TestScript "test-errors.ps1" }
        "console" { Run-TestScript "test-console.ps1" }
        "monitor" { Run-TestScript "test-monitor.ps1" }
        default {
            Write-Host "Unknown test type: $TestType" -ForegroundColor Red
            Write-Host "Available types: api, lifecycle, load, config, errors, console, monitor" -ForegroundColor Yellow
        }
    }
    return
}

# Interactive menu
do {
    Show-Menu
    $choice = Read-Host "Select an option (0-8)"
    
    switch ($choice) {
        "1" { Run-TestScript "test-api.ps1" }
        "2" { Run-TestScript "test-game-lifecycle.ps1" }
        "3" { 
            Write-Host "`nLoad Test Parameters:" -ForegroundColor Yellow
            $games = Read-Host "Number of concurrent games [5]"
            $players = Read-Host "Players per game [8]"
            
            $params = @{ BaseUrl = $BaseUrl }
            if ($games -and [int]::TryParse($games, [ref]$null)) { $params.ConcurrentGames = [int]$games }
            if ($players -and [int]::TryParse($players, [ref]$null)) { $params.PlayersPerGame = [int]$players }
            
            Run-TestScript "test-load.ps1" $params
        }
        "4" { Run-TestScript "test-config.ps1" }
        "5" { Run-TestScript "test-errors.ps1" }
        "6" { Run-TestScript "test-console.ps1" }
        "7" { 
            Write-Host "`nPerformance Monitor Parameters:" -ForegroundColor Yellow
            $duration = Read-Host "Duration in minutes [10]"
            $interval = Read-Host "Test interval in seconds [30]"
            
            $params = @{ BaseUrl = $BaseUrl }
            if ($duration -and [int]::TryParse($duration, [ref]$null)) { $params.DurationMinutes = [int]$duration }
            if ($interval -and [int]::TryParse($interval, [ref]$null)) { $params.IntervalSeconds = [int]$interval }
            
            Run-TestScript "test-monitor.ps1" $params
        }
        "8" { 
            $customParams = Get-CustomParameters
            Write-Host "`nWhich test would you like to run with custom parameters?" -ForegroundColor Yellow
            Write-Host "1. Game Lifecycle  2. Load Test  3. Configuration Test" -ForegroundColor White
            $testChoice = Read-Host "Choice [1]"
            
            switch ($testChoice) {
                "2" { Run-TestScript "test-load.ps1" @{ BaseUrl = $customParams.BaseUrl; ConcurrentGames = $customParams.GameCount; PlayersPerGame = $customParams.PlayerCount } }
                "3" { Run-TestScript "test-config.ps1" @{ BaseUrl = $customParams.BaseUrl } }
                default { Run-TestScript "test-game-lifecycle.ps1" @{ BaseUrl = $customParams.BaseUrl; PlayerCount = $customParams.PlayerCount; TeamCount = $customParams.TeamCount } }
            }
        }
        "0" { 
            Write-Host "Goodbye!" -ForegroundColor Cyan
            exit 
        }
        default { 
            if ($choice -ne "") {
                Write-Host "Invalid option. Please select 0-8." -ForegroundColor Red
                Start-Sleep -Seconds 1
            }
        }
    }
} while ($true)
