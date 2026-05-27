$repoRoot = $PSScriptRoot
$runnerScript = Join-Path $repoRoot "scripts\Start-ServiceWithEnv.ps1"

Write-Host "====================================="
Write-Host "FLASH TICKET - RUN ALL MICROSERVICES"
Write-Host "====================================="
Write-Host ""
Write-Host "Dang mo Windows Terminal (wt.exe) voi nhieu tabs"
Write-Host "====================================="

if (Get-Command wt -ErrorAction SilentlyContinue) {
    $configServerDir = Join-Path $repoRoot "configserver"
    $eurekaDir = Join-Path $repoRoot "eureka"
    $apiGatewayDir = Join-Path $repoRoot "apigateway"
    $coreServiceDir = Join-Path $repoRoot "core-service"
    $userServiceDir = Join-Path $repoRoot "user-service"
    $discoveryServiceDir = Join-Path $repoRoot "discovery-service"

    wt -w new `
        new-tab -d "$configServerDir" --title "Config Server" powershell.exe -NoExit -ExecutionPolicy Bypass -File "$runnerScript" -RepoRoot "$repoRoot" -ServiceDir "configserver" -Title "Config Server" `; `
        new-tab -d "$eurekaDir" --title "Eureka Server" powershell.exe -NoExit -ExecutionPolicy Bypass -File "$runnerScript" -RepoRoot "$repoRoot" -ServiceDir "eureka" -Title "Eureka Server" -DelaySeconds 25 `; `
        new-tab -d "$apiGatewayDir" --title "API Gateway" powershell.exe -NoExit -ExecutionPolicy Bypass -File "$runnerScript" -RepoRoot "$repoRoot" -ServiceDir "apigateway" -Title "API Gateway" -DelaySeconds 45 `; `
        new-tab -d "$coreServiceDir" --title "Core Service" powershell.exe -NoExit -ExecutionPolicy Bypass -File "$runnerScript" -RepoRoot "$repoRoot" -ServiceDir "core-service" -Title "Core Service" -DelaySeconds 60 `; `
        new-tab -d "$userServiceDir" --title "User Service" powershell.exe -NoExit -ExecutionPolicy Bypass -File "$runnerScript" -RepoRoot "$repoRoot" -ServiceDir "user-service" -Title "User Service" -DelaySeconds 60 `; `
        new-tab -d "$discoveryServiceDir" --title "Discovery Service" powershell.exe -NoExit -ExecutionPolicy Bypass -File "$runnerScript" -RepoRoot "$repoRoot" -ServiceDir "discovery-service" -Title "Discovery Service" -DelaySeconds 60
}
else {
    Write-Host "KHONG TIM THAY WINDOWS TERMINAL TREN MAY BAN."
    Write-Host "Tinh nang gom vao 1 nut Tab chi ho tro tren Windows Terminal."
    Write-Host "Vui long vao Microsoft Store tai 'Windows Terminal'."
}
