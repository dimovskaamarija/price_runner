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

# Ask user for MongoDB setup type
Write-Host "Choose MongoDB setup:" -ForegroundColor Cyan
Write-Host "1. Local MongoDB (mongodb://localhost:27017)"
Write-Host "2. MongoDB Atlas (cloud)"
$choice = Read-Host "Enter choice (1 or 2)"

if ($choice -eq "1") {
    # Local MongoDB
    $mongodbUri = "mongodb://localhost:27017/price_runner"
    Write-Host "Using local MongoDB: $mongodbUri" -ForegroundColor Green
} else {
    # MongoDB Atlas
    Write-Host ""
    Write-Host "Please provide your MongoDB Atlas connection string:" -ForegroundColor Cyan
    Write-Host "Format: mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/price_runner?retryWrites=true&w=majority" -ForegroundColor Gray
    $mongodbUri = Read-Host "Connection string"
    
    if ([string]::IsNullOrWhiteSpace($mongodbUri)) {
        Write-Host "No connection string provided. Using local MongoDB as fallback." -ForegroundColor Yellow
        $mongodbUri = "mongodb://localhost:27017/price_runner"
    }
}

# Create .env content
$envContent = @"
MONGODB_URI=$mongodbUri
PORT=3000
"@

# Write to file
try {
    $envContent | Out-File -FilePath $envFilePath -Encoding utf8 -NoNewline
    Write-Host ""
    Write-Host "✅ .env file created successfully at: $envFilePath" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "1. Test connection: cd backend && node setup-database.js" -ForegroundColor Yellow
    Write-Host "2. Start backend: cd backend && npm run start:dev" -ForegroundColor Yellow
} catch {
    Write-Host ""
    Write-Host "❌ Error creating .env file: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please create .env manually:" -ForegroundColor Yellow
    Write-Host "1. Create file: backend/.env" -ForegroundColor Gray
    Write-Host "2. Add: MONGODB_URI=$mongodbUri" -ForegroundColor Gray
}

