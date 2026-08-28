<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import AuthModal from '@/components/AuthModal.vue'
import BlockPlayfield from '@/components/BlockPlayfield.vue'
import RankingModal from '@/components/RankingModal.vue'
import { RossGame, type GameSnapshot } from '@/game/RossGame'
import { gameAudio } from '@/services/gameAudio'
import { useAccountStore } from '@/stores/account'

const account = useAccountStore()
const game = new RossGame()
const snapshot = ref<GameSnapshot>(game.snapshot)
const authOpen = ref(false)
const rankOpen = ref(false)
const soundEnabled = ref(gameAudio.enabled)
const toast = ref('')
const accountMenuOpen = ref(false)
const accountMenuRef = ref<HTMLElement | null>(null)
const debugModeEnabled = import.meta.env.DEV && import.meta.env.VITE_DEBUG_MODE !== 'false'
const contentProtectionEnabled = !debugModeEnabled
let toastTimer = 0
let touchStartX = 0
let touchStartY = 0

const currentPlayer = computed(() => account.player)
const topScore = computed(() => currentPlayer.value?.bestScore || 0)

game.onChange = (next) => (snapshot.value = next)
game.onGameOver = async (result) => {
  gameAudio.playGameOver()
  if (account.session) {
    const wasRecord = result.score > topScore.value
    try {
      await account.submitScore(result.score, result.lines)
      showToast(wasRecord ? '新纪录！成绩已保存到全服榜' : '本局成绩已保存到服务器')
    } catch {
      showToast('成绩保存失败，请检查网络后重试')
    }
  } else showToast('登录后可保存本局成绩')
}

function showToast(message: string) {
  toast.value = message
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => (toast.value = ''), 2600)
}

function restart() {
  if (snapshot.value.status === 'running' && snapshot.value.score > 0) {
    if (!window.confirm('要结束当前这局并重新开始吗？')) return
  }
  startGame()
}

function startGame() {
  gameAudio.playUi()
  game.start()
}

function undo() {
  gameAudio.playUi()
  game.undo()
}

function toggleSound() {
  soundEnabled.value = !soundEnabled.value
  gameAudio.setEnabled(soundEnabled.value)
}

function openRanking() {
  gameAudio.playUi()
  rankOpen.value = true
  void account.refreshLeaderboard().catch(() => showToast('排行榜刷新失败，请稍后重试'))
}

function openLoginFromRanking() {
  rankOpen.value = false
  authOpen.value = true
}

function toggleAccountMenu() {
  gameAudio.playUi()
  accountMenuOpen.value = !accountMenuOpen.value
}

async function logout() {
  if (!window.confirm('确定要退出当前账号吗？服务器中的账号和积分不会删除。')) return
  try {
    await account.logout()
    accountMenuOpen.value = false
    showToast('已退出登录')
  } catch {
    showToast('退出请求失败，请稍后重试')
  }
}

function closeAccountMenu(event: PointerEvent) {
  if (!accountMenuOpen.value || accountMenuRef.value?.contains(event.target as Node)) return
  accountMenuOpen.value = false
}

function isEditableTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('input, textarea, [contenteditable="true"]'))
}

function blockContentAction(event: Event) {
  if (contentProtectionEnabled && !isEditableTarget(event.target)) event.preventDefault()
}

function rememberTouchStart(event: TouchEvent) {
  const touch = event.touches[0]
  if (!touch) return
  touchStartX = touch.clientX
  touchStartY = touch.clientY
}

function preventHorizontalGesture(event: TouchEvent) {
  if (event.target instanceof Element && event.target.closest('.candidate-slot, .drag-piece')) return
  if (event.touches.length > 1) {
    event.preventDefault()
    return
  }
  const touch = event.touches[0]
  if (!touch) return
  const deltaX = Math.abs(touch.clientX - touchStartX)
  const deltaY = Math.abs(touch.clientY - touchStartY)
  if (deltaX > 10 && deltaX > deltaY) event.preventDefault()
}

function preventGesture(event: Event) {
  event.preventDefault()
}

onMounted(() => {
  window.addEventListener('touchstart', rememberTouchStart, { passive: true })
  window.addEventListener('touchmove', preventHorizontalGesture, { passive: false })
  document.addEventListener('pointerdown', closeAccountMenu)
  document.addEventListener('gesturestart', preventGesture)
})

onBeforeUnmount(() => {
  window.removeEventListener('touchstart', rememberTouchStart)
  window.removeEventListener('touchmove', preventHorizontalGesture)
  document.removeEventListener('pointerdown', closeAccountMenu)
  document.removeEventListener('gesturestart', preventGesture)
})
</script>

<template>
  <div
    class="app-shell"
    :class="{ 'content-protected': contentProtectionEnabled }"
    @contextmenu="blockContentAction"
    @copy="blockContentAction"
    @cut="blockContentAction"
    @dragstart="blockContentAction"
  >
    <div class="ambient ambient-one" />
    <div class="ambient ambient-two" />
    <div class="star-field" aria-hidden="true"><i v-for="n in 22" :key="n" /></div>

    <header class="topbar">
      <a class="brand" href="#" aria-label="坨坨方块首页">
        <span class="brand-blocks" aria-hidden="true"><i /><i /><i /><i /></span>
        <span><b>坨坨方块</b><small>TUOTUO BLOCKS</small></span>
      </a>
      <button class="top-rank-button" @click="openRanking">
        <span class="rank-medal">★</span>
        <span><b>积分排名</b><small>点击查看完整榜单</small></span>
        <strong>#{{ account.rank || '—' }}</strong>
      </button>
      <div class="account-area">
        <button class="sound-button" :aria-label="soundEnabled ? '关闭声音' : '打开声音'" @click="toggleSound">
          {{ soundEnabled ? '♫' : '♩' }}
        </button>
        <template v-if="account.session">
          <span class="online-dot" />
          <div ref="accountMenuRef" class="user-menu">
            <div class="account-copy"><b>{{ account.session.username }}</b><small>RANK #{{ account.rank || '—' }}</small></div>
            <button
              class="avatar-button"
              :title="`${account.session.username}，打开账户菜单`"
              aria-haspopup="menu"
              :aria-expanded="accountMenuOpen"
              @click.stop="toggleAccountMenu"
            >
              {{ account.session.username.slice(0, 1).toUpperCase() }}
            </button>
            <Transition name="account-menu">
              <div v-if="accountMenuOpen" class="account-popover" role="menu">
                <div class="account-popover-head">
                  <span>{{ account.session.username.slice(0, 1).toUpperCase() }}</span>
                  <div><b>{{ account.session.username }}</b><small>当前登录账号</small></div>
                </div>
                <div class="account-popover-stats">
                  <span><small>排名</small><b>#{{ account.rank || '—' }}</b></span>
                  <span><small>最高分</small><b>{{ topScore.toLocaleString('zh-CN') }}</b></span>
                </div>
                <button class="logout-button" role="menuitem" @click="logout">退出登录</button>
              </div>
            </Transition>
          </div>
        </template>
        <button v-else class="login-button" @click="authOpen = true">登录 / 注册</button>
      </div>
    </header>

    <main class="game-layout ross-layout">
      <aside class="left-rail">
        <section class="profile-card panel">
          <p class="section-kicker">PLAYER CARD</p>
          <template v-if="account.session">
            <div class="profile-head">
              <span class="large-avatar">{{ account.session.username.slice(0, 1).toUpperCase() }}</span>
              <span><strong>{{ account.session.username }}</strong><small>保持节奏，刷新自己。</small></span>
            </div>
            <div class="best-score"><span>个人最高</span><strong>{{ topScore.toLocaleString('zh-CN') }}</strong></div>
            <div class="profile-stats">
              <span><small>排名</small><b>#{{ account.rank || '—' }}</b></span>
              <span><small>总消除</small><b>{{ currentPlayer?.totalLines || 0 }}</b></span>
              <span><small>局数</small><b>{{ currentPlayer?.gamesPlayed || 0 }}</b></span>
            </div>
          </template>
          <template v-else>
            <div class="guest-avatar">游</div>
            <h2>游客玩家</h2>
            <p class="guest-copy">可以直接开玩；登录后保存最高分并加入排名。</p>
            <button class="outline-button" @click="authOpen = true">建立玩家档案</button>
          </template>
        </section>

        <section class="controls-card panel">
          <div class="panel-heading"><span>玩法说明</span><small>HOW TO PLAY</small></div>
          <ol class="how-list">
            <li><b>01</b><span>拖动下方任意方块，放到棋盘空位。</span></li>
            <li><b>02</b><span>铺满完整的一行或一列即可消除。</span></li>
            <li><b>03</b><span>连续消除会获得更高的连击加分。</span></li>
          </ol>
        </section>
        <p class="learning-note"><i>i</i> 学习复刻版 · 原创视觉与代码<br />账号数据仅存于本机</p>
      </aside>

      <section class="game-stage" aria-label="游戏主区域">
        <div class="score-hero">
          <div class="score-side"><span>消除</span><strong>{{ String(snapshot.lines).padStart(2, '0') }}</strong></div>
          <div class="score-main">
            <span>本局分数</span>
            <strong>{{ snapshot.score.toLocaleString('zh-CN') }}</strong>
            <small>最高分：{{ topScore.toLocaleString('zh-CN') }}</small>
          </div>
          <div class="score-side"><span>连击</span><strong>×{{ snapshot.combo }}</strong></div>
        </div>

        <div class="cabinet-wrap ross-cabinet">
          <div class="cabinet-topline" :class="{ warning: snapshot.warning }">
            <Transition name="cabinet-warning" mode="out-in">
              <span v-if="snapshot.warning" key="warning" class="cabinet-warning" role="status" aria-live="polite">
                <b>!</b>
                <span>
                  <strong>
                    还剩{{ snapshot.warning.stepsLeft === 1 ? '一步' : '两步' }}破局机会
                  </strong>
                  <small>先消除空间，再放入标记方块</small>
                </span>
              </span>
              <span v-else key="mode">TUOTUO // DRAG MODE</span>
            </Transition>
            <i :class="{ live: snapshot.status === 'running' }" />
          </div>
          <div class="board-area" :class="{ 'is-idle': snapshot.status === 'idle' }">
            <BlockPlayfield :snapshot="snapshot" :game="game" />
            <Transition name="game-over" appear>
              <div
                v-if="snapshot.status !== 'running'"
                :key="snapshot.status"
                class="game-overlay ross-overlay"
                :class="{ 'is-over': snapshot.status === 'over' }"
              >
                <template v-if="snapshot.status === 'over'">
                  <div class="game-over-rays" aria-hidden="true" />
                  <div class="game-over-particles" aria-hidden="true">
                    <i v-for="n in 12" :key="n" />
                  </div>
                  <div class="game-over-card">
                    <span class="game-over-mark" aria-hidden="true"><i /><i /><i /><i /></span>
                    <p>NO MORE MOVES</p>
                    <h1>本局结束</h1>
                    <small class="game-over-copy">空间已经用尽，调整顺序再挑战一次</small>
                    <div class="round-result">
                      <span class="result-primary">
                        <small>本局得分</small>
                        <b>{{ snapshot.score.toLocaleString('zh-CN') }}</b>
                      </span>
                      <span class="result-secondary">
                        <small>完成消除</small>
                        <b>{{ snapshot.lines }}</b>
                      </span>
                      <span class="result-secondary">
                        <small>个人最高</small>
                        <b>{{ topScore.toLocaleString('zh-CN') }}</b>
                      </span>
                    </div>
                    <button class="primary-button game-over-button" @click="startGame">
                      <span>◆</span> 再来一局
                    </button>
                    <small class="save-hint">{{ account.session ? '本局成绩已记录' : '登录后可保存成绩并参与排名' }}</small>
                  </div>
                </template>
                <template v-else>
                  <p>READY WHEN YOU ARE</p>
                  <h1>坨坨方块</h1>
                  <button class="primary-button" @click="startGame"><span>◆</span> 开始游戏</button>
                  <small>拖、放、填满、消除</small>
                </template>
              </div>
            </Transition>
          </div>
          <div class="cabinet-footer ross-actions">
            <span>每用完 3 个方块自动刷新</span>
            <div>
              <button :disabled="!snapshot.canUndo" @click="undo">↶ 撤回</button>
              <button :disabled="snapshot.status === 'idle'" @click="restart">↻ 重开</button>
            </div>
          </div>
        </div>
      </section>

      <aside class="right-rail">
        <section class="mode-card panel">
          <p class="section-kicker">CURRENT MODE</p>
          <div class="mode-art" aria-hidden="true"><i v-for="n in 12" :key="n" /></div>
          <h3>经典拖动</h3>
          <p>10 × 10 棋盘 · 三选拼块 · 横竖消除</p>
        </section>

        <section class="daily-card panel">
          <span class="daily-icon">✦</span>
          <div><small>今日练习</small><b>完成 10 次横竖消除</b></div>
          <span class="daily-progress">{{ Math.min(snapshot.lines, 10) }}/10</span>
        </section>
      </aside>
    </main>

    <footer class="site-footer">
      <span>TUOTUO BLOCKS / PRODUCTION BUILD 0.2.3</span>
      <span>先看空间，再放方块。</span>
    </footer>

    <Transition name="toast"><div v-if="toast" class="toast-message">{{ toast }}</div></Transition>
    <RankingModal
      v-if="rankOpen"
      :players="account.leaderboard"
      :current-rank="account.rank"
      :logged-in="Boolean(account.session)"
      @close="rankOpen = false"
      @login="openLoginFromRanking"
    />
    <AuthModal v-if="authOpen" @close="authOpen = false" />
  </div>
</template>
