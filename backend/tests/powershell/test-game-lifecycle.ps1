# Game Lifecycle Testing Script
# Tests the complete flow from game creation to phrase submission

param(
    [string]$BaseUrl = "http://localhost:3001/api",
    [int]$PlayerCount = 4,
    [int]$TeamCount = 2
)

Write-Host "=== GAME LIFECYCLE TEST ===" -ForegroundColor Cyan
Write-Host "Testing complete game flow with $PlayerCount players on $TeamCount teams"

$ErrorActionPreference = "Continue"

try {
    # 1. Create Game
    Write-Host "`n1. Creating game..." -ForegroundColor Yellow
    $gameData = @{
        name = "Lifecycle Test Game"
        hostPlayerName = "GameHost"
        teamCount = $TeamCount
        phrasesPerPlayer = 3
        timerDuration = 90
    } | ConvertTo-Json

    $game = Invoke-RestMethod -Uri "$BaseUrl/games" -Method POST -Body $gameData -ContentType "application/json"
    $gameCode = $game.gameCode
    Write-Host "✓ Game created: $gameCode" -ForegroundColor Green

    # 2. Add Players
    Write-Host "`n2. Adding $PlayerCount players..." -ForegroundColor Yellow
    $players = @()
    $playerNames = @("Alice", "Bob", "Charlie", "Diana", "Eve", "Frank", "Grace", "Henry")
    
    for ($i = 0; $i -lt $PlayerCount; $i++) {
        $playerName = $playerNames[$i % $playerNames.Length]
        $playerData = @{ playerName = "$playerName$i" } | ConvertTo-Json
        
        $playerResponse = Invoke-RestMethod -Uri "$BaseUrl/games/$gameCode/join" -Method POST -Body $playerData -ContentType "application/json"
        $players += $playerResponse
        Write-Host "  + Added: $($playerResponse.playerName) -> $($playerResponse.teamName)" -ForegroundColor Green
    }

    # 3. Test Team Distribution
    Write-Host "`n3. Analyzing team distribution..." -ForegroundColor Yellow
    $teamStats = @{}
    foreach ($player in $players) {
        if ($player.teamName) {
            if (-not $teamStats.ContainsKey($player.teamName)) {
                $teamStats[$player.teamName] = 0
            }
            $teamStats[$player.teamName]++
        }
    }
    
    foreach ($team in $teamStats.Keys) {
        Write-Host "  $team`: $($teamStats[$team]) players" -ForegroundColor Cyan
    }

    # 4. Submit Phrases for Each Player
    Write-Host "`n4. Submitting phrases for all players..." -ForegroundColor Yellow
    $allPhrases = @(
        "PowerShell Automation", "REST API Testing", "Game Development",
        "Team Management", "Database Operations", "Error Handling",
        "Unit Testing", "Integration Testing", "Performance Testing",
        "Security Testing", "Load Testing", "User Experience"
    )
    
    foreach ($player in $players) {
        $phrasesToSubmit = @()
        for ($i = 0; $i -lt 3; $i++) {
            $phrasesToSubmit += $allPhrases[($players.IndexOf($player) * 3 + $i) % $allPhrases.Length]
        }
        
        $phraseData = @{
            playerId = $player.playerId
            phrases = $phrasesToSubmit
        } | ConvertTo-Json
        
        try {
            $phraseResponse = Invoke-RestMethod -Uri "$BaseUrl/games/$gameCode/phrases" -Method POST -Body $phraseData -ContentType "application/json"
            Write-Host "  + $($player.playerName): $($phraseResponse.submittedCount) phrases" -ForegroundColor Green
        }
        catch {
            Write-Host "  X $($player.playerName): Failed to submit phrases" -ForegroundColor Red
        }
    }

    # 5. Check Final Game State
    Write-Host "`n5. Final game state..." -ForegroundColor Yellow
    $finalGame = Invoke-RestMethod -Uri "$BaseUrl/games/$gameCode" -Method GET
    Write-Host "  Status: $($finalGame.status)" -ForegroundColor Cyan
    Write-Host "  Players: $($finalGame.playerCount)" -ForegroundColor Cyan
    Write-Host "  Teams: $($finalGame.teamCount)" -ForegroundColor Cyan

    # 6. Get Phrase Submission Status
    $phraseStatus = Invoke-RestMethod -Uri "$BaseUrl/games/$gameCode/phrases/status" -Method GET
    Write-Host "  Total Phrases: $($phraseStatus.summary.totalPhrasesSubmitted)/$($phraseStatus.summary.totalPhrasesRequired)" -ForegroundColor Cyan
    Write-Host "  Complete: $($phraseStatus.summary.isAllComplete)" -ForegroundColor Cyan

    Write-Host "`n=== LIFECYCLE TEST COMPLETED SUCCESSFULLY ===" -ForegroundColor Green
    return @{
        Success = $true
        GameCode = $gameCode
        PlayerCount = $finalGame.playerCount
        PhraseCount = $phraseStatus.summary.totalPhrasesSubmitted
    }
}
catch {
    Write-Host "`n=== LIFECYCLE TEST FAILED ===" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    return @{
        Success = $false
        Error = $_.Exception.Message
    }
}
