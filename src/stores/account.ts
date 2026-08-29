import { ref } from 'vue'
import { defineStore } from 'pinia'
import { apiAccountService } from '@/services/apiAccountService'
import type { PublicPlayer, SessionUser } from '@/types/account'
import type { RossGameSave } from '@/game/RossGame'

export const useAccountStore = defineStore('account', () => {
  const session = ref<SessionUser | null>(apiAccountService.getCachedSession())
  const player = ref<PublicPlayer | null>(null)
  const leaderboard = ref<PublicPlayer[]>([])
  const rank = ref<number | null>(null)
  const nextStartScore = ref(apiAccountService.getCachedStartBonus())
  const loading = ref(true)

  async function refreshLeaderboard() {
    const result = await apiAccountService.getLeaderboard(20)
    leaderboard.value = result.players
    rank.value = result.currentRank
  }

  async function register(username: string, password: string) {
    const result = await apiAccountService.register(username, password)
    session.value = result.session
    player.value = result.player
    nextStartScore.value = result.startBonus
    try {
      await refreshLeaderboard()
    } catch {
      leaderboard.value = []
    }
  }

  async function login(username: string, password: string) {
    const result = await apiAccountService.login(username, password)
    session.value = result.session
    player.value = result.player
    nextStartScore.value = result.startBonus
    try {
      await refreshLeaderboard()
    } catch {
      leaderboard.value = []
    }
  }

  async function logout() {
    try {
      await apiAccountService.logout()
    } catch {
      // 即使服务器暂时离线，也应允许玩家清除本机登录状态。
    } finally {
      session.value = null
      player.value = null
      rank.value = null
      nextStartScore.value = 0
      try {
        await refreshLeaderboard()
      } catch {
        leaderboard.value = []
      }
    }
  }

  async function submitScore(score: number, lines: number) {
    if (!session.value) return
    const result = await apiAccountService.submitScore(score, lines)
    player.value = result.player
    try {
      await refreshLeaderboard()
    } catch {
      // 成绩已成功保存，榜单稍后再次打开时会自动刷新。
    }
  }

  async function startGame(gameId: string) {
    if (!session.value || nextStartScore.value <= 0) return { initialScore: 0, randomBoard: false }
    const result = await apiAccountService.startGame(gameId)
    nextStartScore.value = 0
    return result
  }

  async function saveGame(save: RossGameSave) {
    if (!session.value) return
    await apiAccountService.saveGame(save)
  }

  async function loadGame() {
    if (!session.value) return null
    return (await apiAccountService.loadGame()).save
  }

  async function clearGame() {
    if (!session.value) return
    await apiAccountService.clearGame()
  }

  async function initialize() {
    try {
      if (apiAccountService.hasToken()) {
        const result = await apiAccountService.me()
        session.value = result.session
        player.value = result.player
        nextStartScore.value = result.startBonus
      } else {
        session.value = null
        nextStartScore.value = 0
      }
      await refreshLeaderboard()
    } catch {
      session.value = null
      player.value = null
      rank.value = null
      nextStartScore.value = 0
      try {
        await refreshLeaderboard()
      } catch {
        leaderboard.value = []
      }
    } finally {
      loading.value = false
    }
  }

  void initialize()

  return {
    session,
    leaderboard,
    player,
    rank,
    nextStartScore,
    loading,
    register,
    login,
    logout,
    submitScore,
    startGame,
    saveGame,
    loadGame,
    clearGame,
    refreshLeaderboard,
  }
})
