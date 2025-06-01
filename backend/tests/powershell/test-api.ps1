# Fishbowl API Test Script
# Run with: .\test-api.ps1

# Configuration
$baseUrl = "http://localhost:3001/api"
$global:gameCode = ""
$global:hostPlayerId = ""
$global:playerId = ""
$global:deviceId = ""
$global:phraseId = ""

# Helper function to display results
function Show-Result {
    param($TestName, $Response, $Error = $null)
    
    Write-Host "`n=== $TestName ===" -ForegroundColor Cyan
    if ($Error) {
        Write-Host "ERROR: $Error" -ForegroundColor Red
    }
    else {
        $Response | ConvertTo-Json -Depth 10 | Write-Host
    }
}

# Helper function to make API calls
function Invoke-API {
    param(
        [string]$Method,
        [string]$Endpoint,
        [hashtable]$Body = @{},
        [hashtable]$Headers = @{"Content-Type" = "application/json"}
    )
    
    try {
        $params = @{
            Method = $Method
            Uri = "$baseUrl$Endpoint"
            Headers = $Headers
        }
        
        if ($Method -ne "GET" -and $Body.Count -gt 0) {
            $params.Body = ($Body | ConvertTo-Json -Depth 10)
        }
        
        $response = Invoke-RestMethod @params
        return $response
    }
    catch {
        return @{
            error = $_.Exception.Message
            statusCode = $_.Exception.Response.StatusCode.value__
            details = $_.ErrorDetails.Message
        }
    }
}

# Test Suite
Write-Host "Starting Fishbowl API Tests..." -ForegroundColor Green
Write-Host "Base URL: $baseUrl" -ForegroundColor Yellow

# 1. Game Management Tests
Write-Host "`n`n========== GAME MANAGEMENT TESTS ==========" -ForegroundColor Yellow

# 1.1 Create a new game
$createGameBody = @{
    name = "PowerShell Test Game"
    hostPlayerName = "PSHost"
    teamCount = 2
    phrasesPerPlayer = 3
    timerDuration = 60
}
$createResult = Invoke-API -Method "POST" -Endpoint "/games" -Body $createGameBody
Show-Result "Create Game" $createResult

if ($createResult.gameCode) {
    $global:gameCode = $createResult.gameCode
    $global:hostPlayerId = $createResult.hostPlayerId
    Write-Host "`nGame created successfully!" -ForegroundColor Green
    Write-Host "Game Code: $global:gameCode" -ForegroundColor Green
    Write-Host "Host Player ID: $global:hostPlayerId" -ForegroundColor Green
}

# Wait a moment
Start-Sleep -Seconds 1

# 1.2 Get game info
$gameInfo = Invoke-API -Method "GET" -Endpoint "/games/$global:gameCode"
Show-Result "Get Game Info" $gameInfo

# 1.3 Join game as players
$joinBody1 = @{ playerName = "Alice" }
$joinResult1 = Invoke-API -Method "POST" -Endpoint "/games/$global:gameCode/join" -Body $joinBody1
Show-Result "Join Game - Alice" $joinResult1
if ($joinResult1.playerId) {
    $global:playerId = $joinResult1.playerId
}

$joinBody2 = @{ playerName = "Bob" }
$joinResult2 = Invoke-API -Method "POST" -Endpoint "/games/$global:gameCode/join" -Body $joinBody2
Show-Result "Join Game - Bob" $joinResult2

# 1.4 Get all players
$players = Invoke-API -Method "GET" -Endpoint "/games/$global:gameCode/players"
Show-Result "Get Players" $players

# 1.5 Try to update config (this might fail due to team constraint)
Write-Host "`n`nTesting config update (expecting potential team constraint error)..." -ForegroundColor Yellow
$updateConfigBody = @{
    teamCount = 3
    phrasesPerPlayer = 4
    timerDuration = 75
}
$updateResult = Invoke-API -Method "PUT" -Endpoint "/games/$global:gameCode/config" -Body $updateConfigBody
Show-Result "Update Config" $updateResult

# 2. Phrase Management Tests
Write-Host "`n`n========== PHRASE MANAGEMENT TESTS ==========" -ForegroundColor Yellow

# 2.1 Submit phrases
$phrasesBody = @{
    phrases = @("PowerShell Scripting", "API Testing", "Game Development")
    playerId = $global:playerId
}
$submitResult = Invoke-API -Method "POST" -Endpoint "/games/$global:gameCode/phrases" -Body $phrasesBody
Show-Result "Submit Phrases - Player" $submitResult

# 2.2 Get phrase status
$statusResult = Invoke-API -Method "GET" -Endpoint "/games/$global:gameCode/phrases/status"
Show-Result "Phrase Submission Status" $statusResult

# 3. Device Session Tests
Write-Host "`n`n========== DEVICE SESSION TESTS ==========" -ForegroundColor Yellow

# 3.1 Generate device ID
$deviceResult = Invoke-API -Method "GET" -Endpoint "/device-sessions/generate-id"
Show-Result "Generate Device ID" $deviceResult
if ($deviceResult.deviceId) {
    $global:deviceId = $deviceResult.deviceId
}

# 3.2 Check active session
$activeCheck = Invoke-API -Method "GET" -Endpoint "/device-sessions/$global:deviceId/active/$global:gameCode"
Show-Result "Check Active Session" $activeCheck

# 4. Error Testing
Write-Host "`n`n========== ERROR TESTING ==========" -ForegroundColor Yellow

# 4.1 Invalid game code
$invalidGame = Invoke-API -Method "GET" -Endpoint "/games/INVALID"
Show-Result "Invalid Game Code" $invalidGame

# 4.2 Empty player name
$emptyNameBody = @{ playerName = "" }
$emptyNameResult = Invoke-API -Method "POST" -Endpoint "/games/$global:gameCode/join" -Body $emptyNameBody
Show-Result "Empty Player Name" $emptyNameResult

# Summary
Write-Host "`n`n========== TEST SUMMARY ==========" -ForegroundColor Green
Write-Host "Game Code: $global:gameCode"
Write-Host "Host Player ID: $global:hostPlayerId"
Write-Host "Player ID: $global:playerId"
Write-Host "Device ID: $global:deviceId"
Write-Host "`nTests completed!" -ForegroundColor Green

# Interactive menu for additional testing
function Show-Menu {
    Write-Host "`n`n========== INTERACTIVE MENU ==========" -ForegroundColor Cyan
    Write-Host "1. Create another game"
    Write-Host "2. Join current game"
    Write-Host "3. Submit more phrases"
    Write-Host "4. Get game info"
    Write-Host "5. Get players"
    Write-Host "6. Exit"
    Write-Host "=====================================" -ForegroundColor Cyan
}

do {
    Show-Menu
    $choice = Read-Host "Select an option (1-6)"
    
    switch ($choice) {
        "1" {
            $name = Read-Host "Game name"
            $host = Read-Host "Host name"
            $body = @{
                name = $name
                hostPlayerName = $host
                teamCount = 2
                phrasesPerPlayer = 5
                timerDuration = 60
            }
            $result = Invoke-API -Method "POST" -Endpoint "/games" -Body $body
            Show-Result "Create Game" $result
            if ($result.gameCode) {
                $global:gameCode = $result.gameCode
                Write-Host "New game code: $global:gameCode" -ForegroundColor Green
            }
        }
        "2" {
            $name = Read-Host "Player name"
            $body = @{ playerName = $name }
            $result = Invoke-API -Method "POST" -Endpoint "/games/$global:gameCode/join" -Body $body
            Show-Result "Join Game" $result
        }
        "3" {
            $phraseCount = Read-Host "How many phrases"
            $phrases = @()
            for ($i = 1; $i -le $phraseCount; $i++) {
                $phrases += Read-Host "Phrase $i"
            }
            $pid = Read-Host "Player ID (or press Enter for $global:playerId)"
            if ([string]::IsNullOrEmpty($pid)) { $pid = $global:playerId }
            $body = @{
                phrases = $phrases
                playerId = $pid
            }
            $result = Invoke-API -Method "POST" -Endpoint "/games/$global:gameCode/phrases" -Body $body
            Show-Result "Submit Phrases" $result
        }
        "4" {
            $result = Invoke-API -Method "GET" -Endpoint "/games/$global:gameCode"
            Show-Result "Game Info" $result
        }
        "5" {
            $result = Invoke-API -Method "GET" -Endpoint "/games/$global:gameCode/players"
            Show-Result "Players" $result
        }
    }
} while ($choice -ne "6")

Write-Host "`nGoodbye!" -ForegroundColor Green