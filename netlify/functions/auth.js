exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { password } = JSON.parse(event.body);
    const adminPassword = process.env.ADMIN_PASSWORD;
    const publicPassword = process.env.PUBLIC_PASSWORD;

    if (!adminPassword || !publicPassword) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Server configuration error' })
      };
    }

    // Check admin password first
    if (password === adminPassword) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          accessLevel: 'admin',
          message: 'Admin access granted'
        })
      };
    }

    // Check public password
    if (password === publicPassword) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          accessLevel: 'public',
          message: 'Public access granted'
        })
      };
    }

    // Invalid password
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Invalid password'
      })
    };
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid request body' })
    };
  }
};
