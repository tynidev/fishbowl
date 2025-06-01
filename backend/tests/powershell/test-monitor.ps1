# Performance Monitoring Script for REST API
# Continuously monitors API performance and alerts on issues

param(
    [string]$BaseUrl = "http://localhost:3001/api",
    [int]$IntervalSeconds = 30,
    [int]$DurationMinutes = 10,
    [string]$LogFile = "api-performance.log"
)

Write-Host "=== API PERFORMANCE MONITOR ===" -ForegroundColor Cyan
Write-Host "Monitoring: $BaseUrl" -ForegroundColor White
Write-Host "Interval: $IntervalSeconds seconds" -ForegroundColor White
Write-Host "Duration: $DurationMinutes minutes" -ForegroundColor White
Write-Host "Log File: $LogFile" -ForegroundColor White
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
    Write-Host "[$($results.Timestamp)] Test $Iteration - Creating game..." -ForegroundColor Gray
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
        Write-Host "  ✓ Game created: $gameCode ($($results.CreateGameMs)ms)" -ForegroundColor Green
    }
    catch {
        $stopwatch.Stop()
        $results.Errors++
        Write-Host "  ✗ Game creation failed: $($_.Exception.Message)" -ForegroundColor Red
    }
    finally {
        $results.TotalRequests++
    }
    
    # Test 2: Join Game (if creation succeeded)
    if ($gameCode) {
        Write-Host "  Joining game..." -ForegroundColor Gray
        $stopwatch.Restart()
        try {
            $playerData = @{ playerName = "MonitorPlayer$Iteration" } | ConvertTo-Json
            $player = Invoke-RestMethod -Uri "$BaseUrl/games/$gameCode/join" -Method POST -Body $playerData -ContentType "application/json"
            $stopwatch.Stop()
            $results.JoinGameMs = $stopwatch.ElapsedMilliseconds
            Write-Host "  ✓ Player joined ($($results.JoinGameMs)ms)" -ForegroundColor Green
        }
        catch {
            $stopwatch.Stop()
            $results.Errors++
            Write-Host "  ✗ Join failed: $($_.Exception.Message)" -ForegroundColor Red
        }
        finally {
            $results.TotalRequests++
        }
        
        # Test 3: Get Game Info
        Write-Host "  Getting game info..." -ForegroundColor Gray
        $stopwatch.Restart()
        try {
            $gameInfo = Invoke-RestMethod -Uri "$BaseUrl/games/$gameCode" -Method GET
            $stopwatch.Stop()
            $results.GetGameInfoMs = $stopwatch.ElapsedMilliseconds
            Write-Host "  ✓ Game info retrieved ($($results.GetGameInfoMs)ms)" -ForegroundColor Green
        }
        catch {
            $stopwatch.Stop()
            $results.Errors++
            Write-Host "  ✗ Get game info failed: $($_.Exception.Message)" -ForegroundColor Red
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
        Write-Host "  ⚠ Performance issues detected: $($issues -join ', ')" -ForegroundColor Yellow
    }
    
    # Log results
    $logLine = "$($results.Timestamp),$($results.Iteration),$($results.CreateGameMs),$($results.JoinGameMs),$($results.GetGameInfoMs),$($results.Errors),$($results.TotalRequests),$($results.ErrorRate),$($results.Status)"
    $logLine | Out-File -FilePath $logPath -Append -Encoding UTF8
    
    return $results
}

function Show-Summary {
    param($AllResults)
    
    Write-Host "`n=== PERFORMANCE MONITORING SUMMARY ===" -ForegroundColor Cyan
    
    $successfulTests = $AllResults | Where-Object { $_.CreateGameMs -ne $null }
    if ($successfulTests.Count -eq 0) {
        Write-Host "No successful tests completed" -ForegroundColor Red
        return
    }
    
    # Calculate statistics
    $createGameTimes = $successfulTests | Where-Object { $_.CreateGameMs } | ForEach-Object { $_.CreateGameMs }
    $joinGameTimes = $successfulTests | Where-Object { $_.JoinGameMs } | ForEach-Object { $_.JoinGameMs }
    $getInfoTimes = $successfulTests | Where-Object { $_.GetGameInfoMs } | ForEach-Object { $_.GetGameInfoMs }
    
    Write-Host "`nCreate Game Performance:" -ForegroundColor Yellow
    if ($createGameTimes.Count -gt 0) {
        $avgCreate = ($createGameTimes | Measure-Object -Average).Average
        $minCreate = ($createGameTimes | Measure-Object -Minimum).Minimum
        $maxCreate = ($createGameTimes | Measure-Object -Maximum).Maximum
        Write-Host "  Average: $([Math]::Round($avgCreate, 1))ms" -ForegroundColor White
        Write-Host "  Range: $minCreate - $maxCreate ms" -ForegroundColor White
        
        if ($avgCreate -gt $thresholds.CreateGameMs) {
            Write-Host "  ⚠ Average exceeds threshold ($($thresholds.CreateGameMs)ms)" -ForegroundColor Red
        } else {
            Write-Host "  ✓ Performance within acceptable range" -ForegroundColor Green
        }
    }
    
    Write-Host "`nJoin Game Performance:" -ForegroundColor Yellow
    if ($joinGameTimes.Count -gt 0) {
        $avgJoin = ($joinGameTimes | Measure-Object -Average).Average
        $minJoin = ($joinGameTimes | Measure-Object -Minimum).Minimum
        $maxJoin = ($joinGameTimes | Measure-Object -Maximum).Maximum
        Write-Host "  Average: $([Math]::Round($avgJoin, 1))ms" -ForegroundColor White
        Write-Host "  Range: $minJoin - $maxJoin ms" -ForegroundColor White
        
        if ($avgJoin -gt $thresholds.JoinGameMs) {
            Write-Host "  ⚠ Average exceeds threshold ($($thresholds.JoinGameMs)ms)" -ForegroundColor Red
        } else {
            Write-Host "  ✓ Performance within acceptable range" -ForegroundColor Green
        }
    }
    
    Write-Host "`nGet Info Performance:" -ForegroundColor Yellow
    if ($getInfoTimes.Count -gt 0) {
        $avgInfo = ($getInfoTimes | Measure-Object -Average).Average
        $minInfo = ($getInfoTimes | Measure-Object -Minimum).Minimum
        $maxInfo = ($getInfoTimes | Measure-Object -Maximum).Maximum
        Write-Host "  Average: $([Math]::Round($avgInfo, 1))ms" -ForegroundColor White
        Write-Host "  Range: $minInfo - $maxInfo ms" -ForegroundColor White
        
        if ($avgInfo -gt $thresholds.GetGameInfoMs) {
            Write-Host "  ⚠ Average exceeds threshold ($($thresholds.GetGameInfoMs)ms)" -ForegroundColor Red
        } else {
            Write-Host "  ✓ Performance within acceptable range" -ForegroundColor Green
        }
    }
    
    # Error analysis
    $totalErrors = ($AllResults | Measure-Object -Property Errors -Sum).Sum
    $totalRequests = ($AllResults | Measure-Object -Property TotalRequests -Sum).Sum
    $overallErrorRate = if ($totalRequests -gt 0) { [Math]::Round(($totalErrors / $totalRequests) * 100, 1) } else { 0 }
    
    Write-Host "`nError Analysis:" -ForegroundColor Yellow
    Write-Host "  Total Errors: $totalErrors" -ForegroundColor White
    Write-Host "  Total Requests: $totalRequests" -ForegroundColor White
    Write-Host "  Error Rate: $overallErrorRate%" -ForegroundColor White
    
    if ($overallErrorRate -gt $thresholds.ErrorRate) {
        Write-Host "  ⚠ Error rate exceeds threshold ($($thresholds.ErrorRate)%)" -ForegroundColor Red
    } else {
        Write-Host "  ✓ Error rate within acceptable range" -ForegroundColor Green
    }
    
    Write-Host "`nLog file saved: $logPath" -ForegroundColor Cyan
}

# Main monitoring loop
Write-Host "Starting performance monitoring..." -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop early" -ForegroundColor Gray
Write-Host ""

$allResults = @()

try {
    while ((Get-Date) -lt $endTime) {
        $iteration++
        $result = Test-APIPerformance -Iteration $iteration
        $allResults += $result
        
        # Show progress
        $elapsed = (Get-Date) - $startTime
        $remaining = $endTime - (Get-Date)
        Write-Host "  Progress: $([Math]::Round($elapsed.TotalMinutes, 1))/$DurationMinutes minutes | Next test in $IntervalSeconds seconds" -ForegroundColor Cyan
        
        # Wait for next interval
        Start-Sleep -Seconds $IntervalSeconds
    }
}
catch {
    Write-Host "`nMonitoring stopped: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host "`nMonitoring completed!" -ForegroundColor Green
Show-Summary -AllResults $allResults
