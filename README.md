# 📦 Shipping Dashboard

A professional e-commerce shipping dashboard backend API built with modern Node.js.

---

## 🛠 Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **Node.js** | v22+ | Runtime environment |
| **Express** | v4.x | Web framework |
| **Prisma** | Latest | ORM & database toolkit |
| **SQLite** | v3 | Database (development) |

---

## 🚀 Getting Started

### Prerequisites

- Node.js v22 or higher
- npm or yarn

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd shipping-dashboard
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**

   ```bash
   cp .env.example .env
   ```

   Update `.env` with your configuration:

   ```env
   PORT=3000
   NODE_ENV=development
   DATABASE_URL="file:./dev.db"
   ```

4. **Initialize the database** (after setting up Prisma)

   ```bash
   npx prisma migrate dev --name init
   ```

5. **Start the development server**

   ```bash
   npm run dev
   ```

   The server will start at `http://localhost:3000`

---

## 📡 API Endpoints

### Health Check

```
GET /api/health
```

Returns the current server status and uptime.

**Response:**

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 123.456,
  "environment": "development"
}
```

---

## 📁 Project Structure

```
shipping-dashboard/
├── src/
│   └── server.js       # Express application entry point
├── prisma/
│   └── schema.prisma   # Database schema (to be created)
├── .env                # Environment variables
├── .gitignore          # Git ignore rules
├── package.json        # Project configuration
└── README.md           # Documentation
```

---

## 🧪 Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start production server |
| `npm run dev` | Start development server with hot reload |
| `npm run lint` | Run ESLint |
| `npm test` | Run tests |

---

## 📝 License

MIT
