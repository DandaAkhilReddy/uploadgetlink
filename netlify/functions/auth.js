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
    const { email, password } = JSON.parse(event.body);

    // Get credentials from environment
    const adminEmail = process.env.ADMIN_EMAIL || 'akhilreddydanda3@gmail.com';
    const adminPassword = process.env.ADMIN_PASSWORD;
    const publicPassword = process.env.PUBLIC_PASSWORD;

    if (!adminPassword || !publicPassword) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Server configuration error' })
      };
    }

    // Validate email is provided
    if (!email || !email.trim()) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Email is required' })
      };
    }

    // Check admin - must match both email AND password
    if (email.toLowerCase().trim() === adminEmail.toLowerCase() && password === adminPassword) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          accessLevel: 'admin',
          email: email.trim(),
          message: 'Admin access granted'
        })
      };
    }

    // Check public password - any email + correct public password
    if (password === publicPassword) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          accessLevel: 'public',
          email: email.trim(),
          message: 'Public access granted'
        })
      };
    }

    // Invalid credentials
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Invalid email or password'
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
