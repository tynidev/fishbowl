# Performance Monitoring Script for REST API
# Continuously monitors API performance and alerts on issues

param(
    [string]$BaseUrl = "http://localhost:3001/api",
    [int]$IntervalSeconds = 30,
    [int]$DurationMinutes = 10,
    [string]$LogFile = "api-performance.log"
)

Write-Host "=== API PERFORMANCE MONITOR ===" -ForegroundColor Magenta
Write-Host "Monitoring: $BaseUrl" -ForegroundColor Gray
Write-Host "Interval: $IntervalSeconds seconds" -ForegroundColor Gray
Write-Host "Duration: $DurationMinutes minutes" -ForegroundColor Gray
Write-Host "Log File: $LogFile" -ForegroundColor Gray
Write-Host ""

$ErrorActionPreference = "Continue"
$startTime = Get-Date
$endTime = $startTime.AddMinutes($DurationMinutes)
$iteration = 0

# Performance thresholds
$thresholds = @{
    CreateGameMs = 2000
    JoinGameMs = 1000
    GetGameInfoMs = 500
    ErrorRate = 10  # percentage
}

# Initialize log file
$logPath = Join-Path $PSScriptRoot $LogFile
"Timestamp,Iteration,CreateGame(ms),JoinGame(ms),GetGameInfo(ms),Errors,TotalRequests,ErrorRate(%),Status" | Out-File -FilePath $logPath -Encoding UTF8

function Test-APIPerformance {
    param($Iteration)
    
    $results = @{
        Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        Iteration = $Iteration
        CreateGameMs = $null
        JoinGameMs = $null
        GetGameInfoMs = $null
        Errors = 0
        TotalRequests = 0
        ErrorRate = 0
        Status = "OK"
    }
    
    # Test 1: Create Game
    Write-Host "[$($results.Timestamp)] Test $Iteration - Creating game..." -ForegroundColor DarkGray
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        $gameData = @{
            name = "Monitor Test $Iteration"
            hostPlayerName = "MonitorHost$Iteration"
        } | ConvertTo-Json
        
        $game = Invoke-RestMethod -Uri "$BaseUrl/games" -Method POST -Body $gameData -ContentType "application/json"
        $stopwatch.Stop()
        $results.CreateGameMs = $stopwatch.ElapsedMilliseconds
        $gameCode = $game.gameCode
        Write-Host "[+]   Game created: $gameCode ($($results.CreateGameMs)ms)" -ForegroundColor DarkGreen
    }
    catch {
        $stopwatch.Stop()
        $results.Errors++
        Write-Host "[X]   Game creation failed: $($_.Exception.Message)" -ForegroundColor DarkRed
    }
    finally {
        $results.TotalRequests++
    }
    
    # Test 2: Join Game (if creation succeeded)
    if ($gameCode) {
        Write-Host "  Joining game..." -ForegroundColor DarkGray
        $stopwatch.Restart()
        try {
            $playerData = @{ playerName = "MonitorPlayer$Iteration" } | ConvertTo-Json
            $player = Invoke-RestMethod -Uri "$BaseUrl/games/$gameCode/join" -Method POST -Body $playerData -ContentType "application/json"
            $stopwatch.Stop()
            $results.JoinGameMs = $stopwatch.ElapsedMilliseconds
            Write-Host "[+]   Player joined ($($results.JoinGameMs)ms)" -ForegroundColor DarkGreen
        }
        catch {
            $stopwatch.Stop()
            $results.Errors++
            Write-Host "[X]   Join failed: $($_.Exception.Message)" -ForegroundColor DarkRed
        }
        finally {
            $results.TotalRequests++
        }
        
        # Test 3: Get Game Info
        Write-Host "  Getting game info..." -ForegroundColor DarkGray
        $stopwatch.Restart()
        try {
            $gameInfo = Invoke-RestMethod -Uri "$BaseUrl/games/$gameCode" -Method GET
            $stopwatch.Stop()
            $results.GetGameInfoMs = $stopwatch.ElapsedMilliseconds
            Write-Host "[+]   Game info retrieved ($($results.GetGameInfoMs)ms)" -ForegroundColor DarkGreen
        }
        catch {
            $stopwatch.Stop()
            $results.Errors++
            Write-Host "[X]   Get game info failed: $($_.Exception.Message)" -ForegroundColor DarkRed
        }
        finally {
            $results.TotalRequests++
        }
    }
    
    # Calculate error rate
    if ($results.TotalRequests -gt 0) {
        $results.ErrorRate = [Math]::Round(($results.Errors / $results.TotalRequests) * 100, 1)
    }
    
    # Determine status
    $issues = @()
    if ($results.CreateGameMs -and $results.CreateGameMs -gt $thresholds.CreateGameMs) {
        $issues += "Slow game creation"
    }
    if ($results.JoinGameMs -and $results.JoinGameMs -gt $thresholds.JoinGameMs) {
        $issues += "Slow join"
    }
    if ($results.GetGameInfoMs -and $results.GetGameInfoMs -gt $thresholds.GetGameInfoMs) {
        $issues += "Slow info retrieval"
    }
    if ($results.ErrorRate -gt $thresholds.ErrorRate) {
        $issues += "High error rate"
    }
    
    if ($issues.Count -gt 0) {
        $results.Status = "WARNING: " + ($issues -join ", ")
        Write-Host "[ ! ] Performance issues detected: $($issues -join ', ')" -ForegroundColor DarkYellow
    }
    
    # Log results
    $logLine = "$($results.Timestamp),$($results.Iteration),$($results.CreateGameMs),$($results.JoinGameMs),$($results.GetGameInfoMs),$($results.Errors),$($results.TotalRequests),$($results.ErrorRate),$($results.Status)"
    $logLine | Out-File -FilePath $logPath -Append -Encoding UTF8
    
    return $results
}

function Show-Summary {
    param($AllResults)
    
    Write-Host "`n=== PERFORMANCE MONITORING SUMMARY ===" -ForegroundColor Magenta
    
    $successfulTests = $AllResults | Where-Object { $_.CreateGameMs -ne $null }
    if ($successfulTests.Count -eq 0) {
        Write-Host "[X] No successful tests completed" -ForegroundColor DarkRed
        return
    }
    
    # Calculate statistics
    $createGameTimes = $successfulTests | Where-Object { $_.CreateGameMs } | ForEach-Object { $_.CreateGameMs }
    $joinGameTimes = $successfulTests | Where-Object { $_.JoinGameMs } | ForEach-Object { $_.JoinGameMs }
    $getInfoTimes = $successfulTests | Where-Object { $_.GetGameInfoMs } | ForEach-Object { $_.GetGameInfoMs }
    
    Write-Host "`nCreate Game Performance:" -ForegroundColor Cyan
    if ($createGameTimes.Count -gt 0) {
        $avgCreate = ($createGameTimes | Measure-Object -Average).Average
        $minCreate = ($createGameTimes | Measure-Object -Minimum).Minimum
        $maxCreate = ($createGameTimes | Measure-Object -Maximum).Maximum
        Write-Host "  Average: $([Math]::Round($avgCreate, 1))ms" -ForegroundColor Gray
        Write-Host "  Range: $minCreate - $maxCreate ms" -ForegroundColor Gray
        
        if ($avgCreate -gt $thresholds.CreateGameMs) {
            Write-Host "[X]   Average exceeds threshold ($($thresholds.CreateGameMs)ms)" -ForegroundColor DarkRed
        } else {
            Write-Host "[OK]  Performance within acceptable range" -ForegroundColor DarkGreen
        }
    }
    
    Write-Host "`nJoin Game Performance:" -ForegroundColor Cyan
    if ($joinGameTimes.Count -gt 0) {
        $avgJoin = ($joinGameTimes | Measure-Object -Average).Average
        $minJoin = ($joinGameTimes | Measure-Object -Minimum).Minimum
        $maxJoin = ($joinGameTimes | Measure-Object -Maximum).Maximum
        Write-Host "  Average: $([Math]::Round($avgJoin, 1))ms" -ForegroundColor Gray
        Write-Host "  Range: $minJoin - $maxJoin ms" -ForegroundColor Gray
        
        if ($avgJoin -gt $thresholds.JoinGameMs) {
            Write-Host "[X]   Average exceeds threshold ($($thresholds.JoinGameMs)ms)" -ForegroundColor DarkRed
        } else {
            Write-Host "[OK]  Performance within acceptable range" -ForegroundColor DarkGreen
        }
    }
    
    Write-Host "`nGet Info Performance:" -ForegroundColor Cyan
    if ($getInfoTimes.Count -gt 0) {
        $avgInfo = ($getInfoTimes | Measure-Object -Average).Average
        $minInfo = ($getInfoTimes | Measure-Object -Minimum).Minimum
        $maxInfo = ($getInfoTimes | Measure-Object -Maximum).Maximum
        Write-Host "  Average: $([Math]::Round($avgInfo, 1))ms" -ForegroundColor Gray
        Write-Host "  Range: $minInfo - $maxInfo ms" -ForegroundColor Gray
        
        if ($avgInfo -gt $thresholds.GetGameInfoMs) {
            Write-Host "[X]   Average exceeds threshold ($($thresholds.GetGameInfoMs)ms)" -ForegroundColor DarkRed
        } else {
            Write-Host "[OK]  Performance within acceptable range" -ForegroundColor DarkGreen
        }
    }
    
    # Error analysis
    $successfulResults = $AllResults | Where-Object { $null -ne $_.Errors -and $null -ne $_.TotalRequests }
    $totalErrors = ($successfulResults | Measure-Object -Property Errors -Sum).Sum
    $totalRequests = ($successfulResults | Measure-Object -Property TotalRequests -Sum).Sum
    $overallErrorRate = if ($totalRequests -gt 0) { [Math]::Round(($totalErrors / $totalRequests) * 100, 1) } else { 0 }

    Write-Host "`nError Analysis:" -ForegroundColor Cyan
    Write-Host "  Total Errors: $totalErrors" -ForegroundColor Gray
    Write-Host "  Total Requests: $totalRequests" -ForegroundColor Gray
    Write-Host "  Error Rate: $overallErrorRate%" -ForegroundColor Gray

    if ($overallErrorRate -gt $thresholds.ErrorRate) {
        Write-Host "[X]   Error rate exceeds threshold ($($thresholds.ErrorRate)%)\" -ForegroundColor DarkRed
    } else {
        Write-Host "[OK]  Error rate within acceptable range" -ForegroundColor DarkGreen
    }

    Write-Host "`nLog file saved: $logPath" -ForegroundColor Blue
}

# Main monitoring loop
Write-Host "Starting performance monitoring..." -ForegroundColor DarkYellow
Write-Host "Press Ctrl+C to stop early" -ForegroundColor DarkGray
Write-Host ""

$allResults = @()

try {
    while ((Get-Date) -lt $endTime) {
        $iteration++
        $result = Test-APIPerformance -Iteration $iteration
        $allResults += $result
        
        # Show progress
        $elapsed = (Get-Date) - $startTime
        Write-Host "  Progress: $([Math]::Round($elapsed.TotalMinutes, 1))/$DurationMinutes minutes | Next test in $IntervalSeconds seconds" -ForegroundColor Blue
        
        # Wait for next interval
        Start-Sleep -Seconds $IntervalSeconds
    }
}
catch {
    Write-Host "`nMonitoring stopped: $($_.Exception.Message)" -ForegroundColor DarkYellow
}

Write-Host "`nMonitoring completed!" -ForegroundColor DarkGreen
Show-Summary -AllResults $allResults
