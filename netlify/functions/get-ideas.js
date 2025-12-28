const { TableClient } = require('@azure/data-tables');

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
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Only admin can view ideas
    const password = event.headers['x-upload-password'] || event.headers['X-Upload-Password'];
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (password !== adminPassword) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Admin access required' })
      };
    }

    // Get table client
    const tableClient = getTableClient();

    // Fetch all ideas
    const ideas = [];
    try {
      const entities = tableClient.listEntities({
        queryOptions: { filter: "PartitionKey eq 'ideas'" }
      });

      for await (const entity of entities) {
        ideas.push({
          id: entity.rowKey,
          email: entity.email,
          name: entity.name,
          problem: entity.problem,
          solution: entity.solution,
          billion: entity.billion,
          timestamp: entity.timestamp
        });
      }
    } catch (err) {
      // Table might not exist yet
      if (err.statusCode === 404) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ ideas: [] })
        };
      }
      throw err;
    }

    // Sort by timestamp descending (newest first)
    ideas.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ideas })
    };

  } catch (error) {
    console.error('Get ideas error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to fetch ideas',
        message: error.message
      })
    };
  }
};
