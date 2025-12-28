const { TableClient } = require('@azure/data-tables');
const { v4: uuidv4 } = require('uuid');

const TABLE_NAME = 'ideas';

function getTableClient() {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error('Azure Storage connection string not configured');
  }
  return TableClient.fromConnectionString(connectionString, TABLE_NAME);
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Upload-Password',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Verify password
    const password = event.headers['x-upload-password'] || event.headers['X-Upload-Password'];
    const adminPassword = process.env.ADMIN_PASSWORD;
    const publicPassword = process.env.PUBLIC_PASSWORD;

    if (password !== adminPassword && password !== publicPassword) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Unauthorized' })
      };
    }

    // Parse request body
    const body = JSON.parse(event.body);
    const { email, name, problem, solution, billion } = body;

    // Validate required fields
    if (!email || !problem || !solution || !billion) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    // Create table client
    const tableClient = getTableClient();

    // Ensure table exists
    try {
      await tableClient.createTable();
    } catch (err) {
      // Table already exists - ignore
      if (err.statusCode !== 409) {
        console.error('Table creation error:', err);
      }
    }

    // Create entity
    const timestamp = new Date().toISOString();
    const rowKey = uuidv4();

    const entity = {
      partitionKey: 'ideas',
      rowKey: rowKey,
      email: email,
      name: name || 'Anonymous',
      problem: problem,
      solution: solution,
      billion: billion,
      timestamp: timestamp
    };

    // Insert entity
    await tableClient.createEntity(entity);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Idea submitted successfully',
        id: rowKey
      })
    };

  } catch (error) {
    console.error('Submit idea error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to submit idea',
        message: error.message
      })
    };
  }
};
