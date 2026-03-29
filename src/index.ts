/**
 * MCP Server Entry Point
 * 
 * This is the main entry point for the testdata-mcp-server.
 * It implements a JSON-RPC 2.0 server over stdio for the Model Context Protocol (MCP).
 * 
 * The server exposes tools for QA test data generation and retrieval.
 * 
 * Currently supported tools:
 * - getLatestProspects: Fetch the latest prospect leads from Opentaps MySQL database
 * - createTestData: Generate synthetic test data using Faker (no DB required)
 * 
 * Note: The createTestData tool works without any database configuration.
 *       Only getLatestProspects requires DB environment variables.
 */

import * as readline from 'readline';
import * as dotenv from 'dotenv';
import { getLatestProspects, getLatestProspectsSchema } from './tools/getLatestProspects';
import { createTestData, createTestDataSchema } from './tools/createTestData';

// Lazy import for DB - only loaded when getLatestProspects is used
let closePoolFn: (() => Promise<void>) | null = null;

/**
 * Safely close the database pool if it was initialized.
 */
async function safeClosePool(): Promise<void> {
  if (closePoolFn) {
    await closePoolFn();
  }
}

/**
 * Wrapper for getLatestProspects that lazily loads the DB module.
 * This allows the server to start without DB config when only using createTestData.
 */
async function getLatestProspectsWrapper(params: unknown): Promise<unknown> {
  // Lazy load the DB module only when this tool is called
  if (!closePoolFn) {
    const db = await import('./db');
    closePoolFn = db.closePool;
  }
  return getLatestProspects(params);
}

// Load environment variables from .env file
dotenv.config();

// =============================================================================
// Type Definitions for JSON-RPC 2.0
// =============================================================================

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number | null;
  method: string;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: JsonRpcError;
}

interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

// =============================================================================
// MCP Protocol Types
// =============================================================================

interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

interface McpServerInfo {
  name: string;
  version: string;
  capabilities: {
    tools: Record<string, never>;
  };
}

// =============================================================================
// JSON-RPC Error Codes
// =============================================================================

const JSON_RPC_ERRORS = {
  PARSE_ERROR: { code: -32700, message: 'Parse error' },
  INVALID_REQUEST: { code: -32600, message: 'Invalid Request' },
  METHOD_NOT_FOUND: { code: -32601, message: 'Method not found' },
  INVALID_PARAMS: { code: -32602, message: 'Invalid params' },
  INTERNAL_ERROR: { code: -32603, message: 'Internal error' },
};

// =============================================================================
// Server Configuration
// =============================================================================

const SERVER_INFO: McpServerInfo = {
  name: 'testdata-mcp-server',
  version: '1.0.0',
  capabilities: {
    tools: {},
  },
};

/** 
 * Registry of available tools.
 * Each tool has a name, description, input schema, and handler function.
 */
const TOOLS: Record<string, {
  definition: McpToolDefinition;
  handler: (params: unknown) => Promise<unknown>;
}> = {
  getLatestProspects: {
    definition: {
      name: 'getLatestProspects',
      description: 
        'Fetch the latest prospect leads from the Opentaps CRM database. ' +
        'Returns an array of prospect records with the requested fields. ' +
        'Each record always includes partyId, plus any requested fields ' +
        '(firstName, lastName, companyName, createdDate) if available. ' +
        'Requires DB environment variables to be configured.',
      inputSchema: getLatestProspectsSchema,
    },
    handler: getLatestProspectsWrapper, // Uses lazy DB loading
  },
  createTestData: {
    definition: {
      name: 'createTestData',
      description:
        'Generate synthetic test data using Faker. ' +
        'Returns an array of fake prospect records with firstName, lastName, and companyName. ' +
        'Does NOT insert anything into the database — data is generated in memory only.',
      inputSchema: createTestDataSchema,
    },
    handler: createTestData,
  },
};

// =============================================================================
// Response Helpers
// =============================================================================

/**
 * Create a successful JSON-RPC response.
 */
function createResponse(id: string | number | null, result: unknown): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    id,
    result,
  };
}

/**
 * Create an error JSON-RPC response.
 */
function createErrorResponse(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown
): JsonRpcResponse {
  const response: JsonRpcResponse = {
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
    },
  };
  
  if (data !== undefined) {
    response.error!.data = data;
  }
  
  return response;
}

// =============================================================================
// MCP Method Handlers
// =============================================================================

/**
 * Handle the 'initialize' method.
 * Returns server information and capabilities.
 */
function handleInitialize(): unknown {
  console.error('[MCP] Client initialized');
  return {
    protocolVersion: '2024-11-05',
    serverInfo: {
      name: SERVER_INFO.name,
      version: SERVER_INFO.version,
    },
    capabilities: {
      tools: {},
    },
  };
}

/**
 * Handle the 'tools/list' method.
 * Returns the list of available tools.
 */
function handleToolsList(): unknown {
  const tools = Object.values(TOOLS).map(tool => tool.definition);
  console.error(`[MCP] Listing ${tools.length} tools`);
  return { tools };
}

/**
 * Handle the 'tools/call' method.
 * Executes a tool and returns the result.
 */
async function handleToolsCall(params: unknown): Promise<unknown> {
  // Validate params structure
  if (!params || typeof params !== 'object') {
    throw { ...JSON_RPC_ERRORS.INVALID_PARAMS, data: 'Params must be an object' };
  }

  const { name, arguments: args } = params as { name?: string; arguments?: unknown };

  // Validate tool name
  if (!name || typeof name !== 'string') {
    throw { ...JSON_RPC_ERRORS.INVALID_PARAMS, data: 'Tool name is required' };
  }

  // Find the tool
  const tool = TOOLS[name];
  if (!tool) {
    throw { 
      ...JSON_RPC_ERRORS.METHOD_NOT_FOUND, 
      message: `Tool not found: ${name}`,
      data: { availableTools: Object.keys(TOOLS) }
    };
  }

  console.error(`[MCP] Calling tool: ${name}`);

  try {
    // Execute the tool handler
    const result = await tool.handler(args);
    
    // Return MCP-formatted tool result
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    // Format tool execution errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error(`[MCP] Tool error: ${errorMessage}`);
    
    // Return error as tool result (not JSON-RPC error)
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: errorMessage,
            stack: process.env.NODE_ENV === 'development' ? errorStack : undefined,
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
}

// =============================================================================
// Request Router
// =============================================================================

/**
 * Route a JSON-RPC request to the appropriate handler.
 */
async function handleRequest(request: JsonRpcRequest): Promise<JsonRpcResponse | null> {
  const { id, method, params } = request;

  console.error(`[MCP] Received method: ${method}`);

  try {
    let result: unknown;

    switch (method) {
      case 'initialize':
        result = handleInitialize();
        break;

      case 'initialized':
        // Notification, no response needed
        console.error('[MCP] Client confirmed initialization');
        return null;

      case 'tools/list':
        result = handleToolsList();
        break;

      case 'tools/call':
        result = await handleToolsCall(params);
        break;

      case 'ping':
        result = { pong: true };
        break;

      default:
        // Unknown method
        return createErrorResponse(
          id,
          JSON_RPC_ERRORS.METHOD_NOT_FOUND.code,
          `Unknown method: ${method}`
        );
    }

    return createResponse(id, result);

  } catch (error) {
    // Handle structured errors (from handlers)
    if (error && typeof error === 'object' && 'code' in error) {
      const rpcError = error as JsonRpcError & { data?: unknown };
      return createErrorResponse(id, rpcError.code, rpcError.message, rpcError.data);
    }

    // Handle unexpected errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error(`[MCP] Internal error: ${errorMessage}`);

    return createErrorResponse(
      id,
      JSON_RPC_ERRORS.INTERNAL_ERROR.code,
      errorMessage,
      process.env.NODE_ENV === 'development' ? { stack: errorStack } : undefined
    );
  }
}

// =============================================================================
// Main Server Loop
// =============================================================================

/**
 * Parse and process a line of input as a JSON-RPC request.
 */
async function processLine(line: string): Promise<void> {
  // Skip empty lines
  if (!line.trim()) {
    return;
  }

  let request: JsonRpcRequest;

  // Parse JSON
  try {
    request = JSON.parse(line);
  } catch {
    const response = createErrorResponse(
      null,
      JSON_RPC_ERRORS.PARSE_ERROR.code,
      JSON_RPC_ERRORS.PARSE_ERROR.message
    );
    console.log(JSON.stringify(response));
    return;
  }

  // Validate JSON-RPC structure
  if (request.jsonrpc !== '2.0' || !request.method) {
    const response = createErrorResponse(
      request.id ?? null,
      JSON_RPC_ERRORS.INVALID_REQUEST.code,
      JSON_RPC_ERRORS.INVALID_REQUEST.message
    );
    console.log(JSON.stringify(response));
    return;
  }

  // Handle the request
  const response = await handleRequest(request);

  // Send response (if not a notification)
  if (response !== null) {
    console.log(JSON.stringify(response));
  }
}

/**
 * Start the MCP server.
 * Reads JSON-RPC requests from stdin and writes responses to stdout.
 */
async function startServer(): Promise<void> {
  // Display startup banner
  console.error('='.repeat(60));
  console.error('[MCP] Test Data Server v1.0.0 starting...');
  console.error('[MCP] Listening for JSON-RPC requests on stdio');
  console.error('='.repeat(60));
  
  // List available tools
  const toolNames = Object.keys(TOOLS);
  console.error(`[MCP] Available tools (${toolNames.length}):`);
  toolNames.forEach((name, index) => {
    console.error(`  ${index + 1}. ${name}`);
  });
  console.error('='.repeat(60));
  
  // Note about DB requirements
  console.error('[MCP] Note: createTestData works without DB configuration.');
  console.error('[MCP] Note: getLatestProspects requires DB_HOST, DB_USER, DB_PASSWORD, DB_NAME.');
  console.error('='.repeat(60));

  // Create readline interface for stdin
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  // Process each line as a JSON-RPC request
  rl.on('line', async (line) => {
    try {
      await processLine(line);
    } catch (error) {
      console.error('[MCP] Unexpected error processing line:', error);
    }
  });

  // Handle graceful shutdown
  rl.on('close', async () => {
    console.error('[MCP] stdin closed, shutting down...');
    await safeClosePool();
    process.exit(0);
  });

  // Handle process signals
  process.on('SIGINT', async () => {
    console.error('[MCP] Received SIGINT, shutting down...');
    await safeClosePool();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.error('[MCP] Received SIGTERM, shutting down...');
    await safeClosePool();
    process.exit(0);
  });
}

// =============================================================================
// Entry Point
// =============================================================================

startServer().catch((error) => {
  console.error('[MCP] Fatal error starting server:', error);
  process.exit(1);
});

// =============================================================================
// USAGE INSTRUCTIONS
// =============================================================================
/**
 * HOW TO START THE MCP SERVER
 * ===========================
 * 
 * Development mode (with ts-node):
 *   npm run dev
 * 
 * Production mode (after build):
 *   npm run build
 *   npm start
 * 
 * 
 * HOW TO ADD THIS MCP SERVER TO GITHUB COPILOT
 * =============================================
 * 
 * Add the following to your VS Code settings.json or MCP configuration:
 * 
 * {
 *   "mcpServers": {
 *     "testdata": {
 *       "command": "node",
 *       "args": ["/path/to/test-data-mcp-server/dist/index.js"],
 *       "env": {
 *         "DB_HOST": "localhost",
 *         "DB_PORT": "3306",
 *         "DB_USER": "your_user",
 *         "DB_PASSWORD": "your_password",
 *         "DB_NAME": "opentaps"
 *       }
 *     }
 *   }
 * }
 * 
 * Note: DB environment variables are ONLY required for getLatestProspects.
 *       The createTestData tool works without any database configuration!
 * 
 * 
 * EXAMPLE JSON-RPC REQUESTS
 * =========================
 * 
 * 1. Generate fake test data (no DB required):
 * {
 *   "jsonrpc": "2.0",
 *   "id": 1,
 *   "method": "tools/call",
 *   "params": {
 *     "name": "createTestData",
 *     "arguments": {
 *       "count": 5,
 *       "companyStyle": "indian-it"
 *     }
 *   }
 * }
 * 
 * 2. Fetch real prospects from DB:
 * {
 *   "jsonrpc": "2.0",
 *   "id": 2,
 *   "method": "tools/call",
 *   "params": {
 *     "name": "getLatestProspects",
 *     "arguments": {
 *       "fields": ["firstName", "lastName", "companyName"],
 *       "limit": 10
 *     }
 *   }
 * }
 */
