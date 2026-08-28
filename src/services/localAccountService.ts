import type { PublicPlayer, SessionUser, UserAccount } from '@/types/account'

const USERS_KEY = 'ross-blocks:users:v1'
const SESSION_KEY = 'ross-blocks:session:v1'
const SCORE_SCALE_KEY = 'ross-blocks:score-scale'

const seedPlayers: PublicPlayer[] = [
  { id: 'seed-1', username: '北极星', bestScore: 2864, totalLines: 238, gamesPlayed: 42 },
  { id: 'seed-2', username: '橘子海', bestScore: 2198, totalLines: 196, gamesPlayed: 31 },
  { id: 'seed-3', username: '像素猫', bestScore: 1735, totalLines: 164, gamesPlayed: 29 },
  { id: 'seed-4', username: '小方同学', bestScore: 1282, totalLines: 121, gamesPlayed: 25 },
  { id: 'seed-5', username: '慢慢来', bestScore: 896, totalLines: 88, gamesPlayed: 19 },
]

function readUsers(): UserAccount[] {
  try {
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]') as UserAccount[]
    if (localStorage.getItem(SCORE_SCALE_KEY) !== 'v2') {
      const migrated = users.map((user) => ({ ...user, bestScore: Math.floor(user.bestScore / 10) }))
      localStorage.setItem(USERS_KEY, JSON.stringify(migrated))
      localStorage.setItem(SCORE_SCALE_KEY, 'v2')
      return migrated
    }
    return users
  } catch {
    return []
  }
}

function writeUsers(users: UserAccount[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

async function hashPassword(password: string) {
  const data = new TextEncoder().encode(`ross-blocks-learning:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function toSession(user: UserAccount): SessionUser {
  return { id: user.id, username: user.username }
}

export const localAccountService = {
  getSession(): SessionUser | null {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null') as SessionUser | null
    } catch {
      return null
    }
  },

  async register(username: string, password: string) {
    const normalized = username.trim()
    const users = readUsers()
    if (users.some((user) => user.username.toLowerCase() === normalized.toLowerCase())) {
      throw new Error('这个昵称已经被注册啦')
    }
    const user: UserAccount = {
      id: crypto.randomUUID(),
      username: normalized,
      passwordHash: await hashPassword(password),
      createdAt: Date.now(),
      bestScore: 0,
      totalLines: 0,
      gamesPlayed: 0,
    }
    users.push(user)
    writeUsers(users)
    const session = toSession(user)
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    return session
  },

  async login(username: string, password: string) {
    const users = readUsers()
    const passwordHash = await hashPassword(password)
    const user = users.find(
      (item) => item.username.toLowerCase() === username.trim().toLowerCase() && item.passwordHash === passwordHash,
    )
    if (!user) throw new Error('昵称或密码不正确')
    const session = toSession(user)
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    return session
  },

  logout() {
    localStorage.removeItem(SESSION_KEY)
  },

  submitScore(userId: string, score: number, lines: number) {
    const users = readUsers()
    const user = users.find((item) => item.id === userId)
    if (!user) return
    user.bestScore = Math.max(user.bestScore, Math.floor(score))
    user.totalLines += Math.max(0, Math.floor(lines))
    user.gamesPlayed += 1
    writeUsers(users)
  },

  getPlayer(userId: string): PublicPlayer | null {
    const user = readUsers().find((item) => item.id === userId)
    if (!user) return null
    return {
      id: user.id,
      username: user.username,
      bestScore: user.bestScore,
      totalLines: user.totalLines,
      gamesPlayed: user.gamesPlayed,
    }
  },

  getLeaderboard(currentUserId?: string): PublicPlayer[] {
    const localPlayers: PublicPlayer[] = readUsers().map((user) => ({
      id: user.id,
      username: user.username,
      bestScore: user.bestScore,
      totalLines: user.totalLines,
      gamesPlayed: user.gamesPlayed,
      isCurrent: user.id === currentUserId,
    }))
    return [...seedPlayers, ...localPlayers].sort((a, b) => b.bestScore - a.bestScore).slice(0, 20)
  },
}
