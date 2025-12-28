// ============================================
// DOM Elements
// ============================================

// Auth Elements
const authScreen = document.getElementById('auth-screen');
const mainScreen = document.getElementById('main-screen');
const authForm = document.getElementById('auth-form');
const passwordInput = document.getElementById('password-input');
const authError = document.getElementById('auth-error');

// Tab Elements
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Idea Form Elements
const ideaForm = document.getElementById('idea-form');
const ideaEmail = document.getElementById('idea-email');
const ideaName = document.getElementById('idea-name');
const ideaProblem = document.getElementById('idea-problem');
const ideaSolution = document.getElementById('idea-solution');
const ideaBillion = document.getElementById('idea-billion');
const submitIdeaBtn = document.getElementById('submit-idea-btn');
const ideaSuccess = document.getElementById('idea-success');
const submitAnotherIdea = document.getElementById('submit-another-idea');

// Upload Elements
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
const uploadError = document.getElementById('upload-error');
const uploadErrorMessage = document.getElementById('upload-error-message');
const errorDismiss = document.getElementById('error-dismiss');
const uploadCounter = document.getElementById('upload-counter');

// Dashboard Elements
const refreshIdeasBtn = document.getElementById('refresh-ideas');
const ideasLoading = document.getElementById('ideas-loading');
const ideasEmpty = document.getElementById('ideas-empty');
const ideasList = document.getElementById('ideas-list');

// ============================================
// State
// ============================================
let selectedFile = null;
let authPassword = null;
let accessLevel = null; // 'admin' or 'public'

// ============================================
// Constants
// ============================================
const PUBLIC_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ADMIN_MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB (limited by Netlify)
const PUBLIC_MAX_UPLOADS = 10;
const API_BASE = '/api';
const UPLOAD_COUNT_KEY = 'uploadgetlink_upload_count';

// ============================================
// Utility Functions
// ============================================
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function showElement(el) {
  if (el) el.classList.remove('hidden');
}

function hideElement(el) {
  if (el) el.classList.add('hidden');
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

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// ============================================
// Tab Navigation
// ============================================
function switchTab(tabName) {
  // Update buttons
  tabButtons.forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.tab === tabName) {
      btn.classList.add('active');
    }
  });

  // Update content
  tabContents.forEach(content => {
    content.classList.remove('active');
    hideElement(content);
  });

  const activeContent = document.getElementById(`tab-${tabName}`);
  if (activeContent) {
    activeContent.classList.add('active');
    showElement(activeContent);
  }

  // Load dashboard data if switching to dashboard
  if (tabName === 'dashboard' && accessLevel === 'admin') {
    loadIdeas();
  }
}

tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const tabName = btn.dataset.tab;
    if (tabName) {
      switchTab(tabName);
    }
  });
});

// ============================================
// Authentication
// ============================================
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
      showElement(mainScreen);
      authError.textContent = '';

      // Show admin-only elements
      if (accessLevel === 'admin') {
        document.querySelectorAll('.admin-only').forEach(el => {
          el.classList.remove('hidden');
        });
      }

      updateUploadCounter();
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

// ============================================
// Idea Submission
// ============================================
ideaForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const idea = {
    email: ideaEmail.value.trim(),
    name: ideaName.value.trim() || 'Anonymous',
    problem: ideaProblem.value.trim(),
    solution: ideaSolution.value.trim(),
    billion: ideaBillion.value.trim()
  };

  // Validate
  if (!idea.email || !idea.problem || !idea.solution || !idea.billion) {
    alert('Please fill in all required fields');
    return;
  }

  submitIdeaBtn.disabled = true;
  submitIdeaBtn.textContent = 'Submitting...';

  try {
    const response = await fetch(`${API_BASE}/submit-idea`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Upload-Password': authPassword
      },
      body: JSON.stringify(idea)
    });

    const data = await response.json();

    if (response.ok && data.success) {
      hideElement(ideaForm);
      showElement(ideaSuccess);
    } else {
      alert(data.error || 'Failed to submit idea. Please try again.');
    }
  } catch (error) {
    console.error('Submit error:', error);
    alert('Connection error. Please try again.');
  } finally {
    submitIdeaBtn.disabled = false;
    submitIdeaBtn.textContent = '🚀 Submit My Idea';
  }
});

submitAnotherIdea.addEventListener('click', () => {
  ideaForm.reset();
  hideElement(ideaSuccess);
  showElement(ideaForm);
});

// ============================================
// Admin Dashboard
// ============================================
async function loadIdeas() {
  if (accessLevel !== 'admin') return;

  showElement(ideasLoading);
  hideElement(ideasEmpty);
  hideElement(ideasList);

  try {
    const response = await fetch(`${API_BASE}/get-ideas`, {
      headers: {
        'X-Upload-Password': authPassword
      }
    });

    const data = await response.json();

    hideElement(ideasLoading);

    if (response.ok && data.ideas) {
      if (data.ideas.length === 0) {
        showElement(ideasEmpty);
      } else {
        renderIdeas(data.ideas);
        showElement(ideasList);
      }
    } else {
      ideasList.innerHTML = `<div class="error-box"><p>${data.error || 'Failed to load ideas'}</p></div>`;
      showElement(ideasList);
    }
  } catch (error) {
    console.error('Load ideas error:', error);
    hideElement(ideasLoading);
    ideasList.innerHTML = '<div class="error-box"><p>Connection error. Please try again.</p></div>';
    showElement(ideasList);
  }
}

function renderIdeas(ideas) {
  ideasList.innerHTML = ideas.map(idea => `
    <div class="idea-card">
      <div class="idea-card-header">
        <span class="idea-card-email">${escapeHtml(idea.email)}</span>
        <span class="idea-card-date">${formatDate(idea.timestamp)}</span>
      </div>
      ${idea.name && idea.name !== 'Anonymous' ? `<div class="idea-card-name">👤 ${escapeHtml(idea.name)}</div>` : ''}
      <div class="idea-card-section">
        <h4>🔥 Problem to Automate</h4>
        <p>${escapeHtml(idea.problem)}</p>
      </div>
      <div class="idea-card-section">
        <h4>💡 Proposed Solution</h4>
        <p>${escapeHtml(idea.solution)}</p>
      </div>
      <div class="idea-card-section">
        <h4>🚀 Billion-Dollar Idea</h4>
        <p>${escapeHtml(idea.billion)}</p>
      </div>
    </div>
  `).join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

if (refreshIdeasBtn) {
  refreshIdeasBtn.addEventListener('click', loadIdeas);
}

// ============================================
// File Upload
// ============================================
function updateUploadCounter() {
  if (!uploadCounter) return;

  if (accessLevel === 'admin') {
    hideElement(uploadCounter);
    return;
  }

  const count = getUploadCount();
  const remaining = PUBLIC_MAX_UPLOADS - count;

  uploadCounter.textContent = `${remaining} uploads remaining (${count}/${PUBLIC_MAX_UPLOADS} used)`;
  uploadCounter.classList.remove('warning', 'limit-reached', 'hidden');
  showElement(uploadCounter);

  if (remaining <= 0) {
    uploadCounter.classList.add('limit-reached');
    uploadCounter.textContent = 'Upload limit reached (10/10)';
  } else if (remaining <= 3) {
    uploadCounter.classList.add('warning');
  }
}

function resetUploadUI() {
  selectedFile = null;
  if (fileInput) fileInput.value = '';
  hideElement(fileInfo);
  hideElement(progressContainer);
  hideElement(resultSection);
  hideElement(uploadError);
  if (uploadBtn) {
    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Upload File';
  }
  if (progressFill) progressFill.style.width = '0%';
  if (progressText) progressText.textContent = '0%';
  showElement(dropZone);
  updateUploadCounter();

  if (!canUpload() && uploadBtn) {
    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Upload Limit Reached';
  }
}

function showUploadError(message) {
  if (uploadErrorMessage) uploadErrorMessage.textContent = message;
  showElement(uploadError);
}

// Drag and Drop
if (dropZone) {
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
      showUploadError('You have reached the upload limit (10 files)');
      return;
    }

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  });
}

// File Input
if (fileInput) {
  fileInput.addEventListener('change', (e) => {
    if (!canUpload()) {
      showUploadError('You have reached the upload limit (10 files)');
      e.target.value = '';
      return;
    }

    if (e.target.files.length > 0) {
      handleFileSelect(e.target.files[0]);
    }
  });
}

function handleFileSelect(file) {
  const maxSize = getMaxFileSize();

  if (file.size > maxSize) {
    showUploadError(`File is too large. Maximum size is ${formatFileSize(maxSize)}`);
    return;
  }

  selectedFile = file;
  if (fileName) fileName.textContent = file.name;
  if (fileSize) fileSize.textContent = formatFileSize(file.size);
  showElement(fileInfo);
  if (uploadBtn) uploadBtn.disabled = false;
  hideElement(uploadError);
  hideElement(resultSection);
}

// Remove File
if (removeFileBtn) {
  removeFileBtn.addEventListener('click', resetUploadUI);
}

// Upload Button
if (uploadBtn) {
  uploadBtn.addEventListener('click', async () => {
    if (!selectedFile || !authPassword) return;

    if (!canUpload()) {
      showUploadError('You have reached the upload limit (10 files)');
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);

    hideElement(dropZone);
    hideElement(fileInfo);
    showElement(progressContainer);
    uploadBtn.disabled = true;

    try {
      const xhr = new XMLHttpRequest();

      const uploadPromise = new Promise((resolve, reject) => {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            if (progressFill) progressFill.style.width = percent + '%';
            if (progressText) progressText.textContent = percent + '%';
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

      if (accessLevel !== 'admin') {
        incrementUploadCount();
      }

      hideElement(progressContainer);
      if (resultLink) resultLink.value = result.url;
      showElement(resultSection);
      updateUploadCounter();

    } catch (error) {
      console.error('Upload error:', error);
      hideElement(progressContainer);
      showUploadError(error.error || error.message || 'Upload failed. Please try again.');
      showElement(dropZone);
      uploadBtn.disabled = false;
    }
  });
}

// Copy Link
if (copyBtn) {
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(resultLink.value);
      showElement(copyFeedback);
      setTimeout(() => hideElement(copyFeedback), 2000);
    } catch (error) {
      resultLink.select();
      document.execCommand('copy');
      showElement(copyFeedback);
      setTimeout(() => hideElement(copyFeedback), 2000);
    }
  });
}

// Upload Another
if (uploadAnotherBtn) {
  uploadAnotherBtn.addEventListener('click', resetUploadUI);
}

// Error Dismiss
if (errorDismiss) {
  errorDismiss.addEventListener('click', () => {
    hideElement(uploadError);
    resetUploadUI();
  });
}
