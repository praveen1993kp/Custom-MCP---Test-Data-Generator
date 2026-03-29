# Test Data MCP Server

A **Model Context Protocol (MCP) server** for QA test data generation and retrieval. This server provides tools to generate synthetic test data using Faker and fetch real prospect leads from an Opentaps CRM database.

## 🎯 Overview

The Test Data MCP Server implements the **Model Context Protocol** to expose two powerful tools for test data management:

- **`createTestData`** - Generate unlimited synthetic test data in-memory using Faker (no database required)
- **`getLatestProspects`** - Fetch real prospect leads from Opentaps CRM MySQL database

The server runs as a JSON-RPC 2.0 server over stdio and integrates seamlessly with Claude and other AI models via MCP.

## ✨ Features

- 🚀 **Zero-Config Test Data Generation** - Create fake prospects with Faker (works offline)
- 💾 **Database Integration** - Fetch real data from Opentaps CRM
- 🏢 **Multiple Company Styles** - Random companies, Indian IT firms, or US Tech companies
- 🔧 **Lazy DB Loading** - Server starts without DB config; DB only loads when needed
- 📊 **Flexible Field Selection** - Request only the fields you need
- 🎯 **High Performance** - Generates 100+ records per call
- 🧑‍💻 **TypeScript** - Fully typed for better development experience

## 🚀 Quick Start

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd test-data-mcp-server

# Install dependencies
npm install

# Build TypeScript
npm run build
```

### Configuration

Create a `.env` file in the project root (optional - only needed for `getLatestProspects`):

```env
DB_HOST=your-database-host
DB_PORT=3306
DB_NAME=opentaps
DB_USER=your-username
DB_PASSWORD=your-password
```

### Start the Server

```bash
# Production
npm start

# Development with auto-reload
npm run dev
```

The server will start and listen for JSON-RPC 2.0 requests over stdio.

## 📚 API Reference

### Tool 1: createTestData

Generate synthetic test data using Faker. **No database required**.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `count` | number | ✅ Yes | - | Number of records to generate (1-100) |
| `companyStyle` | string | ❌ No | `random` | Company name style: `random`, `indian-it`, or `us-tech` |

#### Company Styles

- **`random`** - Faker-generated random company names
- **`indian-it`** - Major Indian IT companies (TCS, Infosys, Wipro, HCL, Tech Mahindra, etc.)
- **`us-tech`** - Major US tech companies (Google, Amazon, Microsoft, Apple, Meta, etc.)

#### Response

Returns an array of prospect objects:

```json
[
  {
    "firstName": "John",
    "lastName": "Smith",
    "companyName": "Acme Corporation"
  },
  {
    "firstName": "Jane",
    "lastName": "Doe",
    "companyName": "TCS"
  }
]
```

#### Example Usage

```javascript
// Generate 10 random prospects
{
  "jsonrpc": "2.0",
  "method": "tools/createTestData",
  "params": {
    "count": 10,
    "companyStyle": "random"
  }
}

// Generate 50 prospects from Indian IT companies
{
  "jsonrpc": "2.0",
  "method": "tools/createTestData",
  "params": {
    "count": 50,
    "companyStyle": "indian-it"
  }
}
```

---

### Tool 2: getLatestProspects

Fetch the latest prospect leads from the Opentaps CRM database.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `fields` | array | ✅ Yes | - | Fields to include: `firstName`, `lastName`, `companyName`, `createdDate` |
| `limit` | number | ❌ No | 10 | Maximum records to return (max: 50) |

#### Response

Returns an array of prospect records with `partyId` always included:

```json
[
  {
    "partyId": "10001",
    "firstName": "Alice",
    "lastName": "Johnson",
    "companyName": "Tech Solutions Inc",
    "createdDate": "2024-01-15T10:30:00Z"
  },
  {
    "partyId": "10002",
    "firstName": "Bob",
    "lastName": "Wilson",
    "companyName": "Global Enterprises",
    "createdDate": "2024-01-16T14:20:00Z"
  }
]
```

#### Example Usage

```javascript
// Get 10 latest prospects with all fields
{
  "jsonrpc": "2.0",
  "method": "tools/getLatestProspects",
  "params": {
    "fields": ["firstName", "lastName", "companyName", "createdDate"],
    "limit": 10
  }
}

// Get 25 prospects with only names
{
  "jsonrpc": "2.0",
  "method": "tools/getLatestProspects",
  "params": {
    "fields": ["firstName", "lastName"],
    "limit": 25
  }
}
```

---

## 🔐 Environment Variables

### Database Configuration

Only required if using `getLatestProspects`. The `createTestData` tool works without any configuration.

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | - | Database hostname |
| `DB_PORT` | 3306 | Database port |
| `DB_NAME` | opentaps | Database name |
| `DB_USER` | - | Database username |
| `DB_PASSWORD` | - | Database password |

### Example .env File

```env
DB_HOST=20.235.243.83
DB_PORT=3306
DB_NAME=opentaps
DB_USER=sandbox
DB_PASSWORD=Leaf9823DT23132
```

## 📁 Project Structure

```
test-data-mcp-server/
├── src/
│   ├── index.ts                 # MCP server entry point
│   ├── db.ts                    # Database connection pool
│   └── tools/
│       ├── createTestData.ts    # Synthetic data generation tool
│       └── getLatestProspects.ts # Database query tool
├── dist/                         # Compiled JavaScript (after build)
├── package.json                  # Dependencies and scripts
├── tsconfig.json                 # TypeScript configuration
├── mcp.json                      # MCP server configuration
├── .env.example                  # Environment variables template
└── README.md                      # This file
```

## 🛠️ Development

### Building

```bash
npm run build
```

Compiles TypeScript in `src/` to JavaScript in `dist/`.

### Development Mode

```bash
npm run dev
```

Runs the server with ts-node for instant TypeScript execution (useful during development).

### Running Compiled Version

```bash
npm start
```

Runs the pre-built JavaScript from `dist/`.

## 📦 Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@faker-js/faker` | ^10.1.0 | Synthetic data generation |
| `mysql2` | ^3.6.5 | MySQL database driver |
| `dotenv` | ^16.3.1 | Environment variable loader |
| `typescript` | ^5.3.2 | TypeScript compiler |
| `ts-node` | ^10.9.2 | TypeScript execution for Node.js |

## 🔄 How It Works

### createTestData Flow

1. User calls `createTestData` with count and company style
2. Faker generates random first names, last names
3. Company names generated based on selected style:
   - **random**: Use Faker's company generator
   - **indian-it**: Select from predefined Indian IT companies
   - **us-tech**: Select from predefined US tech companies
4. Data returned immediately (no DB call needed)

### getLatestProspects Flow

1. User calls `getLatestProspects` with required fields and limit
2. Server lazily initializes database connection on first call
3. SQL query executes joining PARTY, PARTY_ROLE, PERSON, and PARTY_SUPPLEMENTAL_DATA tables
4. Results filtered to prospects only (ROLE_TYPE_ID = 'PROSPECT')
5. Results sorted by creation date (newest first)
6. Response limited to requested limit
7. Only requested fields included in response

## 🎓 Use Cases

- **QA Testing** - Generate bulk test data for load testing
- **API Testing** - Create diverse prospect datasets for integration tests
- **Data Migration** - Fetch real data from production for testing purposes
- **Demo Data** - Generate realistic mock data for demos and presentations
- **Database Seeding** - Populate development databases with test data

## 📝 License

MIT

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

For issues, questions, or feature requests, please open an issue in the repository.

---

**Last Updated**: March 2024
**Version**: 1.0.0