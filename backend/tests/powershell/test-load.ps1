# Load Testing Script for REST API
# Tests API performance under concurrent requests

param(
    [string]$BaseUrl = "http://localhost:3001/api",
    [int]$ConcurrentGames = 4,
    [int]$PlayersPerGame = 8
)

Write-Host "=== LOAD TESTING SCRIPT ===" -ForegroundColor Magenta
Write-Host "Creating $ConcurrentGames games with $PlayersPerGame players each" -ForegroundColor Gray

$ErrorActionPreference = "Continue"

# Start load test
$startTime = Get-Date
Write-Host "`nStarting load test at $startTime" -ForegroundColor DarkYellow

# Create jobs for concurrent execution
$jobs = @()
for ($i = 1; $i -le $ConcurrentGames; $i++) {
    $job = Start-Job -ScriptBlock {
        param($GameNumber, $BaseUrl, $PlayersPerGame)
        
        $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
        
        try {
            # Create game
            $gameData = @{
                name = "Load Test Game $GameNumber"
                hostPlayerName = "Host$GameNumber"
                teamCount = [Math]::Min(4, [Math]::Ceiling($PlayersPerGame / 2))
                phrasesPerPlayer = 3
            } | ConvertTo-Json

            $game = Invoke-RestMethod -Uri "$BaseUrl/games" -Method POST -Body $gameData -ContentType "application/json"
            $gameCode = $game.gameCode
            
            # Add players
            $playerCount = 0
            for ($i = 1; $i -le $PlayersPerGame; $i++) {
                $playerData = @{ playerName = "Player$GameNumber-$i" } | ConvertTo-Json
                $player = Invoke-RestMethod -Uri "$BaseUrl/games/$gameCode/join" -Method POST -Body $playerData -ContentType "application/json"
                $playerCount++
            }
            
            $stopwatch.Stop()
            
            return [PSCustomObject]@{
                GameNumber = $GameNumber
                GameCode = $gameCode
                PlayerCount = $playerCount
                Duration = $stopwatch.ElapsedMilliseconds
                Success = $true
            }
        }
        catch {
            $stopwatch.Stop()
            return [PSCustomObject]@{
                GameNumber = $GameNumber
                Error = $_.Exception.Message
                Duration = $stopwatch.ElapsedMilliseconds
                Success = $false
            }
        }
    } -ArgumentList $i, $BaseUrl, $PlayersPerGame
    $jobs += $job
    Write-Host "Started job for Game $i" -ForegroundColor DarkGray
}

# Wait for all jobs to complete
Write-Host "`nWaiting for all games to complete..." -ForegroundColor DarkYellow
$results = @()
foreach ($job in $jobs) {
    $result = Receive-Job -Job $job -Wait
    $results += $result
    Remove-Job -Job $job
}

$endTime = Get-Date
$totalDuration = ($endTime - $startTime).TotalMilliseconds

# Analyze results
Write-Host "`n=== LOAD TEST RESULTS ===" -ForegroundColor Magenta
Write-Host "Total Duration: $([Math]::Round($totalDuration, 2))ms" -ForegroundColor DarkYellow

$successfulGames = $results | Where-Object { $_.Success -eq $true }
$failedGames = $results | Where-Object { $_.Success -eq $false }

Write-Host "`n[OK] Successful Games: $($successfulGames.Count)/$ConcurrentGames" -ForegroundColor DarkGreen
if ($successfulGames.Count -gt 0) {
    $avgDuration = ($successfulGames | Measure-Object -Property Duration -Average).Average
    $maxDuration = ($successfulGames | Measure-Object -Property Duration -Maximum).Maximum
    $minDuration = ($successfulGames | Measure-Object -Property Duration -Minimum).Minimum
    
    Write-Host "- Average game creation time: $([Math]::Round($avgDuration, 2))ms" -ForegroundColor Cyan
    Write-Host "- Fastest: $([Math]::Round($minDuration, 2))ms" -ForegroundColor Cyan
    Write-Host "- Slowest: $([Math]::Round($maxDuration, 2))ms" -ForegroundColor Cyan
    
    $totalPlayers = ($successfulGames | Measure-Object -Property PlayerCount -Sum).Sum
    Write-Host "- Total players created: $totalPlayers" -ForegroundColor Cyan
    Write-Host "- Players per second: $([Math]::Round($totalPlayers / ($totalDuration / 1000), 2))" -ForegroundColor Cyan
}

if ($failedGames.Count -gt 0) {
    Write-Host "`n[X] Failed Games: $($failedGames.Count)" -ForegroundColor DarkRed
    foreach ($failed in $failedGames) {
        Write-Host "- Game $($failed.GameNumber): $($failed.Error)" -ForegroundColor DarkRed
    }
}

# Performance benchmarks
Write-Host "`n=== PERFORMANCE ANALYSIS ===" -ForegroundColor Magenta
if ($successfulGames.Count -gt 0 -and $avgDuration) {
    if ($avgDuration -lt 1000) {
        Write-Host "[OK] Excellent performance (< 1s per game)" -ForegroundColor DarkGreen
    } elseif ($avgDuration -lt 3000) {
        Write-Host "[ ! ] Good performance (1-3s per game)" -ForegroundColor DarkYellow
    } else {
        Write-Host "[X] Slow performance (> 3s per game)" -ForegroundColor DarkRed
    }
} else {
    Write-Host "[X] No successful games to analyze performance" -ForegroundColor DarkRed
}

# Test concurrent game info retrieval
Write-Host "`n=== TESTING CONCURRENT READ OPERATIONS ===" -ForegroundColor Magenta
$readJobs = @()
foreach ($game in $successfulGames) {
    $readJob = Start-Job -ScriptBlock {
        param($BaseUrl, $GameCode)
        $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
        try {
            $gameInfo = Invoke-RestMethod -Uri "$BaseUrl/games/$GameCode" -Method GET
            $players = Invoke-RestMethod -Uri "$BaseUrl/games/$GameCode/players" -Method GET
            $stopwatch.Stop()
            return [PSCustomObject]@{ Success = $true; Duration = $stopwatch.ElapsedMilliseconds; GameCode = $GameCode }
        }
        catch {
            $stopwatch.Stop()
            return [PSCustomObject]@{ Success = $false; Duration = $stopwatch.ElapsedMilliseconds; Error = $_.Exception.Message }
        }
    } -ArgumentList $BaseUrl, $game.GameCode
    $readJobs += $readJob
}

$readResults = @()
foreach ($job in $readJobs) {
    $result = Receive-Job -Job $job -Wait
    $readResults += $result
    Remove-Job -Job $job
}

$successfulReads = $readResults | Where-Object { $_.Success -eq $true }
if ($successfulReads.Count -gt 0) {
    $avgReadTime = ($successfulReads | Measure-Object -Property Duration -Average).Average
    Write-Host "[OK] Concurrent read operations: $($successfulReads.Count) successful" -ForegroundColor DarkGreen
    Write-Host "- Average read time: $([Math]::Round($avgReadTime, 2))ms" -ForegroundColor Cyan
}

Write-Host "`n=== LOAD TEST COMPLETED ===" -ForegroundColor DarkGreen
