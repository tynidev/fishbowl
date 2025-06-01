# Script: test-game-configurations.ps1
# Description: A comprehensive script to test game configurations for the Fishbowl API.
# Rewritten from scratch to provide a structured testing approach.

param (
    [string]$BaseUrl = "http://localhost:3001/api"
)

# --- Script Setup ---
Write-Host "=============================================" -ForegroundColor Magenta
Write-Host "  FISHBOWL API - CONFIGURATION TEST SUITE  " -ForegroundColor Magenta
Write-Host "=============================================" -ForegroundColor Magenta
Write-Host "Base URL: $BaseUrl" -ForegroundColor Gray

$Global:TestResults = @{
    Total = 0
    Passed = 0
    Failed = 0
    Skipped = 0
    Details = @()
}

$ErrorActionPreference = "Continue" # Allow script to continue on non-terminating errors

# --- Helper Functions ---

# Helper to log test results
function Add-TestResult {
    param (
        [string]$TestName,
        [bool]$Success,
        [string]$Message,
        [hashtable]$Details = @{
        }
    )
    $Global:TestResults.Total++
    if ($Success) {
        $Global:TestResults.Passed++
        Write-Host "  [PASS] $($TestName): $Message" -ForegroundColor DarkGreen
    } else {
        $Global:TestResults.Failed++
        Write-Host "  [FAIL] $($TestName): $Message" -ForegroundColor DarkRed
        if ($Details.Count -gt 0) {
            Write-Host "    Details:" -ForegroundColor DarkYellow
            $Details.GetEnumerator() | ForEach-Object { Write-Host "      $($_.Name): $($_.Value | ConvertTo-Json -Compress -Depth 3)" -ForegroundColor DarkYellow }
        }
    }
    $Global:TestResults.Details += @{
        Name = $TestName
        Status = if ($Success) { "Passed" } else { "Failed" }
        Message = $Message
        Details = $Details
    }
}

# Helper to make API calls
function Invoke-ApiRequest {
    param (
        [string]$Uri,
        [string]$Method,
        [object]$Body = $null,
        [string]$ContentType = "application/json",
        [bool]$ExpectSuccess = $true,
        [string]$TestName = "API Request"
    )
    try {
        $params = @{
            Uri = $Uri
            Method = $Method
            ContentType = $ContentType
            ErrorAction = 'Stop' # Make Invoke-RestMethod throw terminating for try/catch
        }
        if ($Body) {
            $params.Body = ($Body | ConvertTo-Json -Depth 5)
        }

        # Write-Host "  DEBUG: Invoking $Method $Uri with body $($params.Body)" -ForegroundColor DarkGray

        $response = Invoke-RestMethod @params
        
        if ($ExpectSuccess) {
            # Test result for this specific call will be added by the caller if needed for verification
            # This function primarily returns the response or handles expected/unexpected failures.
            return $response 
        } else {
            # This case means an error was expected, but the call succeeded
            Add-TestResult -TestName "$TestName - Expected Failure" -Success $false -Message "API call succeeded but was expected to fail." -Details @{ Response = $response }
            return $null 
        }
    }
    catch {
        $errorMessage = $_.Exception.Message
        $errorDetails = @{ Error = $errorMessage }
        if ($_.Exception.Response) {
            $statusCode = $_.Exception.Response.StatusCode.value__
            $errorDetails.StatusCode = $statusCode
            try {
                $responseStream = $_.Exception.Response.GetResponseStream()
                $streamReader = New-Object System.IO.StreamReader($responseStream)
                $responseBody = $streamReader.ReadToEnd()
                $streamReader.Close()
                $responseStream.Close()
                $errorDetails.ResponseBody = $responseBody
            } catch {
                $errorDetails.ResponseBody = "Failed to read error response body: $($_.Exception.Message)"
            }
        }

        if (-not $ExpectSuccess) {
            Add-TestResult -TestName "$TestName - Expected Failure" -Success $true -Message "API call failed as expected." -Details $errorDetails
            return $null # Success in terms of test expectation
        } else {
            Add-TestResult -TestName "$TestName - Expected Success" -Success $false -Message "API call failed unexpectedly." -Details $errorDetails
            return $null
        }
    }
}

# --- Test Data Definitions ---

$validGameCreations = @(
    @{ teams = 2; phrases = 3; timer = 30; description = "Minimum values" },
    @{ teams = 8; phrases = 10; timer = 180; description = "Maximum values" },
    @{ teams = 4; phrases = 5; timer = 60; description = "Default values" }
)

$invalidGameCreations = @(
    @{ teams = 1; phrases = 5; timer = 60; description = "Too few teams" },
    @{ teams = 9; phrases = 5; timer = 60; description = "Too many teams" },
    @{ teams = 4; phrases = 2; timer = 60; description = "Too few phrases" },
    @{ teams = 4; phrases = 11; timer = 60; description = "Too many phrases" },
    @{ teams = 4; phrases = 5; timer = 20; description = "Timer too short" },
    @{ teams = 4; phrases = 5; timer = 200; description = "Timer too long" }
)

# --- Test Execution ---

Write-Host "`n--- SECTION: Game Creation Tests ---" -ForegroundColor DarkYellow

# Test Valid Game Creations
Write-Host "`n  Sub-Section: Valid Game Creations" -ForegroundColor Cyan
$createdGameCodes = [System.Collections.Generic.List[string]]::new()
foreach ($config in $validGameCreations) {
    $testName = "Create Game - $($config.description)"
    $payload = @{
        name             = "Test Game - $($config.description)"
        hostPlayerName   = "Host-$(Get-Random -Maximum 10000)"
        teamCount        = $config.teams
        phrasesPerPlayer = $config.phrases
        timerDuration    = $config.timer
    }
    $response = Invoke-ApiRequest -Uri "$BaseUrl/games" -Method POST -Body $payload -ExpectSuccess $true -TestName $testName
    if ($response -and $response.gameCode) {
        Add-TestResult -TestName "$testName - Verification" -Success $true -Message "[OK] Game created with code: $($response.gameCode)."
        $createdGameCodes.Add($response.gameCode)
    } elseif ($response -eq $null -and ($Global:TestResults.Details | Where-Object {$_.Name -eq "$testName - Expected Success" -and $_.Status -eq "Failed"}).Count -eq 0) {
        # If response is null but Invoke-ApiRequest didn't log a failure for *this specific test name*, it means it was an unexpected null without exception.
        Add-TestResult -TestName "$testName - Verification" -Success $false -Message "[X] Game creation call returned null unexpectedly without Invoke-ApiRequest logging failure for this test."
    } elseif ($response) {
         Add-TestResult -TestName "$testName - Verification" -Success $false -Message "[X] GameCode missing in response." -Details @{ Response = $response }
    }
    # If $response is $null and Invoke-ApiRequest already logged a failure, we don't log again.
}

# Test Invalid Game Creations
Write-Host "`n  Sub-Section: Invalid Game Creations" -ForegroundColor Cyan
foreach ($config in $invalidGameCreations) {
    $testName = "Create Game (Invalid) - $($config.description)"
    $payload = @{
        name             = "Invalid Test Game - $($config.description)"
        hostPlayerName   = "Host-$(Get-Random -Maximum 10000)"
        teamCount        = $config.teams
        phrasesPerPlayer = $config.phrases
        timerDuration    = $config.timer
    }
    Invoke-ApiRequest -Uri "$BaseUrl/games" -Method POST -Body $payload -ExpectSuccess $false -TestName $testName
}


# --- Test Configuration Updates ---
$gameCodeToUpdate = $null
if ($createdGameCodes.Count -gt 0) {
    $gameCodeToUpdate = $createdGameCodes[0]
    Write-Host "`n--- SECTION: Game Configuration Updates (Using Game: $gameCodeToUpdate) ---" -ForegroundColor DarkYellow
} else {
    Write-Host "`n--- SECTION: Game Configuration Updates (SKIPPED) ---" -ForegroundColor DarkYellow
    Write-Host "  [ ! ] No games were successfully created in the previous step. Skipping update tests." -ForegroundColor DarkYellow
    # Estimate skipped tests: (valid updates * (1 API call + 1 verification GET + 1 overall result)) + (invalid updates * 1 API call)
    $validUpdateTestCount = @(
        @{ teamCount = 3; description = "Update: Increase teams" }
        @{ phrasesPerPlayer = 6; description = "Update: Change phrases" }
        @{ timerDuration = 120; description = "Update: Change timer" }
        @{ teamCount = 4; phrasesPerPlayer = 4; timerDuration = 75; description = "Update: Multiple changes" }
    ).Count
    $invalidUpdateTestCount = @(
        @{ teamCount = 10; description = "Invalid Update: Too many teams" }
        @{ phrasesPerPlayer = 1; description = "Invalid Update: Too few phrases" }
        @{ timerDuration = 300; description = "Invalid Update: Timer too long" }
    ).Count
    $Global:TestResults.Skipped += ($validUpdateTestCount * 3) + $invalidUpdateTestCount
}

if ($gameCodeToUpdate) {
    $validUpdates = @(
        @{ teamCount = 3; description = "Update: Increase teams" },
        @{ phrasesPerPlayer = 6; description = "Update: Change phrases" },
        @{ timerDuration = 120; description = "Update: Change timer" },
        @{ teamCount = 4; phrasesPerPlayer = 4; timerDuration = 75; description = "Update: Multiple changes" }
    )

    $invalidUpdates = @(
        @{ teamCount = 10; description = "Invalid Update: Too many teams" },
        @{ phrasesPerPlayer = 1; description = "Invalid Update: Too few phrases" },
        @{ timerDuration = 300; description = "Invalid Update: Timer too long" }
    )

    # Test Valid Configuration Updates
    Write-Host "`n  Sub-Section: Valid Configuration Updates" -ForegroundColor Cyan
    foreach ($updateConfig in $validUpdates) {
        $testNamePrefix = "$($updateConfig.description) on game $gameCodeToUpdate"
        $payload = $updateConfig.Clone()
        $payload.Remove("description")

        $updateResponse = Invoke-ApiRequest -Uri "$BaseUrl/games/$gameCodeToUpdate/config" -Method PUT -Body $payload -ExpectSuccess $true -TestName "$testNamePrefix - API Call"
        
        if ($updateResponse) { 
            $verifyResponse = Invoke-ApiRequest -Uri "$BaseUrl/games/$gameCodeToUpdate" -Method GET -ExpectSuccess $true -TestName "$testNamePrefix - Verification GET"
            if ($verifyResponse) {
                $mismatchedFields = @{}
                foreach ($keyToVerify in $payload.Keys) {
                    if ($verifyResponse.PSObject.Properties[$keyToVerify]) {
                        if ($verifyResponse.$keyToVerify -ne $payload.$keyToVerify) {
                            $mismatchedFields[$keyToVerify] = @{ Expected = $payload.$keyToVerify; Actual = $verifyResponse.$keyToVerify }
                        }
                    } else {
                        $mismatchedFields[$keyToVerify] = @{ Expected = $payload.$keyToVerify; Actual = "MISSING_IN_RESPONSE" }
                    }
                }
                if ($mismatchedFields.Count -eq 0) {
                    Add-TestResult -TestName "$testNamePrefix - Overall Verification" -Success $true -Message "[OK] All updated fields verified successfully."
                } else {
                    Add-TestResult -TestName "$testNamePrefix - Overall Verification" -Success $false -Message "[X] Some fields did not match after update." -Details $mismatchedFields
                }
            }
        }
    }

    # Test Invalid Configuration Updates
    Write-Host "`n  Sub-Section: Invalid Configuration Updates" -ForegroundColor Cyan
    foreach ($updateConfig in $invalidUpdates) {
        $testName = "$($updateConfig.description) on game $gameCodeToUpdate"
        $payload = $updateConfig.Clone()
        $payload.Remove("description")
        
        Invoke-ApiRequest -Uri "$BaseUrl/games/$gameCodeToUpdate/config" -Method PUT -Body $payload -ExpectSuccess $false -TestName $testName
    }
}


# --- Test Team Change Edge Cases ---
Write-Host "`n--- SECTION: Team Change Edge Cases ---" -ForegroundColor DarkYellow
$edgeCaseGameCode = $null
$edgeCaseSectionTestName = "Team Edge Case - Overall Section"
try {
    # 1. Create a game for this test
    $createGameTestName = "Team Edge Case - Create Game"
    $gamePayload = @{
        name             = "Team Edge Case Game"
        hostPlayerName   = "EdgeCaseHost-$(Get-Random -Maximum 10000)"
        teamCount        = 4
        phrasesPerPlayer = 3
        timerDuration    = 60
    }
    $gameResponse = Invoke-ApiRequest -Uri "$BaseUrl/games" -Method POST -Body $gamePayload -ExpectSuccess $true -TestName $createGameTestName
    if (-not ($gameResponse -and $gameResponse.gameCode)) {
        Add-TestResult -TestName $createGameTestName -Success $false -Message "[X] Failed to create game for edge case testing or gameCode missing." -Details @{ Response = $gameResponse }
        throw "Halting edge case tests: Prerequisite game creation failed."
    }
    $edgeCaseGameCode = $gameResponse.gameCode
    Add-TestResult -TestName "$createGameTestName - Verification" -Success $true -Message "[OK] Game $edgeCaseGameCode created."

    # 2. Add players
    $playerNames = @("PlayerA", "PlayerB", "PlayerC", "PlayerD", "PlayerE", "PlayerF")
    foreach ($playerName in $playerNames) {
        $joinPayload = @{ playerName = $playerName }
        $joinTestName = "Team Edge Case - Join $playerName to $edgeCaseGameCode"
        $joinResponse = Invoke-ApiRequest -Uri "$BaseUrl/games/$edgeCaseGameCode/join" -Method POST -Body $joinPayload -ExpectSuccess $true -TestName $joinTestName
        if (-not $joinResponse) { 
            # Failure already logged by Invoke-ApiRequest
            Write-Host "    [ ! ] Skipping further player additions due to join failure for $playerName" -ForegroundColor DarkYellow
            # Potentially throw here if all players are critical, or just continue with fewer players
        } else {
            Add-TestResult -TestName "$joinTestName - Verification" -Success $true -Message "[OK] $playerName joined game $edgeCaseGameCode."
        }
    }

    # 3. Reduce team count
    $reduceTeamTestName = "Team Edge Case - Reduce Teams to 2 in $edgeCaseGameCode"
    $reduceTeamPayload = @{ teamCount = 2 }
    $reduceResponse = Invoke-ApiRequest -Uri "$BaseUrl/games/$edgeCaseGameCode/config" -Method PUT -Body $reduceTeamPayload -ExpectSuccess $true -TestName $reduceTeamTestName
    
    if ($reduceResponse) {
        Add-TestResult -TestName "$reduceTeamTestName - Verification" -Success $true -Message "[OK] Team count reduction API call successful."
        # 4. Verify player redistribution
        $verifyPlayersTestName = "Team Edge Case - Get Players After Update in $edgeCaseGameCode"
        $playersAfterUpdate = Invoke-ApiRequest -Uri "$BaseUrl/games/$edgeCaseGameCode/players" -Method GET -ExpectSuccess $true -TestName $verifyPlayersTestName
        if ($playersAfterUpdate -and $playersAfterUpdate.players) {
            $teamCountsAfter = @{}
            foreach ($player in $playersAfterUpdate.players) {
                if ($player.teamName) { 
                    if (-not $teamCountsAfter.ContainsKey($player.teamName)) { $teamCountsAfter[$player.teamName] = 0 }
                    $teamCountsAfter[$player.teamName]++
                }
            }
            $actualTeamCount = $teamCountsAfter.Keys.Count
            if ($actualTeamCount -gt 0 -and $actualTeamCount -le 2) {
                 Add-TestResult -TestName "$verifyPlayersTestName - Team Count Verification" -Success $true -Message "[OK] Players correctly distributed into $actualTeamCount teams (expected <= 2). Distribution: $($teamCountsAfter | ConvertTo-Json -Compress -Depth 2)"
            } else {
                 Add-TestResult -TestName "$verifyPlayersTestName - Team Count Verification" -Success $false -Message "[X] Players distributed into $actualTeamCount teams (expected <= 2). Distribution: $($teamCountsAfter | ConvertTo-Json -Compress -Depth 2)" -Details $teamCountsAfter
            }
        } elseif($playersAfterUpdate) {
            Add-TestResult -TestName "$verifyPlayersTestName - Player List" -Success $false -Message "[X] Player list was empty or not in expected format after update." -Details @{ Response = $playersAfterUpdate }
        }
        # If $playersAfterUpdate is null, Invoke-ApiRequest already logged it.
    }
    Add-TestResult -TestName $edgeCaseSectionTestName -Success $true -Message "[OK] Team change edge case tests completed (individual results above)."

}
catch {
    # This catch is for the 'throw' or other unexpected script errors in this section
    Add-TestResult -TestName $edgeCaseSectionTestName -Success $false -Message "[X] An error occurred: $($_.Exception.Message)"
    if ($edgeCaseGameCode) {
        Write-Host "  [ ! ] Note: Edge case test section failed for game $edgeCaseGameCode" -ForegroundColor DarkYellow
    }
     $Global:TestResults.Skipped += 5 # Estimate tests skipped within this block due to early exit
}


# --- Summary ---
Write-Host "`n--- TEST SUMMARY ---" -ForegroundColor Magenta
Write-Host "Total Tests Attempted (approximate): $($Global:TestResults.Total)" -ForegroundColor Gray
Write-Host "Passed: $($Global:TestResults.Passed)" -ForegroundColor DarkGreen
Write-Host "Failed: $($Global:TestResults.Failed)" -ForegroundColor DarkRed
if ($Global:TestResults.Skipped -gt 0) {
    Write-Host "Skipped: $($Global:TestResults.Skipped)" -ForegroundColor DarkYellow
}

Write-Host "--------------------"
if ($Global:TestResults.Failed -eq 0) {
    if ($Global:TestResults.Skipped -eq 0) {
        Write-Host "ALL TESTS PASSED!" -ForegroundColor DarkGreen
    } else {
        Write-Host "ALL EXECUTED TESTS PASSED (some tests were skipped)." -ForegroundColor DarkYellow
    }
} else {
    Write-Host "SOME TESTS FAILED." -ForegroundColor DarkRed
    Write-Host "Failed Test Details:" -ForegroundColor DarkYellow
    $Global:TestResults.Details | Where-Object { $_.Status -eq "Failed" } | ForEach-Object {
        Write-Host "  - Name: $($_.Name)" -ForegroundColor DarkRed
        Write-Host "    Message: $($_.Message)" -ForegroundColor DarkRed
        if ($_.Details.Count -gt 0) {
            Write-Host "    Details:" -ForegroundColor DarkRed
            $_.Details.GetEnumerator() | ForEach-Object { Write-Host "      $($_.Name): $($_.Value | ConvertTo-Json -Compress -Depth 3)" -ForegroundColor DarkRed }
        }
    }
}

Write-Host "=============================================" -ForegroundColor Magenta
# End of script
