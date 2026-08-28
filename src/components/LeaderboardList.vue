<script setup lang="ts">
import type { PublicPlayer } from '@/types/account'

defineProps<{ players: PublicPlayer[]; limit?: number }>()

function rankLabel(index: number) {
  return index < 3 ? ['01', '02', '03'][index] : String(index + 1).padStart(2, '0')
}
</script>

<template>
  <ol class="ranking-list">
    <li
      v-for="(player, index) in players.slice(0, limit || 6)"
      :key="player.id"
      :class="{ current: player.isCurrent }"
    >
      <span class="rank" :class="`rank-${index + 1}`">{{ rankLabel(index) }}</span>
      <span class="avatar" :style="{ '--hue': `${(player.username.charCodeAt(0) * 23) % 360}` }">
        {{ player.username.slice(0, 1).toUpperCase() }}
      </span>
      <span class="player-name">
        {{ player.username }}
        <small v-if="player.isCurrent">你</small>
      </span>
      <strong>{{ player.bestScore.toLocaleString('zh-CN') }}</strong>
    </li>
  </ol>
</template>

<style scoped>
.ranking-list { display: grid; gap: 5px; margin: 0; padding: 0; list-style: none; }
.ranking-list li { display: grid; grid-template-columns: 25px 34px minmax(0, 1fr) auto; align-items: center; gap: 9px; min-height: 46px; padding: 5px 8px; border: 1px solid transparent; border-radius: 12px; }
.ranking-list li.current { border-color: rgba(94,231,226,.23); background: rgba(94,231,226,.06); }
.rank { color: #566076; font-family: var(--mono); font-size: 10px; font-weight: 800; }
.rank-1 { color: #FFD166; }
.rank-2 { color: #AFC5D8; }
.rank-3 { color: #D99A6C; }
.avatar { display: grid; place-items: center; width: 32px; height: 32px; color: white; border-radius: 10px; background: hsl(var(--hue) 55% 46% / .8); font-size: 11px; font-weight: 900; }
.player-name { min-width: 0; overflow: hidden; color: #c7ccda; font-size: 12px; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
.player-name small { margin-left: 5px; padding: 2px 5px; color: var(--aqua); border-radius: 5px; background: rgba(94,231,226,.1); font-size: 8px; }
strong { color: var(--text); font-family: var(--mono); font-size: 11px; letter-spacing: -.04em; }
</style>
