// DOM Elements
const authScreen = document.getElementById('auth-screen');
const uploadScreen = document.getElementById('upload-screen');
const authForm = document.getElementById('auth-form');
const passwordInput = document.getElementById('password-input');
const authError = document.getElementById('auth-error');

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileInfo = document.getElementById('file-info');
const fileName = document.getElementById('file-name');
const fileSize = document.getElementById('file-size');
const removeFileBtn = document.getElementById('remove-file');

const progressContainer = document.getElementById('progress-container');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');

const uploadBtn = document.getElementById('upload-btn');

const resultSection = document.getElementById('result');
const resultLink = document.getElementById('result-link');
const copyBtn = document.getElementById('copy-btn');
const copyFeedback = document.getElementById('copy-feedback');
const uploadAnotherBtn = document.getElementById('upload-another');

const errorBox = document.getElementById('error');
const errorMessage = document.getElementById('error-message');
const errorDismiss = document.getElementById('error-dismiss');

// State
let selectedFile = null;
let authPassword = null;
let accessLevel = null; // 'admin' or 'public'

// Constants
const PUBLIC_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB for public
const ADMIN_MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB for admin (limited by Netlify to ~4.5MB anyway)
const PUBLIC_MAX_UPLOADS = 10;
const API_BASE = '/api';
const UPLOAD_COUNT_KEY = 'uploadgetlink_upload_count';

// Utility Functions
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function showElement(el) {
  el.classList.remove('hidden');
}

function hideElement(el) {
  el.classList.add('hidden');
}

function getUploadCount() {
  return parseInt(localStorage.getItem(UPLOAD_COUNT_KEY) || '0', 10);
}

function incrementUploadCount() {
  const count = getUploadCount() + 1;
  localStorage.setItem(UPLOAD_COUNT_KEY, count.toString());
  return count;
}

function getMaxFileSize() {
  return accessLevel === 'admin' ? ADMIN_MAX_FILE_SIZE : PUBLIC_MAX_FILE_SIZE;
}

function canUpload() {
  if (accessLevel === 'admin') return true;
  return getUploadCount() < PUBLIC_MAX_UPLOADS;
}

function updateUploadCounter() {
  let counterEl = document.getElementById('upload-counter');

  if (accessLevel === 'admin') {
    if (counterEl) counterEl.remove();
    return;
  }

  const count = getUploadCount();
  const remaining = PUBLIC_MAX_UPLOADS - count;

  if (!counterEl) {
    counterEl = document.createElement('div');
    counterEl.id = 'upload-counter';
    counterEl.className = 'upload-counter';
    dropZone.parentNode.insertBefore(counterEl, dropZone);
  }

  counterEl.textContent = `${remaining} uploads remaining (${count}/${PUBLIC_MAX_UPLOADS} used)`;
  counterEl.classList.remove('warning', 'limit-reached');

  if (remaining <= 0) {
    counterEl.classList.add('limit-reached');
    counterEl.textContent = 'Upload limit reached (10/10)';
  } else if (remaining <= 3) {
    counterEl.classList.add('warning');
  }
}

function updateAccessBadge() {
  let badgeEl = document.getElementById('access-badge');

  if (!badgeEl) {
    badgeEl = document.createElement('div');
    badgeEl.id = 'access-badge';
    badgeEl.className = 'access-badge';
    const header = document.querySelector('header');
    header.appendChild(badgeEl);
  }

  if (accessLevel === 'admin') {
    badgeEl.className = 'access-badge admin';
    badgeEl.textContent = 'Admin Access';
  } else {
    badgeEl.className = 'access-badge public';
    badgeEl.textContent = 'Public Access';
  }
}

function resetUploadUI() {
  selectedFile = null;
  fileInput.value = '';
  hideElement(fileInfo);
  hideElement(progressContainer);
  hideElement(resultSection);
  hideElement(errorBox);
  uploadBtn.disabled = true;
  progressFill.style.width = '0%';
  progressText.textContent = '0%';
  showElement(dropZone);
  updateUploadCounter();

  // Check if limit reached
  if (!canUpload()) {
    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Upload Limit Reached';
  } else {
    uploadBtn.textContent = 'Upload File';
  }
}

// Authentication
authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const password = passwordInput.value.trim();

  if (!password) {
    authError.textContent = 'Please enter a password';
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      authPassword = password;
      accessLevel = data.accessLevel || 'public';

      hideElement(authScreen);
      showElement(uploadScreen);
      authError.textContent = '';

      updateAccessBadge();
      updateUploadCounter();

      // Check if public user has reached limit
      if (!canUpload()) {
        uploadBtn.disabled = true;
        uploadBtn.textContent = 'Upload Limit Reached';
      }

      // Store access level in session
      sessionStorage.setItem('uploadAuth', accessLevel);
    } else {
      authError.textContent = data.error || 'Invalid password';
      passwordInput.value = '';
      passwordInput.focus();
    }
  } catch (error) {
    authError.textContent = 'Connection error. Please try again.';
    console.error('Auth error:', error);
  }
});

// Drag and Drop
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');

  if (!canUpload()) {
    showError('You have reached the upload limit (10 files)');
    return;
  }

  const files = e.dataTransfer.files;
  if (files.length > 0) {
    handleFileSelect(files[0]);
  }
});

// File Input
fileInput.addEventListener('change', (e) => {
  if (!canUpload()) {
    showError('You have reached the upload limit (10 files)');
    e.target.value = '';
    return;
  }

  if (e.target.files.length > 0) {
    handleFileSelect(e.target.files[0]);
  }
});

function handleFileSelect(file) {
  const maxSize = getMaxFileSize();

  // Validate file size
  if (file.size > maxSize) {
    showError(`File is too large. Maximum size is ${formatFileSize(maxSize)}`);
    return;
  }

  selectedFile = file;

  // Update UI
  fileName.textContent = file.name;
  fileSize.textContent = formatFileSize(file.size);
  showElement(fileInfo);
  uploadBtn.disabled = false;
  hideElement(errorBox);
  hideElement(resultSection);
}

// Remove File
removeFileBtn.addEventListener('click', () => {
  resetUploadUI();
});

// Upload
uploadBtn.addEventListener('click', async () => {
  if (!selectedFile || !authPassword) return;

  if (!canUpload()) {
    showError('You have reached the upload limit (10 files)');
    return;
  }

  // Prepare form data
  const formData = new FormData();
  formData.append('file', selectedFile);

  // Show progress
  hideElement(dropZone);
  hideElement(fileInfo);
  showElement(progressContainer);
  uploadBtn.disabled = true;

  try {
    // Create XMLHttpRequest for progress tracking
    const xhr = new XMLHttpRequest();

    const uploadPromise = new Promise((resolve, reject) => {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          progressFill.style.width = percent + '%';
          progressText.textContent = percent + '%';
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          try {
            reject(JSON.parse(xhr.responseText));
          } catch {
            reject({ error: 'Upload failed' });
          }
        }
      });

      xhr.addEventListener('error', () => {
        reject({ error: 'Network error' });
      });

      xhr.open('POST', `${API_BASE}/upload`);
      xhr.setRequestHeader('X-Upload-Password', authPassword);
      xhr.send(formData);
    });

    const result = await uploadPromise;

    // Increment upload count for public users
    if (accessLevel !== 'admin') {
      incrementUploadCount();
    }

    // Show result
    hideElement(progressContainer);
    resultLink.value = result.url;
    showElement(resultSection);

    // Update counter
    updateUploadCounter();

  } catch (error) {
    console.error('Upload error:', error);
    hideElement(progressContainer);
    showError(error.error || error.message || 'Upload failed. Please try again.');
    showElement(dropZone);
    uploadBtn.disabled = false;
  }
});

// Copy Link
copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(resultLink.value);
    showElement(copyFeedback);
    setTimeout(() => hideElement(copyFeedback), 2000);
  } catch (error) {
    // Fallback for older browsers
    resultLink.select();
    document.execCommand('copy');
    showElement(copyFeedback);
    setTimeout(() => hideElement(copyFeedback), 2000);
  }
});

// Upload Another
uploadAnotherBtn.addEventListener('click', () => {
  resetUploadUI();
});

// Error Handling
function showError(message) {
  errorMessage.textContent = message;
  showElement(errorBox);
}

errorDismiss.addEventListener('click', () => {
  hideElement(errorBox);
  resetUploadUI();
});
