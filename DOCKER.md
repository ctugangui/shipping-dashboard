# Docker Deployment Guide

This guide explains how to run the Shipping Dashboard application using Docker and Docker Compose.

## Prerequisites

- Docker installed on your system
- Docker Compose installed (usually comes with Docker Desktop)
- A `.env` file with your API credentials (see `.env.example`)

## Quick Start

### 1. Build and Run

```bash
docker-compose up --build
```

This command will:
- Build the Docker image from the Dockerfile
- Install all dependencies
- Generate Prisma Client
- Build the TypeScript code
- Start the application on port 3000

### 2. Access the Application

Open your browser and navigate to:
```
http://localhost:3000
```

### 3. Stop the Application

Press `Ctrl+C` in the terminal, or run:
```bash
docker-compose down
```

## Data Persistence

The SQLite database is persisted using a Docker volume mount:
- **Host path:** `./prisma`
- **Container path:** `/app/prisma`

This means your shipment data will persist even when you stop and restart the container.

## Environment Variables

The application requires the following environment variables (configured in `.env`):

### Server Configuration
- `PORT` - Server port (default: 3000)
- `HOST` - Server host (default: 0.0.0.0)
- `NODE_ENV` - Environment mode (production in Docker)
- `DATABASE_URL` - SQLite database path

### UPS API
- `UPS_BASE_URL` - UPS API endpoint
- `UPS_CLIENT_ID` - Your UPS client ID
- `UPS_CLIENT_SECRET` - Your UPS client secret
- `UPS_ACCOUNT_NUMBER` - Your UPS account number

### USPS API
- `USPS_CLIENT_ID` - Your USPS client ID
- `USPS_CLIENT_SECRET` - Your USPS client secret
- `USPS_BASE_URL` - USPS API endpoint

## Docker Commands

### Build the image
```bash
docker-compose build
```

### Run in detached mode (background)
```bash
docker-compose up -d
```

### View logs
```bash
docker-compose logs -f
```

### Stop the container
```bash
docker-compose down
```

### Rebuild from scratch (no cache)
```bash
docker-compose build --no-cache
docker-compose up
```

### Access container shell
```bash
docker-compose exec shipping-dashboard sh
```

## Dockerfile Overview

The Dockerfile uses a multi-stage approach:

1. **Base Image:** `node:20-alpine` (lightweight Linux distribution)
2. **Dependencies:** Installs npm packages using `npm ci`
3. **Prisma:** Generates Prisma Client
4. **Build:** Compiles TypeScript to JavaScript
5. **Optimization:** Removes dev dependencies to reduce image size
6. **Runtime:** Runs the compiled application

## Troubleshooting

### Port already in use
If port 3000 is already in use, you can change it in `docker-compose.yml`:
```yaml
ports:
  - "3001:3000"  # Maps host port 3001 to container port 3000
```

### Database issues
If you encounter database issues, you may need to:
1. Stop the container: `docker-compose down`
2. Delete the database: `rm prisma/dev.db`
3. Rebuild and restart: `docker-compose up --build`

### View container logs
```bash
docker-compose logs shipping-dashboard
```

### Clear everything and start fresh
```bash
docker-compose down -v
docker-compose build --no-cache
docker-compose up
```

## Production Deployment

For production deployment, consider:

1. **Use environment-specific .env files**
2. **Set up proper secrets management** (don't commit `.env` to git)
3. **Configure reverse proxy** (nginx, Traefik, etc.)
4. **Set up SSL/TLS certificates**
5. **Configure logging and monitoring**
6. **Use Docker secrets** for sensitive data
7. **Consider using a managed database** instead of SQLite for scalability

## File Structure

```
.
├── Dockerfile              # Docker image definition
├── docker-compose.yml      # Docker Compose orchestration
├── .dockerignore          # Files to exclude from Docker build
├── .env                   # Environment variables (not in git)
├── .env.example           # Example environment variables
└── prisma/
    └── dev.db            # SQLite database (persisted via volume)
```
