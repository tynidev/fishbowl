# Fishbowl API Test Script
# Run with: .\\test-api.ps1

# Configuration
$baseUrl = "http://localhost:3001/api"
$global:gameCode = ""
$global:hostPlayerId = ""
$global:playerId = ""
$global:deviceId = ""
$global:phraseId = ""

# Helper function to display results
function Show-Result {
    param($TestName, $Response, $ApiError = $null)
    
    Write-Host "`n=== $TestName ===" -ForegroundColor Magenta
    if ($ApiError) {
        Write-Host "[X] ERROR: $ApiError" -ForegroundColor DarkRed
    }
    else {
        $Response | ConvertTo-Json -Depth 10 | Write-Host -ForegroundColor Gray
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
Write-Host "Starting Fishbowl API Tests..." -ForegroundColor DarkGreen
Write-Host "Base URL: $baseUrl" -ForegroundColor DarkYellow

# 1. Game Management Tests
Write-Host "`n`n========== GAME MANAGEMENT TESTS ==========" -ForegroundColor DarkYellow

# 1.1 Create a new game
$createGameBody = @{
    name = "PowerShell Test Game"
    hostPlayerName = "PSHost"
    teamCount = 2
    phrasesPerPlayer = 3
    timerDuration = 60
}
$createResult = Invoke-API -Method "POST" -Endpoint "/games" -Body $createGameBody
Show-Result "Create Game" $createResult ($createResult.error)

if ($createResult.gameCode) {
    $global:gameCode = $createResult.gameCode
    $global:hostPlayerId = $createResult.hostPlayerId
    Write-Host "`n[OK] Game created successfully!" -ForegroundColor DarkGreen
    Write-Host "- Game Code: $global:gameCode" -ForegroundColor Cyan
    Write-Host "- Host Player ID: $global:hostPlayerId" -ForegroundColor Cyan
}

# Wait a moment
Start-Sleep -Seconds 1

# 1.2 Get game info
$gameInfo = Invoke-API -Method "GET" -Endpoint "/games/$global:gameCode"
Show-Result "Get Game Info" $gameInfo ($gameInfo.error)

# 1.3 Join game as players
$joinBody1 = @{ playerName = "Alice" }
$joinResult1 = Invoke-API -Method "POST" -Endpoint "/games/$global:gameCode/join" -Body $joinBody1
Show-Result "Join Game - Alice" $joinResult1 ($joinResult1.error)
if ($joinResult1.playerId) {
    $global:playerId = $joinResult1.playerId
}

$joinBody2 = @{ playerName = "Bob" }
$joinResult2 = Invoke-API -Method "POST" -Endpoint "/games/$global:gameCode/join" -Body $joinBody2
Show-Result "Join Game - Bob" $joinResult2 ($joinResult2.error)

# 1.4 Get all players
$players = Invoke-API -Method "GET" -Endpoint "/games/$global:gameCode/players"
Show-Result "Get Players" $players ($players.error)

# 1.5 Try to update config (this might fail due to team constraint)
Write-Host "`n`n[ ! ] Testing config update (expecting potential team constraint error)..." -ForegroundColor DarkYellow
$updateConfigBody = @{
    teamCount = 3
    phrasesPerPlayer = 4
    timerDuration = 75
}
$updateResult = Invoke-API -Method "PUT" -Endpoint "/games/$global:gameCode/config" -Body $updateConfigBody
Show-Result "Update Config" $updateResult ($updateResult.error)

# 2. Phrase Management Tests
Write-Host "`n`n========== PHRASE MANAGEMENT TESTS ==========" -ForegroundColor DarkYellow

# 2.1 Submit phrases
$phrasesBody = @{
    phrases = @("PowerShell Scripting", "API Testing", "Game Development")
    playerId = $global:playerId
}
$submitResult = Invoke-API -Method "POST" -Endpoint "/games/$global:gameCode/phrases" -Body $phrasesBody
Show-Result "Submit Phrases - Player" $submitResult ($submitResult.error)

# 2.2 Get phrase status
$statusResult = Invoke-API -Method "GET" -Endpoint "/games/$global:gameCode/phrases/status"
Show-Result "Phrase Submission Status" $statusResult ($statusResult.error)

# 3. Device Session Tests
Write-Host "`n`n========== DEVICE SESSION TESTS ==========" -ForegroundColor DarkYellow

# 3.1 Generate device ID
$deviceResult = Invoke-API -Method "GET" -Endpoint "/device-sessions/generate-id"
Show-Result "Generate Device ID" $deviceResult ($deviceResult.error)
if ($deviceResult.deviceId) {
    $global:deviceId = $deviceResult.deviceId
}

# 3.2 Check active session
$activeCheck = Invoke-API -Method "GET" -Endpoint "/device-sessions/$global:deviceId/active/$global:gameCode"
Show-Result "Check Active Session" $activeCheck ($activeCheck.error)

# 4. Error Testing
Write-Host "`n`n========== ERROR TESTING ==========" -ForegroundColor DarkYellow

# 4.1 Invalid game code
$invalidGame = Invoke-API -Method "GET" -Endpoint "/games/INVALID"
Show-Result "Invalid Game Code" $invalidGame ($invalidGame.error)

# 4.2 Empty player name
$emptyNameBody = @{ playerName = "" }
$emptyNameResult = Invoke-API -Method "POST" -Endpoint "/games/$global:gameCode/join" -Body $emptyNameBody
Show-Result "Empty Player Name" $emptyNameResult ($emptyNameResult.error)

# Summary
Write-Host "`n`n========== TEST SUMMARY ==========" -ForegroundColor DarkGreen
Write-Host "- Game Code: $global:gameCode" -ForegroundColor Cyan
Write-Host "- Host Player ID: $global:hostPlayerId" -ForegroundColor Cyan
Write-Host "- Player ID: $global:playerId" -ForegroundColor Cyan
Write-Host "- Device ID: $global:deviceId" -ForegroundColor Cyan
Write-Host "`n[OK] Tests completed!" -ForegroundColor DarkGreen

# Interactive menu for additional testing
function Show-Menu {
    Write-Host "`n`n========== INTERACTIVE MENU ==========" -ForegroundColor Magenta
    Write-Host "1. Create another game"
    Write-Host "2. Join current game"
    Write-Host "3. Submit more phrases"
    Write-Host "4. Get game info"
    Write-Host "5. Get players"
    Write-Host "6. Exit"
    Write-Host "=====================================" -ForegroundColor Magenta
}

do {
    Show-Menu
    $choice = Read-Host "Select an option (1-6)"
    
    switch ($choice) {
        "1" {
            $name = Read-Host "Game name"
            $hostName = Read-Host "Host name"
            $body = @{
                name = $name
                hostPlayerName = $hostName
                teamCount = 2
                phrasesPerPlayer = 5
                timerDuration = 60
            }
            $result = Invoke-API -Method "POST" -Endpoint "/games" -Body $body
            Show-Result "Create Game" $result ($result.error)
            if ($result.gameCode) {
                $global:gameCode = $result.gameCode
                Write-Host "[OK] New game code: $global:gameCode" -ForegroundColor DarkGreen
            }
        }
        "2" {
            $name = Read-Host "Player name"
            $body = @{ playerName = $name }
            $result = Invoke-API -Method "POST" -Endpoint "/games/$global:gameCode/join" -Body $body
            Show-Result "Join Game" $result ($result.error)
        }
        "3" {
            $phraseCount = Read-Host "How many phrases"
            $phrases = @()
            for ($i = 1; $i -le $phraseCount; $i++) {
                $phrases += Read-Host "Phrase $i"
            }
            $playerIdInput = Read-Host "Player ID (or press Enter for $global:playerId)"
            if ([string]::IsNullOrEmpty($playerIdInput)) { $playerIdInput = $global:playerId }
            $body = @{
                phrases = $phrases
                playerId = $playerIdInput
            }
            $result = Invoke-API -Method "POST" -Endpoint "/games/$global:gameCode/phrases" -Body $body
            Show-Result "Submit Phrases" $result ($result.error)
        }
        "4" {
            $result = Invoke-API -Method "GET" -Endpoint "/games/$global:gameCode"
            Show-Result "Game Info" $result ($result.error)
        }
        "5" {
            $result = Invoke-API -Method "GET" -Endpoint "/games/$global:gameCode/players"
            Show-Result "Players" $result ($result.error)
        }
    }
} while ($choice -ne "6")

Write-Host "`nGoodbye!" -ForegroundColor DarkGreen