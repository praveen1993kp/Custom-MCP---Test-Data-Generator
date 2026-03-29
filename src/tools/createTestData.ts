/**
 * createTestData Tool
 * 
 * This tool generates synthetic test data using Faker.
 * It does NOT connect to any database — all data is generated in memory.
 * 
 * Use this tool when you need fake prospect data for testing purposes.
 */

import { faker } from '@faker-js/faker';

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Company style options for generating company names.
 * - "random": Use Faker's random company name generator
 * - "indian-it": Pick from major Indian IT companies
 * - "us-tech": Pick from major US tech companies
 */
export type CompanyStyle = 'random' | 'indian-it' | 'us-tech';

/**
 * Input parameters for the createTestData tool.
 */
export interface CreateTestDataInput {
  /** Number of records to generate (1-100) */
  count: number;
  /** Style of company names to generate (optional, defaults to "random") */
  companyStyle?: CompanyStyle;
}

/**
 * A single generated test data record.
 */
export interface TestDataRecord {
  firstName: string;
  lastName: string;
  companyName: string;
}

// =============================================================================
// Constants
// =============================================================================

/** Minimum number of records that can be generated */
const MIN_COUNT = 1;

/** Maximum number of records that can be generated */
const MAX_COUNT = 100;

/** Default company style if not specified */
const DEFAULT_COMPANY_STYLE: CompanyStyle = 'random';

/** Valid company style options */
const VALID_COMPANY_STYLES: readonly CompanyStyle[] = ['random', 'indian-it', 'us-tech'];

/** List of major Indian IT companies */
const INDIAN_IT_COMPANIES: readonly string[] = [
  'TCS',
  'Infosys',
  'Wipro',
  'Cognizant',
  'HCL',
];

/** List of major US tech companies */
const US_TECH_COMPANIES: readonly string[] = [
  'Google',
  'Amazon',
  'Meta',
  'Netflix',
  'Microsoft',
];

// =============================================================================
// Input Validation
// =============================================================================

/**
 * Validates the input parameters for createTestData.
 * 
 * @param input - The raw input to validate
 * @throws Error if validation fails
 * @returns Validated input with defaults applied
 */
export function validateInput(input: unknown): CreateTestDataInput {
  // Check if input is an object
  if (!input || typeof input !== 'object') {
    throw new Error(
      'Input must be an object with "count" (number) and optional "companyStyle" (string).'
    );
  }

  const inputObj = input as Record<string, unknown>;

  // Validate count (required)
  if (inputObj.count === undefined) {
    throw new Error('"count" is required.');
  }

  if (typeof inputObj.count !== 'number' || !Number.isInteger(inputObj.count)) {
    throw new Error('"count" must be an integer.');
  }

  if (inputObj.count < MIN_COUNT) {
    throw new Error(`"count" must be at least ${MIN_COUNT}.`);
  }

  if (inputObj.count > MAX_COUNT) {
    throw new Error(`"count" must not exceed ${MAX_COUNT}.`);
  }

  const count = inputObj.count;

  // Validate companyStyle (optional)
  let companyStyle: CompanyStyle = DEFAULT_COMPANY_STYLE;

  if (inputObj.companyStyle !== undefined) {
    if (typeof inputObj.companyStyle !== 'string') {
      throw new Error('"companyStyle" must be a string.');
    }

    if (!VALID_COMPANY_STYLES.includes(inputObj.companyStyle as CompanyStyle)) {
      throw new Error(
        `Invalid companyStyle: "${inputObj.companyStyle}". ` +
        `Allowed values: ${VALID_COMPANY_STYLES.join(', ')}`
      );
    }

    companyStyle = inputObj.companyStyle as CompanyStyle;
  }

  return { count, companyStyle };
}

// =============================================================================
// Data Generation Helpers
// =============================================================================

/**
 * Pick a random item from an array.
 * 
 * @param items - Array to pick from
 * @returns A random item from the array
 */
function pickRandom<T>(items: readonly T[]): T {
  const index = Math.floor(Math.random() * items.length);
  return items[index];
}

/**
 * Generate a company name based on the specified style.
 * 
 * @param style - The company style to use
 * @returns A company name string
 */
function generateCompanyName(style: CompanyStyle): string {
  switch (style) {
    case 'indian-it':
      // Pick from predefined Indian IT companies
      return pickRandom(INDIAN_IT_COMPANIES);

    case 'us-tech':
      // Pick from predefined US tech companies
      return pickRandom(US_TECH_COMPANIES);

    case 'random':
    default:
      // Use Faker to generate a random company name
      return faker.company.name();
  }
}

/**
 * Generate a single test data record.
 * 
 * @param companyStyle - The company style to use for this record
 * @returns A generated test data record
 */
function generateRecord(companyStyle: CompanyStyle): TestDataRecord {
  return {
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    companyName: generateCompanyName(companyStyle),
  };
}

// =============================================================================
// Main Tool Implementation
// =============================================================================

/**
 * Generates synthetic test data using Faker.
 * 
 * This tool creates fake prospect data for testing purposes.
 * It does NOT connect to any database — all data is generated in memory.
 * 
 * @param input - Tool input with count and optional companyStyle
 * @returns Array of generated test data records
 * @throws Error on validation failure
 * 
 * @example
 * const data = await createTestData({
 *   count: 5,
 *   companyStyle: 'indian-it'
 * });
 * // Returns: [
 * //   { firstName: "John", lastName: "Doe", companyName: "TCS" },
 * //   { firstName: "Jane", lastName: "Smith", companyName: "Infosys" },
 * //   ...
 * // ]
 */
export async function createTestData(input: unknown): Promise<TestDataRecord[]> {
  // Step 1: Validate input
  const { count, companyStyle } = validateInput(input);

  console.error(
    `[createTestData] Generating ${count} records with companyStyle: ${companyStyle}`
  );

  // Step 2: Generate records
  const records: TestDataRecord[] = [];

  for (let i = 0; i < count; i++) {
    records.push(generateRecord(companyStyle!));
  }

  console.error(`[createTestData] Generated ${records.length} records`);

  // Step 3: Return the generated data
  return records;
}

// =============================================================================
// Tool Metadata (for MCP registration)
// =============================================================================

/**
 * JSON Schema for the createTestData tool input.
 * This is used by the MCP server to validate incoming requests.
 */
export const createTestDataSchema = {
  type: 'object',
  properties: {
    count: {
      type: 'number',
      minimum: 1,
      maximum: 100,
      description: 'Number of test data records to generate (1-100)',
    },
    companyStyle: {
      type: 'string',
      enum: ['random', 'indian-it', 'us-tech'],
      default: 'random',
      description:
        'Style of company names: "random" (Faker), "indian-it" (TCS, Infosys, etc.), "us-tech" (Google, Amazon, etc.)',
    },
  },
  required: ['count'],
  additionalProperties: false,
};
