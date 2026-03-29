/**
 * getLatestProspects Tool
 * 
 * This tool fetches the latest prospect leads from the Opentaps database.
 * It queries the PARTY, PARTY_ROLE, PERSON, and PARTY_SUPPLEMENTAL_DATA tables
 * to retrieve prospect information.
 * 
 * A "Prospect" is defined as a party with ROLE_TYPE_ID = 'PROSPECT'.
 */

import { query } from '../db';

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Allowed field names that can be requested in the output.
 */
export type ProspectField = 'firstName' | 'lastName' | 'companyName' | 'createdDate';

/**
 * Input parameters for the getLatestProspects tool.
 */
export interface GetLatestProspectsInput {
  /** Fields to include in the response (besides partyId which is always included) */
  fields: ProspectField[];
  /** Maximum number of prospects to return (default: 10, max: 50) */
  limit?: number;
}

/**
 * A single prospect record from the database.
 * All fields except partyId are optional depending on data availability and requested fields.
 */
export interface ProspectRecord {
  partyId: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  createdDate?: string; // ISO 8601 format
}

/**
 * Raw database row structure from the SQL query.
 */
interface DbProspectRow {
  PARTY_ID: string | number;
  FIRST_NAME: string | null;
  LAST_NAME: string | null;
  COMPANY_NAME: string | null;
  CREATED_DATE: Date | string | null;
}

// =============================================================================
// Constants
// =============================================================================

/** Default number of records to return if limit is not specified */
const DEFAULT_LIMIT = 10;

/** Maximum allowed limit to prevent excessive data retrieval */
const MAX_LIMIT = 50;

/** Valid field names that can be requested */
const VALID_FIELDS: readonly ProspectField[] = ['firstName', 'lastName', 'companyName', 'createdDate'];

// =============================================================================
// SQL Query
// =============================================================================

/**
 * SQL query to fetch prospect leads from Opentaps.
 * 
 * Tables used:
 * - PARTY: Core party information (PARTY_ID, CREATED_DATE)
 * - PARTY_ROLE: Links party to roles (filtered by ROLE_TYPE_ID = 'PROSPECT')
 * - PERSON: Personal information (FIRST_NAME, LAST_NAME)
 * - PARTY_SUPPLEMENTAL_DATA: Additional data (COMPANY_NAME)
 * 
 * Results are ordered by PARTY_ID descending (newest first).
 */
const PROSPECTS_SQL = `
  SELECT 
      p.PARTY_ID,
      per.FIRST_NAME,
      per.LAST_NAME,
      psd.COMPANY_NAME,
      p.CREATED_DATE
  FROM 
      PARTY p
  JOIN 
      PARTY_ROLE pr ON pr.PARTY_ID = p.PARTY_ID
  LEFT JOIN 
      PERSON per ON per.PARTY_ID = p.PARTY_ID
  LEFT JOIN 
      PARTY_SUPPLEMENTAL_DATA psd ON psd.PARTY_ID = p.PARTY_ID
  WHERE 
      pr.ROLE_TYPE_ID = 'PROSPECT'
  ORDER BY 
      CAST(p.PARTY_ID AS UNSIGNED) DESC
  LIMIT ?;
`;

// =============================================================================
// Input Validation
// =============================================================================

/**
 * Validates the input parameters for getLatestProspects.
 * 
 * @param input - The raw input to validate
 * @throws Error if validation fails
 * @returns Validated input with defaults applied
 */
export function validateInput(input: unknown): GetLatestProspectsInput {
  // Check if input is an object
  if (!input || typeof input !== 'object') {
    throw new Error('Input must be an object with "fields" array and optional "limit" number.');
  }

  const inputObj = input as Record<string, unknown>;

  // Validate fields array
  if (!Array.isArray(inputObj.fields)) {
    throw new Error('"fields" must be an array of strings.');
  }

  // Validate each field name
  const fields: ProspectField[] = [];
  for (const field of inputObj.fields) {
    if (typeof field !== 'string') {
      throw new Error(`Invalid field: ${field}. Fields must be strings.`);
    }
    if (!VALID_FIELDS.includes(field as ProspectField)) {
      throw new Error(
        `Invalid field: "${field}". Allowed values: ${VALID_FIELDS.join(', ')}`
      );
    }
    fields.push(field as ProspectField);
  }

  // Validate and clamp limit
  let limit = DEFAULT_LIMIT;
  if (inputObj.limit !== undefined) {
    if (typeof inputObj.limit !== 'number' || !Number.isInteger(inputObj.limit)) {
      throw new Error('"limit" must be an integer.');
    }
    if (inputObj.limit < 1) {
      throw new Error('"limit" must be at least 1.');
    }
    limit = Math.min(inputObj.limit, MAX_LIMIT);
  }

  return { fields, limit };
}

// =============================================================================
// Data Transformation
// =============================================================================

/**
 * Converts a database row to a ProspectRecord, including only requested fields.
 * 
 * @param row - Raw database row
 * @param fields - Fields to include in the output
 * @returns Formatted prospect record
 */
function mapRowToProspect(row: DbProspectRow, fields: ProspectField[]): ProspectRecord {
  // partyId is always included
  const prospect: ProspectRecord = {
    partyId: String(row.PARTY_ID),
  };

  // Add requested fields if they have values
  for (const field of fields) {
    switch (field) {
      case 'firstName':
        if (row.FIRST_NAME) {
          prospect.firstName = row.FIRST_NAME;
        }
        break;
      case 'lastName':
        if (row.LAST_NAME) {
          prospect.lastName = row.LAST_NAME;
        }
        break;
      case 'companyName':
        if (row.COMPANY_NAME) {
          prospect.companyName = row.COMPANY_NAME;
        }
        break;
      case 'createdDate':
        if (row.CREATED_DATE) {
          // Convert to ISO 8601 string
          const date = row.CREATED_DATE instanceof Date 
            ? row.CREATED_DATE 
            : new Date(row.CREATED_DATE);
          prospect.createdDate = date.toISOString();
        }
        break;
    }
  }

  return prospect;
}

// =============================================================================
// Main Tool Implementation
// =============================================================================

/**
 * Fetches the latest prospect leads from the Opentaps database.
 * 
 * This is the main tool function that:
 * 1. Validates input parameters
 * 2. Executes the SQL query
 * 3. Transforms results to the requested format
 * 
 * @param input - Tool input with fields and optional limit
 * @returns Array of prospect records
 * @throws Error on validation failure or database error
 * 
 * @example
 * const prospects = await getLatestProspects({
 *   fields: ['firstName', 'lastName', 'companyName'],
 *   limit: 5
 * });
 * // Returns: [{ partyId: "123", firstName: "John", lastName: "Doe", companyName: "Acme" }, ...]
 */
export async function getLatestProspects(input: unknown): Promise<ProspectRecord[]> {
  // Step 1: Validate input
  const { fields, limit } = validateInput(input);

  console.error(`[getLatestProspects] Fetching up to ${limit} prospects with fields: ${fields.join(', ')}`);

  // Step 2: Execute query
  const rows = await query<DbProspectRow[]>(PROSPECTS_SQL, [limit]);

  console.error(`[getLatestProspects] Found ${rows.length} prospects`);

  // Step 3: Transform results
  const prospects = rows.map(row => mapRowToProspect(row, fields));

  return prospects;
}

// =============================================================================
// Tool Metadata (for MCP registration)
// =============================================================================

/**
 * JSON Schema for the getLatestProspects tool input.
 * This is used by the MCP server to validate incoming requests.
 */
export const getLatestProspectsSchema = {
  type: 'object',
  properties: {
    fields: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['firstName', 'lastName', 'companyName', 'createdDate'],
      },
      description: 'Fields to include in the response (partyId is always included)',
    },
    limit: {
      type: 'number',
      minimum: 1,
      maximum: 50,
      default: 10,
      description: 'Maximum number of prospects to return (default: 10, max: 50)',
    },
  },
  required: ['fields'],
  additionalProperties: false,
};
