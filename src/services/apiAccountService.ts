import type { PublicPlayer, SessionUser } from '@/types/account'
import type { RossGameSave } from '@/game/RossGame'

const API_BASE = (import.meta.env.VITE_API_BASE || '/api').replace(/\/$/, '')
const TOKEN_KEY = 'ross-blocks:api-token:v1'
const SESSION_KEY = 'ross-blocks:api-session:v1'

interface AuthResponse {
  token?: string
  session: SessionUser
  player: PublicPlayer
}

interface LeaderboardResponse {
  players: PublicPlayer[]
  currentRank: number | null
}

function token() {
  return localStorage.getItem(TOKEN_KEY)
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(SESSION_KEY)
}

async function request<T>(path: string, options: RequestInit = {}, authenticated = false): Promise<T> {
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')
  if (options.body) headers.set('Content-Type', 'application/json')
  if (authenticated) {
    const currentToken = token()
    if (!currentToken) throw new Error('请先登录')
    headers.set('Authorization', `Bearer ${currentToken}`)
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers, credentials: 'same-origin' })
  } catch {
    throw new Error('无法连接游戏服务器，请检查网络后重试')
  }

  const payload = await response.json().catch(() => ({})) as { error?: string } & T
  if (!response.ok) {
    if (response.status === 401 && authenticated) clearSession()
    throw new Error(payload.error || '服务器请求失败，请稍后重试')
  }
  return payload
}

function saveAuth(result: AuthResponse) {
  if (result.token) localStorage.setItem(TOKEN_KEY, result.token)
  localStorage.setItem(SESSION_KEY, JSON.stringify(result.session))
}

export const apiAccountService = {
  hasToken() {
    return Boolean(token())
  },

  getCachedSession(): SessionUser | null {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null') as SessionUser | null
    } catch {
      return null
    }
  },

  async register(username: string, password: string) {
    const result = await request<AuthResponse>('/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
    saveAuth(result)
    return result
  },

  async login(username: string, password: string) {
    const result = await request<AuthResponse>('/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
    saveAuth(result)
    return result
  },

  async me() {
    const result = await request<AuthResponse>('/me', {}, true)
    saveAuth(result)
    return result
  },

  async logout() {
    try {
      if (token()) await request<{ ok: true }>('/logout', { method: 'POST' }, true)
    } finally {
      clearSession()
    }
  },

  async submitScore(score: number, lines: number) {
    return request<{ player: PublicPlayer }>(
      '/scores',
      { method: 'POST', body: JSON.stringify({ score: Math.floor(score), lines: Math.floor(lines) }) },
      true,
    )
  },

  saveGame(save: RossGameSave) {
    return request<{ ok: true }>(
      '/game-save',
      { method: 'PUT', body: JSON.stringify({ save }) },
      true,
    )
  },

  loadGame() {
    return request<{ save: RossGameSave | null }>('/game-save', {}, true)
  },

  clearGame() {
    return request<{ ok: true }>('/game-save', { method: 'DELETE' }, true)
  },

  getLeaderboard(limit = 20) {
    return request<LeaderboardResponse>(`/leaderboard?limit=${limit}`, {}, Boolean(token()))
  },
}
