# PowerShell script to create .env file for backend

$backendPath = Join-Path $PSScriptRoot "backend"
$envFilePath = Join-Path $backendPath ".env"

# Check if .env already exists
if (Test-Path $envFilePath) {
    Write-Host ".env file already exists at: $envFilePath" -ForegroundColor Yellow
    $overwrite = Read-Host "Overwrite? (y/n)"
    if ($overwrite -ne "y") {
        Write-Host "Skipped creating .env file" -ForegroundColor Yellow
        exit
    }
}

Write-Host "Creating .env file..." -ForegroundColor Green
Write-Host ""

# Ask user for PostgreSQL configuration
Write-Host "PostgreSQL Configuration" -ForegroundColor Cyan
Write-Host ""

$dbHost = Read-Host "Database host (default: localhost)"
if ([string]::IsNullOrWhiteSpace($dbHost)) {
    $dbHost = "localhost"
}

$dbPort = Read-Host "Database port (default: 5432)"
if ([string]::IsNullOrWhiteSpace($dbPort)) {
    $dbPort = "5432"
}

$dbUsername = Read-Host "Database username (default: postgres)"
if ([string]::IsNullOrWhiteSpace($dbUsername)) {
    $dbUsername = "postgres"
}

$dbPassword = Read-Host "Database password" -AsSecureString
$dbPasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($dbPassword))

$dbDatabase = Read-Host "Database name (default: price_runner)"
if ([string]::IsNullOrWhiteSpace($dbDatabase)) {
    $dbDatabase = "price_runner"
}

# Create .env content
$envContent = @"
# PostgreSQL Configuration
DB_HOST=$dbHost
DB_PORT=$dbPort
DB_USERNAME=$dbUsername
DB_PASSWORD=$dbPasswordPlain
DB_DATABASE=$dbDatabase

# Server Port
PORT=3000

# Environment
NODE_ENV=development
"@

# Write to file
try {
    $envContent | Out-File -FilePath $envFilePath -Encoding utf8 -NoNewline
    Write-Host ""
    Write-Host "✅ .env file created successfully at: $envFilePath" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "1. Setup database: cd backend && node setup-postgres.js" -ForegroundColor Yellow
    Write-Host "2. Start backend: cd backend && npm run start:dev" -ForegroundColor Yellow
} catch {
    Write-Host ""
    Write-Host "❌ Error creating .env file: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please create .env manually:" -ForegroundColor Yellow
    Write-Host "1. Create file: backend/.env" -ForegroundColor Gray
    Write-Host "2. Add PostgreSQL configuration" -ForegroundColor Gray
}
