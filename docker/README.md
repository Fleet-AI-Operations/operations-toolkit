# Docker Deployment

This directory contains Docker configuration for running the Operations Tools in a containerized environment.

## 🚀 Quick Start

### Prerequisites

- Docker Desktop installed and running
- LM Studio running on host (if using local AI) at http://localhost:1234

### Start the Application

```bash
# From the docker directory
cd docker
docker-compose up -d
```

This will:
1. Start PostgreSQL database on port 5433
2. Auto-run `supabase/setup.sql` (auth schema + RLS)
3. Generate Prisma Client
4. Start the Next.js application on port 3000

Access the application at http://localhost:3000

## 📋 Services

### Main Services

- **db** - PostgreSQL 15 database (auto-runs setup.sql on first start)
- **migrations** - Generates Prisma Client (schema already initialized by db)
- **app** - Next.js application (production build)

### Optional Services

- **studio** - Prisma Studio for database management (port 5555)

To start Prisma Studio:
```bash
docker-compose --profile tools up studio
```

## ⚙️ Configuration

### Environment Variables

The application uses `.env.docker` for configuration. Key variables:

- **DATABASE_URL** - PostgreSQL connection string
- **AI_HOST** - LM Studio endpoint (uses host.docker.internal to reach host machine)
- **LLM_MODEL** - AI model name
- **EMBEDDING_MODEL** - Embedding model name

### Using OpenRouter Instead of LM Studio

Edit `.env.docker` and uncomment the OpenRouter section:

```bash
OPENROUTER_API_KEY="sk-or-v1-your-key-here"
OPENROUTER_LLM_MODEL="gemini-3-flash-preview"
OPENROUTER_EMBEDDING_MODEL="openai/text-embedding-3-small"
```

## 🔧 Common Operations

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f app
```

### Stop Services

```bash
docker-compose down
```

### Stop and Remove Volumes (Clear Database)

```bash
docker-compose down -v
```

### Rebuild After Code Changes

```bash
docker-compose up -d --build app
```

### Access Database

```bash
# Using psql
docker exec -it percentage-tool-db psql -U pertool -d postgres

# Or use Prisma Studio
docker-compose --profile tools up studio
# Access at http://localhost:5555
```

### Run Migrations Manually

```bash
docker-compose run --rm migrations
```

## 🗃️ Database Management

### Initial Setup

The database is automatically initialized on first startup:

1. **PostgreSQL Initialization** (automatic):
   - Mounts `supabase/setup.sql` to `/docker-entrypoint-initdb.d/`
   - PostgreSQL runs it automatically during first startup
   - Creates auth schema, profiles table, RLS policies

2. **Prisma Client Generation**:
   - Migrations service generates Prisma Client
   - No manual migration running needed (db already initialized)

3. **Application Tables**:
   - Created by Prisma automatically when app starts
   - Includes projects, data_records, ingest_jobs, etc.

**Note on Schema Files:**
- **Docker**: PostgreSQL auto-runs `supabase/setup.sql` (auth only)
- **Local Supabase**: Uses `supabase/migrations/` (full schema management)
- **Both**: Application tables managed by Prisma

### Create Admin User

1. Access the application at http://localhost:3000
2. Sign up with an email (note: emails won't actually send in Docker mode)
3. Access the database:
   ```bash
   docker exec -it percentage-tool-db psql -U pertool -d postgres
   ```
4. Update user role:
   ```sql
   UPDATE public.profiles SET role = 'ADMIN' WHERE email = 'your-email@example.com';
   ```

### Backup Database

```bash
docker exec percentage-tool-db pg_dump -U pertool postgres > backup.sql
```

### Restore Database

```bash
cat backup.sql | docker exec -i percentage-tool-db psql -U pertool postgres
```

## 🔍 Troubleshooting

### Application Can't Connect to Database

1. Check if database is running:
   ```bash
   docker-compose ps
   ```

2. Check database logs:
   ```bash
   docker-compose logs db
   ```

3. Verify database is healthy:
   ```bash
   docker exec percentage-tool-db pg_isready -U pertool
   ```

### Migrations Fail

1. View migration logs:
   ```bash
   docker-compose logs migrations
   ```

2. Reset and retry:
   ```bash
   docker-compose down -v
   docker-compose up -d
   ```

### Application Can't Reach LM Studio

Ensure LM Studio is:
1. Running on host machine
2. Listening on all interfaces (0.0.0.0:1234), not just localhost
3. CORS is enabled in LM Studio settings

Test connection:
```bash
docker-compose exec app wget -O- http://host.docker.internal:1234/v1/models
```

### Port Already in Use

Change port mappings in `docker-compose.yml`:

```yaml
ports:
  - "3001:3000"  # Change 3000 to 3001
```

## 🏗️ Architecture

### Network Flow

```
User -> http://localhost:3000 -> app container
                                   |
                                   v
                              db container (PostgreSQL)
                                   |
                                   v
                              host.docker.internal:1234 (LM Studio)
```

### Directory Structure

```
docker/
├── docker-compose.yml    # Service orchestration
├── Dockerfile            # Next.js app container
├── .dockerignore        # Files to exclude from build
└── README.md            # This file

Root files:
├── .env.docker          # Docker environment variables
└── supabase/setup.sql   # Auth schema (auto-loaded by PostgreSQL)
```

## 📊 Development vs Production

This Docker setup is optimized for local development and testing. For production deployment:

- Use Supabase Cloud for database and auth
- Use Vercel or similar platform for Next.js hosting
- See [Documentation/VERCEL.md](../Documentation/VERCEL.md) for production deployment

## ⚠️ Important Notes

1. **Auth Limitations**: Docker mode uses a simplified auth system without full Supabase features (magic links, OAuth, etc.)

2. **Email**: Emails are not sent in Docker mode. You'll need to manually activate users via SQL.

3. **Data Persistence**: Database data is stored in Docker volumes. Use `docker-compose down -v` to clear all data.

4. **Security**: The `.env.docker` file contains default credentials suitable for local development only. Change these for production use.

5. **LM Studio**: Must be running on the host machine for AI features to work. Configure LM Studio to accept connections from Docker (0.0.0.0:1234).

## 🔗 Related Documentation

- [Local Development Guide](../LOCALDEV_QUICKSTART.md)
- [Full Setup Guide](../Documentation/SETUP.md)
- [User Guide](../Documentation/USER_GUIDE.md)
