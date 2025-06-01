# Interactive PowerShell Testing Console
# Provides a command-line interface for manual API testing

param(
    [string]$BaseUrl = "http://localhost:3001/api"
)

# Global variables to maintain state
$script:CurrentGame = $null
$script:CurrentPlayer = $null
$script:GameHistory = @()

function Show-Welcome {
    Clear-Host
    Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║                   FISHBOWL API TEST CONSOLE                  ║" -ForegroundColor Cyan
    Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Base URL: $BaseUrl" -ForegroundColor Gray
    Write-Host "Type 'help' for available commands or 'exit' to quit" -ForegroundColor Gray
    Write-Host ""
}

function Show-Status {
    Write-Host "┌─ Current Status ─────────────────────────────────────────────┐" -ForegroundColor DarkCyan
    if ($script:CurrentGame) {
        Write-Host "│ Game: $($script:CurrentGame.gameCode) - $($script:CurrentGame.name)" -ForegroundColor White
        Write-Host "│ Status: $($script:CurrentGame.status) | Teams: $($script:CurrentGame.teamCount) | Players: $($script:CurrentGame.playerCount)" -ForegroundColor Gray
    } else {
        Write-Host "│ No active game" -ForegroundColor Gray
    }
    
    if ($script:CurrentPlayer) {
        Write-Host "│ Player: $($script:CurrentPlayer.playerName) ($($script:CurrentPlayer.teamName))" -ForegroundColor White
    } else {
        Write-Host "│ No active player" -ForegroundColor Gray
    }
    Write-Host "└──────────────────────────────────────────────────────────────┘" -ForegroundColor DarkCyan
    Write-Host ""
}

function Show-Help {
    Write-Host "Available Commands:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Game Management:" -ForegroundColor Cyan
    Write-Host "  create-game [name] [host] [teams] [phrases] [timer]  - Create new game"
    Write-Host "  join-game [code] [playername]                       - Join existing game"
    Write-Host "  game-info [code]                                    - Get game information"
    Write-Host "  list-players [code]                                 - List game players"
    Write-Host "  update-config [teams] [phrases] [timer]             - Update game config"
    Write-Host ""
    Write-Host "Phrase Management:" -ForegroundColor Cyan
    Write-Host "  submit-phrases [phrase1,phrase2,phrase3]            - Submit phrases"
    Write-Host "  phrase-status                                       - Check phrase submission status"
    Write-Host "  list-phrases                                        - List all game phrases"
    Write-Host ""
    Write-Host "Testing & Utilities:" -ForegroundColor Cyan
    Write-Host "  test-load [games] [players]                         - Run load test"
    Write-Host "  test-errors                                         - Run error tests"
    Write-Host "  test-config                                         - Run configuration tests"
    Write-Host "  history                                             - Show game history"
    Write-Host "  clear                                               - Clear screen"
    Write-Host "  status                                              - Show current status"
    Write-Host ""
    Write-Host "System:" -ForegroundColor Cyan
    Write-Host "  help                                                - Show this help"
    Write-Host "  exit                                                - Exit console"
    Write-Host ""
}

function Execute-CreateGame {
    param($Args)
    
    $name = if ($Args.Count -gt 0) { $Args[0] } else { "Console Test Game" }
    $host = if ($Args.Count -gt 1) { $Args[1] } else { "ConsoleHost" }
    $teams = if ($Args.Count -gt 2) { [int]$Args[2] } else { 2 }
    $phrases = if ($Args.Count -gt 3) { [int]$Args[3] } else { 5 }
    $timer = if ($Args.Count -gt 4) { [int]$Args[4] } else { 60 }
    
    try {
        $gameData = @{
            name = $name
            hostPlayerName = $host
            teamCount = $teams
            phrasesPerPlayer = $phrases
            timerDuration = $timer
        } | ConvertTo-Json
        
        $response = Invoke-RestMethod -Uri "$BaseUrl/games" -Method POST -Body $gameData -ContentType "application/json"
        
        $script:CurrentGame = @{
            gameCode = $response.gameCode
            name = $response.config.name
            status = "waiting"
            teamCount = $response.config.teamCount
            playerCount = 1
        }
        
        $script:CurrentPlayer = @{
            playerId = $response.hostPlayerId
            playerName = $host
            teamName = "Host"
        }
        
        $script:GameHistory += $script:CurrentGame
        
        Write-Host "✓ Game created successfully!" -ForegroundColor Green
        Write-Host "  Game Code: $($response.gameCode)" -ForegroundColor Cyan
        Write-Host "  Host Player ID: $($response.hostPlayerId)" -ForegroundColor Cyan
        
    } catch {
        Write-Host "✗ Failed to create game: $($_.Exception.Message)" -ForegroundColor Red
    }
}

function Execute-JoinGame {
    param($Args)
    
    if ($Args.Count -lt 2) {
        Write-Host "Usage: join-game [code] [playername]" -ForegroundColor Yellow
        return
    }
    
    $gameCode = $Args[0]
    $playerName = $Args[1]
    
    try {
        $playerData = @{ playerName = $playerName } | ConvertTo-Json
        $response = Invoke-RestMethod -Uri "$BaseUrl/games/$gameCode/join" -Method POST -Body $playerData -ContentType "application/json"
        
        $script:CurrentGame = @{
            gameCode = $gameCode
            name = $response.gameInfo.name
            status = $response.gameInfo.status
            teamCount = $response.gameInfo.teamCount
            playerCount = $response.gameInfo.playerCount
        }
        
        $script:CurrentPlayer = @{
            playerId = $response.playerId
            playerName = $response.playerName
            teamName = $response.teamName
        }
        
        Write-Host "✓ Joined game successfully!" -ForegroundColor Green
        Write-Host "  Player: $($response.playerName)" -ForegroundColor Cyan
        Write-Host "  Team: $($response.teamName)" -ForegroundColor Cyan
        Write-Host "  Game: $($response.gameInfo.name)" -ForegroundColor Cyan
        
    } catch {
        Write-Host "✗ Failed to join game: $($_.Exception.Message)" -ForegroundColor Red
    }
}

function Execute-GameInfo {
    param($Args)
    
    $gameCode = if ($Args.Count -gt 0) { $Args[0] } elseif ($script:CurrentGame) { $script:CurrentGame.gameCode } else { $null }
    
    if (-not $gameCode) {
        Write-Host "Usage: game-info [code] or join a game first" -ForegroundColor Yellow
        return
    }
    
    try {
        $response = Invoke-RestMethod -Uri "$BaseUrl/games/$gameCode" -Method GET
        
        Write-Host "Game Information:" -ForegroundColor Cyan
        Write-Host "  Code: $($response.id)" -ForegroundColor White
        Write-Host "  Name: $($response.name)" -ForegroundColor White
        Write-Host "  Status: $($response.status)" -ForegroundColor White
        Write-Host "  Host: $($response.hostPlayerId)" -ForegroundColor White
        Write-Host "  Teams: $($response.teamCount)" -ForegroundColor White
        Write-Host "  Players: $($response.playerCount)" -ForegroundColor White
        Write-Host "  Phrases per Player: $($response.phrasesPerPlayer)" -ForegroundColor White
        Write-Host "  Timer Duration: $($response.timerDuration)s" -ForegroundColor White
        Write-Host "  Created: $($response.createdAt)" -ForegroundColor Gray
        
        # Update current game status
        if ($script:CurrentGame -and $script:CurrentGame.gameCode -eq $gameCode) {
            $script:CurrentGame.status = $response.status
            $script:CurrentGame.playerCount = $response.playerCount
        }
        
    } catch {
        Write-Host "✗ Failed to get game info: $($_.Exception.Message)" -ForegroundColor Red
    }
}

function Execute-ListPlayers {
    param($Args)
    
    $gameCode = if ($Args.Count -gt 0) { $Args[0] } elseif ($script:CurrentGame) { $script:CurrentGame.gameCode } else { $null }
    
    if (-not $gameCode) {
        Write-Host "Usage: list-players [code] or join a game first" -ForegroundColor Yellow
        return
    }
    
    try {
        $response = Invoke-RestMethod -Uri "$BaseUrl/games/$gameCode/players" -Method GET
        
        Write-Host "Players in Game $gameCode`:" -ForegroundColor Cyan
        Write-Host "┌─────────────────────┬─────────────────────┬──────────┐" -ForegroundColor Gray
        Write-Host "│ Player Name         │ Team                │ Status   │" -ForegroundColor Gray
        Write-Host "├─────────────────────┼─────────────────────┼──────────┤" -ForegroundColor Gray
        
        foreach ($player in $response.players) {
            $name = $player.name.PadRight(19)
            $team = ($player.teamName -or "No Team").PadRight(19)
            $status = if ($player.isConnected) { "Online" } else { "Offline" }
            $status = $status.PadRight(8)
            
            $color = if ($player.isConnected) { "Green" } else { "Red" }
            Write-Host "│ $name │ $team │ $status │" -ForegroundColor $color
        }
        
        Write-Host "└─────────────────────┴─────────────────────┴──────────┘" -ForegroundColor Gray
        Write-Host "Total Players: $($response.totalCount)" -ForegroundColor Cyan
        
    } catch {
        Write-Host "✗ Failed to list players: $($_.Exception.Message)" -ForegroundColor Red
    }
}

function Execute-SubmitPhrases {
    param($Args)
    
    if (-not $script:CurrentGame -or -not $script:CurrentPlayer) {
        Write-Host "You must join a game first" -ForegroundColor Yellow
        return
    }
    
    if ($Args.Count -eq 0) {
        Write-Host "Usage: submit-phrases [phrase1,phrase2,phrase3]" -ForegroundColor Yellow
        return
    }
    
    $phrasesText = $Args -join " "
    $phrases = $phrasesText -split ","
    $phrases = $phrases | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" }
    
    if ($phrases.Count -eq 0) {
        Write-Host "No valid phrases provided" -ForegroundColor Yellow
        return
    }
    
    try {
        $phraseData = @{
            playerId = $script:CurrentPlayer.playerId
            phrases = $phrases
        } | ConvertTo-Json
        
        $response = Invoke-RestMethod -Uri "$BaseUrl/games/$($script:CurrentGame.gameCode)/phrases" -Method POST -Body $phraseData -ContentType "application/json"
        
        Write-Host "✓ Phrases submitted successfully!" -ForegroundColor Green
        Write-Host "  Submitted: $($response.submittedCount)" -ForegroundColor Cyan
        Write-Host "  Required: $($response.totalRequired)" -ForegroundColor Cyan
        
        foreach ($phrase in $response.phrases) {
            Write-Host "    • $($phrase.text)" -ForegroundColor Gray
        }
        
    } catch {
        Write-Host "✗ Failed to submit phrases: $($_.Exception.Message)" -ForegroundColor Red
    }
}

function Execute-Command {
    param($CommandLine)
    
    $parts = $CommandLine.Trim() -split "\s+"
    $command = $parts[0].ToLower()
    $args = $parts[1..($parts.Length-1)]
    
    switch ($command) {
        "help" { Show-Help }
        "exit" { return $false }
        "clear" { Clear-Host; Show-Welcome }
        "status" { Show-Status }
        "create-game" { Execute-CreateGame $args }
        "join-game" { Execute-JoinGame $args }
        "game-info" { Execute-GameInfo $args }
        "list-players" { Execute-ListPlayers $args }
        "submit-phrases" { Execute-SubmitPhrases $args }
        "history" { 
            Write-Host "Game History:" -ForegroundColor Cyan
            for ($i = 0; $i -lt $script:GameHistory.Count; $i++) {
                $game = $script:GameHistory[$i]
                Write-Host "  $($i + 1). $($game.gameCode) - $($game.name)" -ForegroundColor White
            }
        }
        "test-load" {
            $games = if ($args.Count -gt 0) { [int]$args[0] } else { 3 }
            $players = if ($args.Count -gt 1) { [int]$args[1] } else { 4 }
            Write-Host "Running load test with $games games and $players players each..." -ForegroundColor Yellow
            & "$PSScriptRoot\test-load.ps1" -ConcurrentGames $games -PlayersPerGame $players
        }
        "test-errors" {
            Write-Host "Running error handling tests..." -ForegroundColor Yellow
            & "$PSScriptRoot\test-errors.ps1"
        }
        "test-config" {
            Write-Host "Running configuration tests..." -ForegroundColor Yellow
            & "$PSScriptRoot\test-config.ps1"
        }
        default {
            if ($command -ne "") {
                Write-Host "Unknown command: $command" -ForegroundColor Red
                Write-Host "Type 'help' for available commands" -ForegroundColor Gray
            }
        }
    }
    
    return $true
}

# Main console loop
Show-Welcome

do {
    Show-Status
    Write-Host "fishbowl> " -NoNewline -ForegroundColor Green
    $input = Read-Host
    Write-Host ""
    
    $continue = Execute-Command $input
    
    if ($continue) {
        Write-Host ""
    }
    
} while ($continue)

Write-Host "Goodbye!" -ForegroundColor Cyan
