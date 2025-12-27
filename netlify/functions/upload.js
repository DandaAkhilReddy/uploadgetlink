const busboy = require('busboy');
const { v4: uuidv4 } = require('uuid');
const { getContainerClient, getBlobUrl } = require('./utils/azure-client');

// Allowed file extensions
const ALLOWED_EXTENSIONS = [
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.txt', '.rtf', '.csv', '.zip', '.rar', '.7z',
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
  '.mp3', '.mp4', '.mov', '.avi', '.mkv', '.json', '.xml'
];

// MIME type to extension mapping
const MIME_TO_EXT = {
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'text/plain': '.txt',
  'text/csv': '.csv',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'application/zip': '.zip',
  'application/json': '.json',
  'application/xml': '.xml',
  'text/xml': '.xml'
};

function parseMultipartForm(event) {
  return new Promise((resolve, reject) => {
    const bb = busboy({
      headers: { 'content-type': event.headers['content-type'] || event.headers['Content-Type'] }
    });

    const result = {
      files: [],
      fields: {}
    };

    bb.on('file', (name, file, info) => {
      const { filename, mimeType } = info;
      const chunks = [];

      file.on('data', (data) => {
        chunks.push(data);
      });

      file.on('end', () => {
        result.files.push({
          fieldname: name,
          filename,
          mimeType,
          buffer: Buffer.concat(chunks)
        });
      });
    });

    bb.on('field', (name, value) => {
      result.fields[name] = value;
    });

    bb.on('finish', () => resolve(result));
    bb.on('error', reject);

    // Netlify base64 encodes binary payloads
    const body = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64')
      : Buffer.from(event.body);

    bb.end(body);
  });
}

function getFileExtension(filename, mimeType) {
  // Try to get extension from filename first
  const lastDot = filename.lastIndexOf('.');
  if (lastDot !== -1) {
    const extFromName = filename.substring(lastDot).toLowerCase();
    if (ALLOWED_EXTENSIONS.includes(extFromName)) {
      return extFromName;
    }
  }

  // Fall back to MIME type
  return MIME_TO_EXT[mimeType] || '';
}

function sanitizeFilename(filename) {
  // Remove path components and sanitize
  const baseName = filename.split(/[\\/]/).pop();
  // Remove special characters but keep extension
  return baseName.replace(/[^a-zA-Z0-9.-]/g, '_');
}

exports.handler = async (event) => {
  // CORS headers
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
    // Verify password from header and determine access level
    const password = event.headers['x-upload-password'] || event.headers['X-Upload-Password'];
    const adminPassword = process.env.ADMIN_PASSWORD;
    const publicPassword = process.env.PUBLIC_PASSWORD;

    let accessLevel = null;
    if (password === adminPassword) {
      accessLevel = 'admin';
    } else if (password === publicPassword) {
      accessLevel = 'public';
    } else {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Unauthorized' })
      };
    }

    // Parse multipart form data
    const { files } = await parseMultipartForm(event);

    if (!files || files.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No file provided' })
      };
    }

    const file = files[0];

    // Different size limits based on access level
    // Note: Netlify Functions have ~4.5MB payload limit regardless
    const adminMaxMB = parseInt(process.env.ADMIN_MAX_FILE_SIZE_MB || '100', 10);
    const publicMaxMB = parseInt(process.env.PUBLIC_MAX_FILE_SIZE_MB || '10', 10);
    const maxSizeMB = accessLevel === 'admin' ? adminMaxMB : publicMaxMB;
    const maxSizeBytes = maxSizeMB * 1024 * 1024;

    // Check file size
    if (file.buffer.length > maxSizeBytes) {
      return {
        statusCode: 413,
        headers,
        body: JSON.stringify({
          error: `File too large. Maximum size is ${maxSizeMB}MB`
        })
      };
    }

    // Validate file type
    const extension = getFileExtension(file.filename, file.mimeType);
    if (!extension || !ALLOWED_EXTENSIONS.includes(extension)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'File type not allowed',
          allowedTypes: ALLOWED_EXTENSIONS.join(', ')
        })
      };
    }

    // Generate unique blob name
    const sanitizedName = sanitizeFilename(file.filename);
    const uniqueId = uuidv4().substring(0, 8);
    const blobName = `${uniqueId}-${sanitizedName}`;

    // Upload to Azure Blob Storage
    const containerClient = getContainerClient();
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.uploadData(file.buffer, {
      blobHTTPHeaders: {
        blobContentType: file.mimeType
      }
    });

    // Generate public URL
    const publicUrl = getBlobUrl(blobName);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        url: publicUrl,
        filename: blobName,
        originalName: file.filename,
        size: file.buffer.length,
        mimeType: file.mimeType
      })
    };

  } catch (error) {
    console.error('Upload error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Upload failed',
        message: error.message
      })
    };
  }
};
