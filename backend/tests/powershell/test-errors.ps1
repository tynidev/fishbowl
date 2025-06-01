# Error Handling and Edge Case Testing Script
# Tests API robustness with malformed requests and edge cases

param(
    [string]$BaseUrl = "http://localhost:3001/api"
)

Write-Host "=== ERROR HANDLING & EDGE CASE TESTING ===" -ForegroundColor Cyan

$ErrorActionPreference = "Continue"

function Test-ErrorScenario {
    param($Description, $ScriptBlock, $ExpectedStatusCode = 400)
    
    Write-Host "`nTesting: $Description" -ForegroundColor Yellow
    try {
        & $ScriptBlock
        if ($ExpectedStatusCode -ge 200 -and $ExpectedStatusCode -lt 300) {
            Write-Host "  + Request succeeded as expected" -ForegroundColor Green
            return $true
        } else {
            Write-Host "  X Expected error but request succeeded" -ForegroundColor Red
            return $false
        }
    }
    catch {
        $statusCode = $null
        if ($_.Exception.Response) {
            $statusCode = [int]$_.Exception.Response.StatusCode
        }
        if ($statusCode -eq $ExpectedStatusCode) {
            Write-Host "  + Correctly returned $statusCode error" -ForegroundColor Green
            return $true
        } else {
            Write-Host "  ! Expected $ExpectedStatusCode but got $statusCode" -ForegroundColor Yellow
            Write-Host "    Error: $($_.Exception.Message)" -ForegroundColor Gray
            return $false
        }
    }
}

$passedTests = 0
$totalTests = 0

# 1. Game Creation Error Tests
Write-Host "`n=== GAME CREATION ERROR TESTS ===" -ForegroundColor Magenta

$totalTests++
$passed = Test-ErrorScenario "Empty game name" {
    $data = @{ name = ""; hostPlayerName = "Host" } | ConvertTo-Json
    Invoke-RestMethod -Uri "$BaseUrl/games" -Method POST -Body $data -ContentType "application/json"
}
if ($passed) { $passedTests++ }

$totalTests++
$passed = Test-ErrorScenario "Missing host player name" {
    $data = @{ name = "Test Game" } | ConvertTo-Json
    Invoke-RestMethod -Uri "$BaseUrl/games" -Method POST -Body $data -ContentType "application/json"
}
if ($passed) { $passedTests++ }

$totalTests++
$passed = Test-ErrorScenario "Invalid team count (too low)" {
    $data = @{ name = "Test Game"; hostPlayerName = "Host"; teamCount = 1 } | ConvertTo-Json
    Invoke-RestMethod -Uri "$BaseUrl/games" -Method POST -Body $data -ContentType "application/json"
}
if ($passed) { $passedTests++ }

$totalTests++
$passed = Test-ErrorScenario "Invalid JSON body" {
    $data = "{ invalid json }"
    Invoke-RestMethod -Uri "$BaseUrl/games" -Method POST -Body $data -ContentType "application/json"
}
if ($passed) { $passedTests++ }

$totalTests++
$passed = Test-ErrorScenario "Extremely long game name" {
    $longName = "A" * 1000
    $data = @{ name = $longName; hostPlayerName = "Host" } | ConvertTo-Json
    Invoke-RestMethod -Uri "$BaseUrl/games" -Method POST -Body $data -ContentType "application/json"
}
if ($passed) { $passedTests++ }

$totalTests++
$passed = Test-ErrorScenario "Special characters in player name" {
    $playerName = "Host<script>alert(''xss'')</script>"
    $data = @{ name = "Test Game XSS"; hostPlayerName = $playerName } | ConvertTo-Json
    Invoke-RestMethod -Uri "$BaseUrl/games" -Method POST -Body $data -ContentType "application/json"
} -ExpectedStatusCode 400 # Expecting the API to reject this
if ($passed) { $passedTests++ }

# 2. Game Lookup Error Tests
Write-Host "`n=== GAME LOOKUP ERROR TESTS ===" -ForegroundColor Magenta

$totalTests++
$passed = Test-ErrorScenario "Invalid game code format" {
    Invoke-RestMethod -Uri "$BaseUrl/games/INVALID" -Method GET
} -ExpectedStatusCode 400
if ($passed) { $passedTests++ }

$totalTests++
$passed = Test-ErrorScenario "Non-existent game code" {
    Invoke-RestMethod -Uri "$BaseUrl/games/ZZZZZZ" -Method GET
} -ExpectedStatusCode 404
if ($passed) { $passedTests++ }

$totalTests++
$passed = Test-ErrorScenario "Game code with special characters" {
    Invoke-RestMethod -Uri "$BaseUrl/games/ABC@#!" -Method GET
} -ExpectedStatusCode 400
if ($passed) { $passedTests++ }

# 3. Player Join Error Tests  
Write-Host "`n=== PLAYER JOIN ERROR TESTS ===" -ForegroundColor Magenta

# First create a valid game for join tests
try {
    $gameData = @{ name = "Join Test Game"; hostPlayerName = "JoinHost" } | ConvertTo-Json
    $game = Invoke-RestMethod -Uri "$BaseUrl/games" -Method POST -Body $gameData -ContentType "application/json"
    $testGameCode = $game.gameCode
    Write-Host "Created test game: $testGameCode" -ForegroundColor Cyan
    
    $totalTests++
    $passed = Test-ErrorScenario "Empty player name" {
        $data = @{ playerName = "" } | ConvertTo-Json
        Invoke-RestMethod -Uri "$BaseUrl/games/$testGameCode/join" -Method POST -Body $data -ContentType "application/json"
    }
    if ($passed) { $passedTests++ }
    
    $totalTests++
    $passed = Test-ErrorScenario "Null player name" {
        $data = @{ playerName = $null } | ConvertTo-Json
        Invoke-RestMethod -Uri "$BaseUrl/games/$testGameCode/join" -Method POST -Body $data -ContentType "application/json"
    }
    if ($passed) { $passedTests++ }
    
    $totalTests++
    $passed = Test-ErrorScenario "Player name too long" {
        $longName = "A" * 100
        $data = @{ playerName = $longName } | ConvertTo-Json
        Invoke-RestMethod -Uri "$BaseUrl/games/$testGameCode/join" -Method POST -Body $data -ContentType "application/json"
    }
    if ($passed) { $passedTests++ }
    
    $totalTests++
    $passed = Test-ErrorScenario "Join non-existent game" {
        $data = @{ playerName = "TestPlayer" } | ConvertTo-Json
        Invoke-RestMethod -Uri "$BaseUrl/games/FAKEGM/join" -Method POST -Body $data -ContentType "application/json"
    } -ExpectedStatusCode 404
    if ($passed) { $passedTests++ }
    
} catch {
    Write-Host "Failed to create test game for join tests: $($_.Exception.Message)" -ForegroundColor Red
}

# 4. Phrase Submission Error Tests
Write-Host "`n=== PHRASE SUBMISSION ERROR TESTS ===" -ForegroundColor Magenta

if ($testGameCode) {
    # Add a player first
    try {
        $playerData = @{ playerName = "PhraseTestPlayer" } | ConvertTo-Json
        $player = Invoke-RestMethod -Uri "$BaseUrl/games/$testGameCode/join" -Method POST -Body $playerData -ContentType "application/json"
        $testPlayerId = $player.playerId
        
        $totalTests++
        $passed = Test-ErrorScenario "Empty phrases array" {
            $data = @{ playerId = $testPlayerId; phrases = @() } | ConvertTo-Json
            Invoke-RestMethod -Uri "$BaseUrl/games/$testGameCode/phrases" -Method POST -Body $data -ContentType "application/json"
        }
        if ($passed) { $passedTests++ }
        
        $totalTests++
        $passed = Test-ErrorScenario "Missing player ID" {
            $data = @{ phrases = @("Test phrase") } | ConvertTo-Json
            Invoke-RestMethod -Uri "$BaseUrl/games/$testGameCode/phrases" -Method POST -Body $data -ContentType "application/json"
        }
        if ($passed) { $passedTests++ }
        
        $totalTests++
        $passed = Test-ErrorScenario "Invalid player ID" {
            $data = @{ playerId = "fake-id"; phrases = @("Test phrase") } | ConvertTo-Json
            Invoke-RestMethod -Uri "$BaseUrl/games/$testGameCode/phrases" -Method POST -Body $data -ContentType "application/json"
        }
        if ($passed) { $passedTests++ }
        
        $totalTests++
        $passed = Test-ErrorScenario "Phrase too long" {
            $longPhrase = "A" * 500
            $data = @{ playerId = $testPlayerId; phrases = @($longPhrase) } | ConvertTo-Json
            Invoke-RestMethod -Uri "$BaseUrl/games/$testGameCode/phrases" -Method POST -Body $data -ContentType "application/json"
        }
        if ($passed) { $passedTests++ }
        
        $totalTests++
        $passed = Test-ErrorScenario "Duplicate phrases" {
            $data = @{ playerId = $testPlayerId; phrases = @("Same phrase", "Same phrase", "Different phrase") } | ConvertTo-Json
            Invoke-RestMethod -Uri "$BaseUrl/games/$testGameCode/phrases" -Method POST -Body $data -ContentType "application/json"
        }
        if ($passed) { $passedTests++ }
        
    } catch {
        Write-Host "Failed to add test player: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# 5. Configuration Update Error Tests
Write-Host "`n=== CONFIGURATION UPDATE ERROR TESTS ===" -ForegroundColor Magenta

if ($testGameCode) {
    $totalTests++
    $passed = Test-ErrorScenario "Update non-existent game config" {
        $data = @{ teamCount = 3 } | ConvertTo-Json
        Invoke-RestMethod -Uri "$BaseUrl/games/FAKEGM/config" -Method PUT -Body $data -ContentType "application/json"
    } -ExpectedStatusCode 404
    if ($passed) { $passedTests++ }
    
    $totalTests++
    $passed = Test-ErrorScenario "Invalid team count in update" {
        $data = @{ teamCount = 10 } | ConvertTo-Json
        Invoke-RestMethod -Uri "$BaseUrl/games/$testGameCode/config" -Method PUT -Body $data -ContentType "application/json"
    }
    if ($passed) { $passedTests++ }
    
    $totalTests++
    $passed = Test-ErrorScenario "Empty update body" {
        $data = @{} | ConvertTo-Json
        Invoke-RestMethod -Uri "$BaseUrl/games/$testGameCode/config" -Method PUT -Body $data -ContentType "application/json"
    }
    if ($passed) { $passedTests++ }
    
    $totalTests++
    $passed = Test-ErrorScenario "Malformed JSON in update" {
        $data = "{ teamCount: 'invalid' }"
        Invoke-RestMethod -Uri "$BaseUrl/games/$testGameCode/config" -Method PUT -Body $data -ContentType "application/json"
    }
    if ($passed) { $passedTests++ }
}

# 6. HTTP Method Error Tests
Write-Host "`n=== HTTP METHOD ERROR TESTS ===" -ForegroundColor Magenta

$totalTests++
$passed = Test-ErrorScenario "Wrong HTTP method for game creation" {
    Invoke-RestMethod -Uri "$BaseUrl/games" -Method GET
} -ExpectedStatusCode 404
if ($passed) { $passedTests++ }

if ($testGameCode) {
    $totalTests++
    $passed = Test-ErrorScenario "Wrong HTTP method for config update" {
        $data = @{ teamCount = 3 } | ConvertTo-Json
        Invoke-RestMethod -Uri "$BaseUrl/games/$testGameCode/config" -Method POST -Body $data -ContentType "application/json"
    } -ExpectedStatusCode 404
    if ($passed) { $passedTests++ }
}

# 7. Content-Type Error Tests
Write-Host "`n=== CONTENT-TYPE ERROR TESTS ===" -ForegroundColor Magenta

$totalTests++
$passed = Test-ErrorScenario "Missing Content-Type header" {
    $data = @{ name = "Test"; hostPlayerName = "Host" } | ConvertTo-Json
    Invoke-RestMethod -Uri "$BaseUrl/games" -Method POST -Body $data
}
if ($passed) { $passedTests++ }

$totalTests++
$passed = Test-ErrorScenario "Wrong Content-Type header" {
    $data = @{ name = "Test"; hostPlayerName = "Host" } | ConvertTo-Json
    Invoke-RestMethod -Uri "$BaseUrl/games" -Method POST -Body $data -ContentType "text/plain"
}
if ($passed) { $passedTests++ }

# 8. Boundary Value Tests
Write-Host "`n=== BOUNDARY VALUE TESTS ===" -ForegroundColor Magenta

$totalTests++
$passed = Test-ErrorScenario "Team count at boundary (1)" {
    $data = @{ name = "Test"; hostPlayerName = "Host"; teamCount = 1 } | ConvertTo-Json
    Invoke-RestMethod -Uri "$BaseUrl/games" -Method POST -Body $data -ContentType "application/json"
}
if ($passed) { $passedTests++ }

$totalTests++
$passed = Test-ErrorScenario "Team count at boundary (9)" {
    $data = @{ name = "Test"; hostPlayerName = "Host"; teamCount = 9 } | ConvertTo-Json
    Invoke-RestMethod -Uri "$BaseUrl/games" -Method POST -Body $data -ContentType "application/json"
}
if ($passed) { $passedTests++ }

$totalTests++
$passed = Test-ErrorScenario "Timer duration at boundary - 29s" {
    $data = @{ name = "Test"; hostPlayerName = "Host"; timerDuration = 29 } | ConvertTo-Json
    Invoke-RestMethod -Uri "$BaseUrl/games" -Method POST -Body $data -ContentType "application/json"
}
if ($passed) { $passedTests++ }

$totalTests++
$passed = Test-ErrorScenario "Timer duration at boundary - 181s" {
    $data = @{ name = "Test"; hostPlayerName = "Host"; timerDuration = 181 } | ConvertTo-Json
    Invoke-RestMethod -Uri "$BaseUrl/games" -Method POST -Body $data -ContentType "application/json"
}
if ($passed) { $passedTests++ }

# 9. Unicode and Special Character Tests
Write-Host "`n=== UNICODE & SPECIAL CHARACTER TESTS ===" -ForegroundColor Magenta

$totalTests++
$passed = Test-ErrorScenario "Unicode characters in game name" {
    $data = @{ name = "测试游戏 🎮"; hostPlayerName = "Host" } | ConvertTo-Json
    Invoke-RestMethod -Uri "$BaseUrl/games" -Method POST -Body $data -ContentType "application/json"
} -ExpectedStatusCode 201  # This should actually succeed
if ($passed) { $passedTests++ }

$totalTests++
$passed = Test-ErrorScenario "Emoji in player name" {
    $data = @{ name = "Test Game"; hostPlayerName = "Player🎯" } | ConvertTo-Json
    Invoke-RestMethod -Uri "$BaseUrl/games" -Method POST -Body $data -ContentType "application/json"
} -ExpectedStatusCode 400  # Actually expecting rejection based on server behavior
if ($passed) { $passedTests++ }

$totalTests++
$passed = Test-ErrorScenario "Special characters in player name" {
    $playerName = "Host<script>alert(''xss'')</script>"
    $data = @{ name = "Test Game XSS"; hostPlayerName = $playerName } | ConvertTo-Json
    Invoke-RestMethod -Uri "$BaseUrl/games" -Method POST -Body $data -ContentType "application/json"
} -ExpectedStatusCode 400 # Expecting the API to reject this
if ($passed) { $passedTests++ }

# 10. Race Condition Simulation
Write-Host "`n=== RACE CONDITION TESTS ===" -ForegroundColor Magenta

Write-Host "Testing concurrent game creation with same names..." -ForegroundColor Yellow
$jobs = @()
for ($i = 1; $i -le 5; $i++) {
    $job = Start-Job -ScriptBlock {
        param($BaseUrl, $GameNumber)
        try {
            $data = @{ name = "Race Test Game"; hostPlayerName = "Host$GameNumber" } | ConvertTo-Json
            $response = Invoke-RestMethod -Uri "$BaseUrl/games" -Method POST -Body $data -ContentType "application/json"
            return @{ Success = $true; GameCode = $response.gameCode; HostNumber = $GameNumber }
        }
        catch {
            return @{ Success = $false; Error = $_.Exception.Message; HostNumber = $GameNumber }
        }
    } -ArgumentList $BaseUrl, $i
    $jobs += $job
}

$raceResults = @()
foreach ($job in $jobs) {
    $result = Receive-Job -Job $job -Wait
    $raceResults += $result
    Remove-Job -Job $job
}

$successfulRaces = $raceResults | Where-Object { $_.Success }
$failedRaces = $raceResults | Where-Object { -not $_.Success }

Write-Host "  Concurrent creations: $($successfulRaces.Count) succeeded, $($failedRaces.Count) failed" -ForegroundColor Cyan
if ($successfulRaces.Count -gt 0) {
    $uniqueGameCodes = ($successfulRaces | ForEach-Object { $_.GameCode } | Sort-Object -Unique).Count
    Write-Host "  Unique game codes generated: $uniqueGameCodes" -ForegroundColor Cyan
    if ($uniqueGameCodes -eq $successfulRaces.Count) {
        Write-Host "  + All game codes are unique" -ForegroundColor Green
    } else {
        Write-Host "  X Duplicate game codes detected!" -ForegroundColor Red
    }
}

# Final Summary
Write-Host "`n=== ERROR HANDLING TEST SUMMARY ===" -ForegroundColor Cyan
$successRate = [Math]::Round(($passedTests / $totalTests) * 100, 1)
Write-Host "Tests Passed: $passedTests / $totalTests ($successRate%)" -ForegroundColor White

if ($successRate -ge 90) {
    Write-Host "*** EXCELLENT error handling!" -ForegroundColor Green
} elseif ($successRate -ge 75) {
    Write-Host "+ Good error handling" -ForegroundColor Yellow
} else {
    Write-Host "! Error handling needs improvement" -ForegroundColor Red
}

Write-Host "`n=== ERROR HANDLING TESTS COMPLETED ===" -ForegroundColor Cyan
