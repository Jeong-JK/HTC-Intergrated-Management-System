/**
 * Google Drive Helper for HTC Partner CRM
 *
 * Setup Required:
 * 1. Google Cloud Console → Create Project
 * 2. Enable Google Drive API
 * 3. Create OAuth 2.0 Client ID (Web application)
 * 4. Add http://localhost:3002 and your production domain to Authorized JavaScript origins
 * 5. Replace GOOGLE_CLIENT_ID and GOOGLE_API_KEY below
 */

// Google OAuth Client ID from googledrive.json (Web Application)
const GOOGLE_CLIENT_ID = '138937069037-s3goad5rbl3h41u5b2og9bdne5e39jn1.apps.googleusercontent.com'
// API Key is optional for Drive API with OAuth
const GOOGLE_API_KEY = ''

// Google Drive API settings
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
const SCOPES = 'https://www.googleapis.com/auth/drive.file'

// Drive folder structure
const SHARED_DRIVE_NAME = '통신사업팀'
const ROOT_FOLDER_PATH = ['통신사업팀', '한림퓨리텍 자료', 'HTC_CRM']

let tokenClient = null
let gapiInited = false
let gisInited = false
let accessToken = null

/**
 * Wait for script to load
 */
function waitForScript(checkFn, scriptName, maxWait = 30000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now()
    const interval = setInterval(() => {
      if (checkFn()) {
        clearInterval(interval)
        console.log(`✅ ${scriptName} loaded`)
        resolve()
      } else if (Date.now() - startTime > maxWait) {
        clearInterval(interval)
        reject(new Error(`${scriptName} loading timeout (${maxWait}ms)`))
      }
    }, 100)
  })
}

/**
 * Initialize Google API and Identity Services
 */
export async function initializeGoogleDrive() {
  try {
    console.log('🔵 Starting Google API initialization...')

    // Wait for scripts to load
    await Promise.all([
      waitForScript(() => window.gapi !== undefined, 'Google API (gapi)'),
      waitForScript(() => window.google?.accounts !== undefined, 'Google Identity Services (GIS)')
    ])

    // Initialize Google API (gapi)
    await new Promise((resolve, reject) => {
      console.log('🔵 Loading gapi client...')
      window.gapi.load('client', async () => {
        try {
          const initConfig = {
            discoveryDocs: [DISCOVERY_DOC],
          }
          // Only add apiKey if it's provided
          if (GOOGLE_API_KEY) {
            initConfig.apiKey = GOOGLE_API_KEY
          }
          await window.gapi.client.init(initConfig)
          gapiInited = true
          console.log('✅ Google API client initialized')
          resolve()
        } catch (error) {
          console.error('❌ Error initializing Google API:', error)
          reject(error)
        }
      })
    })

    // Initialize Google Identity Services (GIS)
    console.log('🔵 Initializing Google Identity Services...')
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPES,
      callback: (response) => {
        if (response.error) {
          console.error('❌ Token error:', response.error)
          return
        }
        accessToken = response.access_token
        console.log('✅ Google Drive authorized')
      },
    })
    gisInited = true
    console.log('✅ Google Identity Services initialized')

    console.log('✅ Google Drive initialization complete')
  } catch (error) {
    console.error('❌ Google Drive initialization failed:', error)
    throw error
  }
}

/**
 * Request user authorization (shows Google Sign-in popup)
 */
export function requestAuthorization() {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      const error = new Error('Google Identity Services not initialized')
      console.error('❌', error)
      reject(error)
      return
    }

    console.log('🔵 Requesting Google authorization...')

    // Override callback to use promise
    const originalCallback = tokenClient.callback
    tokenClient.callback = (response) => {
      console.log('🔵 OAuth callback received:', response)

      if (response.error) {
        console.error('❌ OAuth error:', response.error, response)
        reject(new Error(response.error))
      } else {
        accessToken = response.access_token
        console.log('✅ Access token received')
        resolve(response.access_token)
      }
      tokenClient.callback = originalCallback
    }

    // Request access token
    try {
      console.log('🔵 Requesting access token...')
      tokenClient.requestAccessToken({ prompt: '' })
    } catch (error) {
      console.error('❌ Error requesting access token:', error)
      reject(error)
    }
  })
}

/**
 * Check if user is authorized
 */
export function isAuthorized() {
  return accessToken !== null
}

/**
 * Revoke authorization
 */
export function revokeAuthorization() {
  if (accessToken) {
    window.google.accounts.oauth2.revoke(accessToken, () => {
      console.log('✅ Authorization revoked')
    })
    accessToken = null
  }
}

/**
 * Find shared drive by name
 */
async function findSharedDriveId(name) {
  try {
    const response = await window.gapi.client.drive.drives.list({
      pageSize: 50,
      fields: 'drives(id,name)',
    })
    const drive = response.result.drives?.find(d => d.name === name)
    return drive?.id || null
  } catch (error) {
    console.error('Error finding shared drive:', error)
    return null
  }
}

/**
 * Get or create folder
 */
async function getOrCreateFolder(folderName, parentId, driveId = null) {
  try {
    // Search for existing folder
    const searchQuery = `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
    const searchParams = {
      q: searchQuery,
      fields: 'files(id,name)',
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
    }

    if (driveId) {
      searchParams.driveId = driveId
      searchParams.corpora = 'drive'
    }

    const searchResponse = await window.gapi.client.drive.files.list(searchParams)

    if (searchResponse.result.files && searchResponse.result.files.length > 0) {
      return searchResponse.result.files[0].id
    }

    // Create new folder
    const createParams = {
      resource: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      },
      fields: 'id',
      supportsAllDrives: true,
    }

    const createResponse = await window.gapi.client.drive.files.create(createParams)
    return createResponse.result.id
  } catch (error) {
    console.error('Error creating folder:', error)
    throw error
  }
}

/**
 * Get root folder ID (HTC_CRM)
 */
let rootFolderIdCache = null
async function getRootFolderId() {
  if (rootFolderIdCache) {
    return rootFolderIdCache
  }

  const driveId = await findSharedDriveId(SHARED_DRIVE_NAME)

  let currentId
  if (driveId) {
    // Shared drive: start from drive root
    currentId = driveId
    // Skip first element (shared drive name itself)
    for (const folderName of ROOT_FOLDER_PATH.slice(1)) {
      currentId = await getOrCreateFolder(folderName, currentId, driveId)
    }
  } else {
    // My Drive: create full path
    currentId = 'root'
    for (const folderName of ROOT_FOLDER_PATH) {
      currentId = await getOrCreateFolder(folderName, currentId)
    }
  }

  rootFolderIdCache = currentId
  return currentId
}

/**
 * Upload file to Google Drive
 * @param {File} file - File object from input
 * @param {string} companyName - Company name
 * @param {string} teamName - Team name
 * @param {string} contactName - Contact name
 * @param {Function} onProgress - Progress callback (percent: number) => void
 * @returns {Promise<{file_id: string, file_name: string, web_view_link: string}>}
 */
export async function uploadFileToDrive(file, companyName, teamName, contactName, onProgress = null) {
  if (!isAuthorized()) {
    throw new Error('Not authorized. Please sign in to Google Drive.')
  }

  try {
    // Get root folder
    const rootId = await getRootFolderId()
    const driveId = await findSharedDriveId(SHARED_DRIVE_NAME)

    // Create folder hierarchy: Company → Team → Contact
    const companyFolderId = await getOrCreateFolder(companyName, rootId, driveId)
    const teamFolderId = await getOrCreateFolder(teamName, companyFolderId, driveId)
    const contactFolderId = await getOrCreateFolder(contactName, teamFolderId, driveId)

    // Upload file with progress tracking using XMLHttpRequest
    const metadata = {
      name: file.name,
      parents: [contactFolderId],
    }

    const formData = new FormData()
    formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
    formData.append('file', file)

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()

      // Progress tracking
      if (onProgress) {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100)
            onProgress(percent)
          }
        })
      }

      // Success handler
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const result = JSON.parse(xhr.responseText)
            resolve({
              file_id: result.id,
              file_name: result.name,
              web_view_link: result.webViewLink || '',
            })
          } catch (error) {
            reject(new Error('Failed to parse response'))
          }
        } else {
          reject(new Error(`Upload failed: ${xhr.statusText}`))
        }
      })

      // Error handler
      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed: Network error'))
      })

      // Abort handler
      xhr.addEventListener('abort', () => {
        reject(new Error('Upload cancelled'))
      })

      // Send request
      xhr.open('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink&supportsAllDrives=true')
      xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`)
      xhr.send(formData)
    })
  } catch (error) {
    console.error('Error uploading file:', error)
    throw error
  }
}

/**
 * Get contact folder URL
 * Returns empty string if folder doesn't exist
 */
export async function getContactFolderUrl(companyName, teamName, contactName) {
  if (!isAuthorized()) {
    return ''
  }

  try {
    const rootId = await getRootFolderId()
    const driveId = await findSharedDriveId(SHARED_DRIVE_NAME)

    // Find folders (without creating)
    async function findFolder(name, parentId) {
      const searchQuery = `name='${name}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
      const searchParams = {
        q: searchQuery,
        fields: 'files(id)',
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
      }

      if (driveId) {
        searchParams.driveId = driveId
        searchParams.corpora = 'drive'
      }

      const response = await window.gapi.client.drive.files.list(searchParams)
      return response.result.files?.[0]?.id || null
    }

    const companyId = await findFolder(companyName, rootId)
    if (!companyId) return ''

    const teamId = await findFolder(teamName, companyId)
    if (!teamId) return ''

    const contactId = await findFolder(contactName, teamId)
    if (!contactId) return ''

    return `https://drive.google.com/drive/folders/${contactId}`
  } catch (error) {
    console.error('Error getting folder URL:', error)
    return ''
  }
}

/**
 * Open Drive folder in new tab
 */
export function openDriveFolderInBrowser(url) {
  if (url) {
    window.open(url, '_blank')
  }
}
