$migrations = Get-ChildItem "migrations" -Filter "*.sql" | Sort-Object Name

foreach ($migration in $migrations) {
    Write-Host "Running: $($migration.Name)..."
    Get-Content $migration.FullName -Raw | docker exec -i whatsapp-postgres psql -U postgres -d whatsapp_api
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Migration failed: $($migration.Name)"
        exit 1
    }
    Write-Host "Completed: $($migration.Name)"
}

Write-Host "All migrations completed successfully!"
