export interface UserAccount {
  id: string
  username: string
  passwordHash: string
  createdAt: number
  bestScore: number
  totalLines: number
  gamesPlayed: number
}

export interface PublicPlayer {
  id: string
  username: string
  bestScore: number
  totalLines: number
  gamesPlayed: number
  isCurrent?: boolean
}

export interface SessionUser {
  id: string
  username: string
}
