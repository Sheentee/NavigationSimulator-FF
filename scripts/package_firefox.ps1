$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Split-Path -Parent $scriptDir
$distsDir = Join-Path $rootDir "dists"
$manifestPath = Join-Path $rootDir "manifest.json"

# Read version from manifest
$manifest = Get-Content $manifestPath | ConvertFrom-Json
$version = $manifest.version

$zipName = "NavigationSimulator-firefox_v$version.zip"
$xpiName = "NavigationSimulator-firefox_v$version.xpi"
$zipPath = Join-Path $distsDir $zipName
$xpiPath = Join-Path $distsDir $xpiName

# Create dist directory
if (-not (Test-Path $distsDir)) {
    New-Item -ItemType Directory -Path $distsDir | Out-Null
    Write-Host "Created dist directory."
}

# Remove existing files
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
if (Test-Path $xpiPath) { Remove-Item $xpiPath -Force }

$itemsToPackage = @(
    "icons",
    "about-sheentee.js",
    "background.js",
    "manifest.json",
    "popup.html",
    "popup.js",
    "styles.css"
)
$files = Get-ChildItem -Path $itemsToPackage -Recurse | Where-Object { -not $_.PSIsContainer }

# Create zip using .NET to ensure proper path separators (forward slashes)
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zipFile = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)

try {
    Write-Host "Zipping the following files/directories:"
    
    foreach ($file in $files) {
        # Calculate relative path
        $relativePath = $file.FullName.Substring($rootDir.Length + 1)
        
        # Normalize to forward slashes for ZIP compatibility
        $entryName = $relativePath.Replace('\', '/')
        
        # Determine strict casing or just use as is (Windows is case insensitive, but ZIP/Firefox isn't)
        # We use the name as found on disk.
        
        if ($file.PSIsContainer) {
            # Directories don't strictly need entries unless empty, but if we want to be explicit:
            if (-not $entryName.EndsWith('/')) {
                $entryName += '/'
            }
            $null = $zipFile.CreateEntry($entryName)
        }
        else {
            # Create entry and copy content manually to avoid reliance on extension methods
            $entry = $zipFile.CreateEntry($entryName)
            $entryStream = $entry.Open()
            $fileStream = [System.IO.File]::OpenRead($file.FullName)
            try {
                $fileStream.CopyTo($entryStream)
            }
            finally {
                $fileStream.Dispose()
                $entryStream.Dispose()
            }
            Write-Host "  $entryName"
        }
    }
}
catch {
    throw $_
}
finally {
    $zipFile.Dispose()
}

# Rename to .xpi
Rename-Item -Path $zipPath -NewName $xpiName
Write-Host "Firefox extension packaged: $xpiPath"