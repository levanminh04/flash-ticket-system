param(
    [Parameter(Mandatory = $true)]
    [string]$RepoRoot,

    [Parameter(Mandatory = $true)]
    [string]$ServiceDir,

    [Parameter(Mandatory = $true)]
    [string]$Title,

    [int]$DelaySeconds = 0
)

function Import-EnvFile {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    if (-not (Test-Path $Path)) {
        throw "Khong tim thay file env: $Path"
    }

    Get-Content $Path | ForEach-Object {
        $line = $_.Trim()

        if ($line -and -not $line.StartsWith("#")) {
            $parts = $line -split "=", 2

            if ($parts.Count -eq 2) {
                $name = $parts[0].Trim()
                $value = $parts[1]

                if (
                    ($value.StartsWith('"') -and $value.EndsWith('"')) -or
                    ($value.StartsWith("'") -and $value.EndsWith("'"))
                ) {
                    $value = $value.Substring(1, $value.Length - 2)
                }

                [System.Environment]::SetEnvironmentVariable($name, $value, "Process")
            }
        }
    }
}

$Host.UI.RawUI.WindowTitle = $Title

$envFile = Join-Path $RepoRoot ".env"
$servicePath = Join-Path $RepoRoot $ServiceDir

Import-EnvFile -Path $envFile
Set-Location $servicePath

if ($DelaySeconds -gt 0) {
    Write-Host "Cho $DelaySeconds s de tang phia truoc bat xong..."
    Start-Sleep -Seconds $DelaySeconds
}

Write-Host "Dang bat $Title..."
mvn spring-boot:run
