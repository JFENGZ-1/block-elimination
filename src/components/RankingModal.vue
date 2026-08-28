<script setup lang="ts">
import LeaderboardList from '@/components/LeaderboardList.vue'
import type { PublicPlayer } from '@/types/account'

defineProps<{ players: PublicPlayer[]; currentRank: number | null; loggedIn: boolean }>()
const emit = defineEmits<{ close: []; login: [] }>()
</script>

<template>
  <div class="rank-backdrop" role="presentation" @click.self="emit('close')">
    <section class="rank-modal" role="dialog" aria-modal="true" aria-label="积分排行榜">
      <button class="rank-close" aria-label="关闭排名" @click="emit('close')">×</button>
      <div class="rank-crown" aria-hidden="true">★</div>
      <p>ROSS GLOBAL RANK</p>
      <h2>积分排行榜</h2>
      <div v-if="loggedIn" class="my-rank-strip">
        <span>我的当前排名</span><strong>#{{ currentRank || '—' }}</strong>
      </div>
      <div class="rank-scroll">
        <LeaderboardList :players="players" :limit="20" />
      </div>
      <button v-if="!loggedIn" class="rank-login" @click="emit('login')">登录并加入排行榜</button>
      <small>排行榜按玩家历史最高分排序</small>
    </section>
  </div>
</template>

<style scoped>
.rank-backdrop { position: fixed; z-index: 60; inset: 0; display: grid; place-items: center; padding: 20px; background: rgba(1,34,56,.7); backdrop-filter: blur(14px); }
.rank-modal { position: relative; width: min(100%, 440px); max-height: min(760px, 88vh); padding: 30px 24px 22px; overflow: hidden; border: 2px solid rgba(177,248,255,.64); border-radius: 30px; background: linear-gradient(180deg, rgba(16,139,173,.98), rgba(5,61,91,.98)); box-shadow: 0 30px 80px rgba(0,36,60,.42), inset 0 1px rgba(255,255,255,.3); }
.rank-modal::before { content: ''; position: absolute; inset: 0; pointer-events: none; background: radial-gradient(circle at 18% 10%, rgba(255,255,255,.25), transparent 25%), radial-gradient(circle at 82% 22%, rgba(103,241,255,.22), transparent 30%); }
.rank-close { position: absolute; z-index: 2; top: 16px; right: 16px; width: 36px; height: 36px; color: white; border: 1px solid rgba(255,255,255,.28); border-radius: 50%; background: rgba(3,56,86,.35); font-size: 23px; cursor: pointer; }
.rank-crown { position: relative; z-index: 1; display: grid; place-items: center; width: 54px; height: 54px; margin: 0 auto 10px; color: #fff6a2; border: 3px solid #fff4a2; border-radius: 50%; background: linear-gradient(#ffd63c,#ff9f19); box-shadow: 0 5px 0 #d66c09, 0 0 26px rgba(255,231,81,.4); font-size: 24px; }
.rank-modal > p { position: relative; z-index: 1; margin: 0; color: #a9f7ff; font-family: var(--mono); font-size: 8px; font-weight: 900; letter-spacing: .18em; text-align: center; }
.rank-modal h2 { position: relative; z-index: 1; margin: 5px 0 18px; color: white; font-family: var(--display); font-size: 28px; text-align: center; text-shadow: 0 3px rgba(0,55,82,.35); }
.my-rank-strip { position: relative; z-index: 1; display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; padding: 11px 14px; border: 1px solid rgba(255,244,137,.35); border-radius: 13px; background: rgba(255,196,43,.14); }
.my-rank-strip span { font-size: 11px; font-weight: 700; }
.my-rank-strip strong { color: #fff18e; font-family: var(--mono); font-size: 15px; }
.rank-scroll { position: relative; z-index: 1; max-height: 440px; padding: 8px; overflow-y: auto; border: 1px solid rgba(184,245,255,.2); border-radius: 18px; background: rgba(2,40,65,.46); scrollbar-width: thin; }
.rank-login { position: relative; z-index: 1; width: 100%; margin-top: 14px; padding: 12px; color: #754100; border: 0; border-radius: 13px; background: linear-gradient(#ffe65c,#ffae22); box-shadow: 0 5px 0 #d8730d; font-weight: 900; cursor: pointer; }
.rank-modal > small { position: relative; z-index: 1; display: block; margin-top: 14px; color: rgba(218,250,255,.65); font-size: 9px; text-align: center; }
</style>
