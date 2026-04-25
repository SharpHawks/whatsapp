# Adminer Setup Guide

## Overview

Adminer is a lightweight database management tool included in the Docker Compose setup. It's a simpler alternative to pgAdmin and works great for PostgreSQL management.

## Access Adminer

After starting the Docker containers, Adminer will be available at:

```
http://localhost:5050
```

## Connecting to PostgreSQL Database

### Login Credentials

When you open Adminer, you'll see a login form. Use these credentials:

- **System**: `PostgreSQL`
- **Server**: `postgres`
- **Username**: `postgres`
- **Password**: `postgres`
- **Database**: `whatsapp_api` (optional, leave empty to see all databases)

Click **Login** to connect.

## Features

### Browse Tables

After logging in, you'll see:
- List of all tables in the left sidebar
- Click on any table to view its data
- Use the "Select" link to query data

### Run SQL Queries

1. Click on "SQL command" in the left menu
2. Write your SQL query
3. Click "Execute" to run it

### Example Queries

```sql
-- View all bots
SELECT * FROM bots;

-- View all users
SELECT id, email, email_verified, created_at FROM users;

-- View messages for a specific bot
SELECT * FROM messages 
WHERE bot_id = 'YOUR_BOT_ID' 
ORDER BY timestamp DESC 
LIMIT 10;

-- Check bot connection status
SELECT id, name, phone_number, connection_status, qr_generated_at 
FROM bots 
WHERE is_active = true;

-- View user balances
SELECT u.email, b.amount, b.currency 
FROM users u 
LEFT JOIN balances b ON u.id = b.user_id;

-- Check QR code generation
SELECT id, name, qr_code IS NOT NULL as has_qr, qr_generated_at, connection_status
FROM bots
ORDER BY qr_generated_at DESC;
```

### Edit Data

1. Click on a table name
2. Click on any row to edit
3. Modify the values
4. Click "Save" to update

### Export Data

1. Click on a table name
2. Click "Export" at the top
3. Choose format (SQL, CSV, etc.)
4. Click "Export" to download

### Import Data

1. Click "Import" in the left menu
2. Choose your file
3. Click "Execute" to import

## Common Tasks

### View Table Structure

1. Click on a table name
2. Click "Show structure" to see columns, types, and indexes

### Create New Table

1. Click "Create table" in the left menu
2. Define columns and types
3. Click "Save" to create

### Run Migrations

You can paste migration SQL directly into the SQL command interface.

## Advantages of Adminer

- ✅ Lightweight (single PHP file)
- ✅ Fast and responsive
- ✅ Works on all platforms
- ✅ No complex configuration
- ✅ Supports multiple databases (PostgreSQL, MySQL, SQLite, etc.)
- ✅ Clean and simple interface

## Troubleshooting

### Cannot Connect to Database

**Problem**: "Unable to connect to database"

**Solution**:
- Ensure PostgreSQL container is running: `docker ps | grep postgres`
- Use `postgres` as the server name (not `localhost`)
- Verify credentials: postgres / postgres
- Check that port 5432 is correct (internal Docker port)

### Adminer Not Loading

**Problem**: Browser shows "This site can't be reached"

**Solution**:
- Check if Adminer container is running: `docker ps | grep adminer`
- Verify port 5050 is not in use: `netstat -ano | findstr :5050`
- Check Docker logs: `docker logs whatsapp-adminer`

### Slow Performance

**Solution**:
- Limit query results using LIMIT
- Use indexes for large tables
- Close unused connections

## Docker Commands

### Start Adminer
```bash
docker-compose up -d adminer
```

### Stop Adminer
```bash
docker-compose stop adminer
```

### View Adminer Logs
```bash
docker logs -f whatsapp-adminer
```

### Restart Adminer
```bash
docker-compose restart adminer
```

## Security Best Practices

### For Production

1. **Don't expose Adminer publicly**
   - Remove port mapping or use VPN/SSH tunnel
   - Consider removing Adminer from production entirely

2. **Use strong passwords**
   - Change PostgreSQL default password
   - Use environment variables

3. **Limit access**
   - Use firewall rules
   - Restrict to specific IP addresses

4. **Monitor access**
   - Check logs regularly
   - Watch for suspicious queries

## Comparison: Adminer vs pgAdmin

| Feature | Adminer | pgAdmin |
|---------|---------|---------|
| Size | ~500KB | ~100MB |
| Speed | Very Fast | Moderate |
| Interface | Simple | Feature-rich |
| Setup | Zero config | Requires setup |
| Platform Support | Excellent | Can have issues |
| Learning Curve | Easy | Moderate |

## Tips & Tricks

### Keyboard Shortcuts

- `Ctrl + Enter` - Execute query
- `Ctrl + S` - Save changes

### Quick Filters

In table view, you can quickly filter data:
1. Click on column header
2. Enter filter value
3. Press Enter

### Bookmarks

Save frequently used queries:
1. Run your query
2. Click "Bookmark" link
3. Give it a name
4. Access from "Bookmarks" menu

### Multiple Connections

You can open multiple browser tabs to work with different databases simultaneously.

## Additional Resources

- [Adminer Official Website](https://www.adminer.org/)
- [Adminer Documentation](https://www.adminer.org/en/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Docker Adminer Image](https://hub.docker.com/_/adminer)

## Why We Switched from pgAdmin

pgAdmin had platform compatibility issues on some systems (exec format error). Adminer is:
- More lightweight
- Works on all platforms
- Easier to set up
- Perfect for development and testing

For production environments, consider using:
- Direct `psql` connections
- Professional tools like DBeaver or DataGrip
- Cloud-native database management tools
