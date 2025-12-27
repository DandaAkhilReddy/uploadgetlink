const { BlobServiceClient } = require('@azure/storage-blob');

let blobServiceClient = null;
let containerClient = null;

function getContainerClient() {
  if (!containerClient) {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const containerName = process.env.AZURE_CONTAINER_NAME || 'uploads';

    if (!connectionString) {
      throw new Error('Azure Storage connection string not configured');
    }

    blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    containerClient = blobServiceClient.getContainerClient(containerName);
  }
  return containerClient;
}

function getBlobUrl(blobName) {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const accountName = connectionString.match(/AccountName=([^;]+)/)?.[1];
  const containerName = process.env.AZURE_CONTAINER_NAME || 'uploads';

  return `https://${accountName}.blob.core.windows.net/${containerName}/${blobName}`;
}

module.exports = { getContainerClient, getBlobUrl };
