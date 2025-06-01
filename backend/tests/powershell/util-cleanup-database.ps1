# PowerShell Script to Clean Up Database Tables

$ErrorActionPreference = "Stop"

# --- Configuration ---
$DatabasePath = Join-Path $PSScriptRoot '..\..\database\fishbowl.db'
$TablesToClear = @(
    "games",
    "players",
    "phrases",
    "teams",
    "turn_phrases",
    "turns",
    "device_sessions"
)

# --- Helper Functions ---
function Show-Message {
    param (
        [Parameter(Mandatory=$true)]
        [string]$Message,
        [string]$Type = "INFO" # INFO, SUCCESS, WARNING, ERROR
    )
    $Color = switch ($Type) {
        "SUCCESS" { "DarkGreen" }
        "WARNING" { "DarkYellow" }
        "ERROR"   { "DarkRed" }
        default   { "Gray" }
    }
    Write-Host "[$Type] $Message" -ForegroundColor $Color
}

# --- Main Script ---
Show-Message "Starting database cleanup process..."

# Resolve the database path to an absolute path string
$ResolvedPathInfo = Resolve-Path -LiteralPath $DatabasePath -ErrorAction SilentlyContinue
if (-not $ResolvedPathInfo) {
    Show-Message "Database file not found at '$DatabasePath' (relative to script location: $PSScriptRoot)." "ERROR"
    exit 1
}
$AbsoluteDatabasePathString = $ResolvedPathInfo.Path

Show-Message "Database found: $AbsoluteDatabasePathString"

# Check for sqlite3 CLI
if (-not (Get-Command sqlite3 -ErrorAction SilentlyContinue)) {
    Show-Message "sqlite3 CLI not found. Cannot proceed." "ERROR"
    Show-Message "Please ensure sqlite3.exe is installed and in your PATH." "ERROR"
    Show-Message "Download from: https://www.sqlite.org/download.html" "ERROR"
    exit 1
}

try {
    foreach ($Table in $TablesToClear) {
        Show-Message "Clearing table: $Table..."
        $Query = "DELETE FROM $Table;"
        sqlite3 "`"$AbsoluteDatabasePathString`"" $Query
        Show-Message "Successfully cleared table: $Table." "SUCCESS"
    }

    Show-Message "All specified tables cleared."

    Show-Message "Reclaiming database space (VACUUM)..."
    sqlite3 "`"$AbsoluteDatabasePathString`"" "VACUUM;"
    Show-Message "Database VACUUM completed." "SUCCESS"

    Show-Message "Database cleanup process finished successfully." "SUCCESS"

} catch {
    Show-Message "An error occurred during the cleanup process:" "ERROR"
    Show-Message $_.Exception.Message "ERROR"
    exit 1
}
