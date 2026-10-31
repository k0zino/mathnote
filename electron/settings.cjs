const fs = require('node:fs')
const path = require('node:path')
const { app, safeStorage } = require('electron')

const DEFAULTS = {
  presetId: 'openai',
  provider: 'openai',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o',
  apiKey: '',
}

function settingsPath() {
  return path.join(app.getPath('userData'), 'settings.json')
}

function getSettings() {
  try {
    const raw = JSON.parse(fs.readFileSync(settingsPath(), 'utf8'))
    const out = { ...DEFAULTS, ...raw }
    if (!raw.presetId) out.presetId = 'custom'
    delete out.apiKeyEnc

    if (raw.apiKeyEnc) {
      try {
        out.apiKey = safeStorage.decryptString(Buffer.from(raw.apiKeyEnc, 'base64'))
      } catch {
        out.apiKey = ''
      }
    }
    return out
  } catch {
    return { ...DEFAULTS }
  }
}

function setSettings(settings) {
  const { apiKey, ...rest } = settings || {}
  const data = { ...DEFAULTS, ...rest }

  try {
    if (apiKey && safeStorage.isEncryptionAvailable()) {
      data.apiKeyEnc = safeStorage.encryptString(apiKey).toString('base64')
    } else {
      data.apiKey = apiKey || ''
    }
  } catch {
    data.apiKey = apiKey || ''
  }

  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true })
  fs.writeFileSync(settingsPath(), JSON.stringify(data, null, 2))
  return getSettings()
}

module.exports = { getSettings, setSettings, DEFAULTS }
