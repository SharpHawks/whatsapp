# pgAdmin Setup Guide

## Overview

pgAdmin4 is included in the Docker Compose setup for easy database management and visualization.

## Access pgAdmin

After starting the Docker containers, pgAdmin will be available at:

```
http://localhost:5050
```

### Default Credentials

- **Email**: `admin@admin.com`
- **Password**: `admin`

> ⚠️ **Security Note**: Change these credentials in production by modifying the `PGADMIN_DEFAULT_EMAIL` and `PGADMIN_DEFAULT_PASSWORD` environment variables in `docker-compose.yml`.

## Connecting to PostgreSQL Database

### Step 1: Login to pgAdmin

1. Open your browser and navigate to `http://localhost:5050`
2. Login with the credentials above

### Step 2: Add New Server

1. Right-click on "Servers" in the left sidebar
2. Select "Register" → "Server..."

### Step 3: Configure Connection

#### General Tab
- **Name**: `WhatsApp API Database` (or any name you prefer)

#### Connection Tab
- **Host name/address**: `postgres` (Docker service name)
- **Port**: `5432`
- **Maintenance database**: `whatsapp_api`
- **Username**: `postgres`
- **Password**: `postgres`

#### Advanced Tab (Optional)
- **DB restriction**: `whatsapp_api` (to show only this database)

### Step 4: Save

Click "Save" to connect to the database.

## Common Tasks

### View Tables

1. Expand the server in the left sidebar
2. Navigate to: Databases → whatsapp_api → Schemas → public → Tables
3. Right-click on any table and select "View/Edit Data" → "All Rows"

### Run SQL Queries

1. Right-click on the database name
2. Select "Query Tool"
3. Write your SQL query and click the "Execute" button (▶️)

### Example Queries

```sql
-- View all bots
SELECT * FROM bots;

-- View all users
SELECT id, email, email_verified, created_at FROM users;

-- View messages for a specific bot
SELECT * FROM messages WHERE bot_id = 'YOUR_BOT_ID' ORDER BY timestamp DESC LIMIT 10;

-- Check bot connection status
SELECT id, name, phone_number, connection_status, qr_generated_at 
FROM bots 
WHERE is_active = true;

-- View user balances
SELECT u.email, b.amount, b.currency 
FROM users u 
LEFT JOIN balances b ON u.id = b.user_id;
```

### Export Data

1. Right-click on a table
2. Select "Import/Export..."
3. Choose "Export" and select your format (CSV, JSON, etc.)

### Backup Database

1. Right-click on the database name
2. Select "Backup..."
3. Choose format and location
4. Click "Backup"

## Troubleshooting

### Cannot Connect to Database

**Problem**: "could not connect to server: Connection refused"

**Solution**: 
- Ensure PostgreSQL container is running: `docker ps | grep postgres`
- Check that you're using `postgres` as the hostname (not `localhost`)
- Verify the port is `5432` (internal Docker port, not `5433`)

### Permission Denied

**Problem**: "permission denied for table..."

**Solution**:
- Ensure you're using the correct username (`postgres`)
- Check that the user has the necessary permissions

### pgAdmin Not Loading

**Problem**: Browser shows "This site can't be reached"

**Solution**:
- Check if pgAdmin container is running: `docker ps | grep pgadmin`
- Verify port 5050 is not in use by another application
- Check Docker logs: `docker logs whatsapp-pgadmin`

## Docker Commands

### Start pgAdmin
```bash
docker-compose up -d pgadmin
```

### Stop pgAdmin
```bash
docker-compose stop pgadmin
```

### View pgAdmin Logs
```bash
docker logs -f whatsapp-pgadmin
```

### Restart pgAdmin
```bash
docker-compose restart pgadmin
```

### Remove pgAdmin (including data)
```bash
docker-compose down
docker volume rm whatsapp-api-platform_pgadmin-data
```

## Security Best Practices

### For Production

1. **Change Default Credentials**
   ```yaml
   environment:
     PGADMIN_DEFAULT_EMAIL: your-secure-email@domain.com
     PGADMIN_DEFAULT_PASSWORD: your-secure-password
   ```

2. **Use Environment Variables**
   ```yaml
   environment:
     PGADMIN_DEFAULT_EMAIL: ${PGADMIN_EMAIL}
     PGADMIN_DEFAULT_PASSWORD: ${PGADMIN_PASSWORD}
   ```

3. **Restrict Access**
   - Don't expose pgAdmin port publicly
   - Use VPN or SSH tunnel for remote access
   - Consider removing pgAdmin from production entirely

4. **Enable Master Password**
   ```yaml
   environment:
     PGADMIN_CONFIG_MASTER_PASSWORD_REQUIRED: 'True'
   ```

## Useful Features

### Dashboard
- View server statistics
- Monitor active sessions
- Check database size

### Query History
- Access previously run queries
- Save frequently used queries

### ERD (Entity Relationship Diagram)
1. Right-click on a table
2. Select "Generate ERD"
3. Visualize table relationships

### Maintenance
- Vacuum tables
- Analyze tables
- Reindex

## Additional Resources

- [pgAdmin Documentation](https://www.pgadmin.org/docs/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Docker pgAdmin Image](https://hub.docker.com/r/dpage/pgadmin4/)
