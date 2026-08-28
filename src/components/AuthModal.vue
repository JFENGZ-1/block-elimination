<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAccountStore } from '@/stores/account'

const emit = defineEmits<{ close: [] }>()
const account = useAccountStore()
const mode = ref<'login' | 'register'>('login')
const username = ref('')
const password = ref('')
const confirmPassword = ref('')
const error = ref('')
const loading = ref(false)

const title = computed(() => (mode.value === 'login' ? '欢迎回来' : '创建玩家档案'))

function switchMode(next: 'login' | 'register') {
  mode.value = next
  error.value = ''
}

async function submit() {
  error.value = ''
  const name = username.value.trim()
  if (name.length < 2 || name.length > 12) {
    error.value = '昵称需要 2–12 个字符'
    return
  }
  if (password.value.length < 8) {
    error.value = '密码至少需要 8 位'
    return
  }
  if (mode.value === 'register' && password.value !== confirmPassword.value) {
    error.value = '两次输入的密码不一致'
    return
  }
  loading.value = true
  try {
    if (mode.value === 'login') await account.login(name, password.value)
    else await account.register(name, password.value)
    emit('close')
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '操作失败，请稍后重试'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="modal-backdrop" role="presentation" @click.self="emit('close')">
    <section class="auth-modal" role="dialog" aria-modal="true" :aria-label="title">
      <button class="close-button" aria-label="关闭" @click="emit('close')">×</button>
      <div class="auth-mark">R</div>
      <p class="eyebrow">PLAYER ACCESS</p>
      <h2>{{ title }}</h2>
      <p class="auth-subtitle">
        {{ mode === 'login' ? '登录后保存最高分，并加入好友榜。' : '一个昵称，一段新的方块旅程。' }}
      </p>

      <div class="auth-tabs">
        <button :class="{ active: mode === 'login' }" @click="switchMode('login')">登录</button>
        <button :class="{ active: mode === 'register' }" @click="switchMode('register')">注册</button>
      </div>

      <form class="auth-form" @submit.prevent="submit">
        <label>
          <span>玩家昵称</span>
          <input v-model="username" autocomplete="username" maxlength="12" placeholder="输入 2–12 个字符" />
        </label>
        <label>
          <span>密码</span>
          <input
            v-model="password"
            type="password"
            :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
            placeholder="至少 8 位"
          />
        </label>
        <label v-if="mode === 'register'">
          <span>确认密码</span>
          <input v-model="confirmPassword" type="password" autocomplete="new-password" placeholder="再输入一次" />
        </label>
        <p v-if="error" class="form-error">{{ error }}</p>
        <button class="primary-button submit-button" type="submit" :disabled="loading">
          {{ loading ? '请稍候…' : mode === 'login' ? '进入游戏' : '创建并进入' }}
        </button>
      </form>
      <p class="privacy-note">账号与成绩将安全保存到游戏服务器，用于跨设备登录和全服排名。</p>
    </section>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  z-index: 50;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 22px;
  background: rgba(1, 39, 63, 0.72);
  backdrop-filter: blur(18px);
}

.auth-modal {
  position: relative;
  width: min(100%, 430px);
  padding: 34px;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,.12);
  border-radius: 28px;
  background: linear-gradient(160deg, rgba(22, 156, 187, .98), rgba(4, 69, 101, .98));
  box-shadow: 0 30px 90px rgba(0,42,67,.48), inset 0 1px rgba(255,255,255,.24);
}

.auth-modal::before {
  content: '';
  position: absolute;
  width: 190px;
  height: 190px;
  right: -90px;
  top: -80px;
  border-radius: 50%;
  background: rgba(104, 239, 255, .24);
  filter: blur(4px);
}

.close-button {
  position: absolute;
  z-index: 2;
  top: 16px;
  right: 18px;
  width: 36px;
  height: 36px;
  color: var(--muted);
  border: 0;
  border-radius: 50%;
  background: rgba(3,72,103,.34);
  font-size: 23px;
  cursor: pointer;
}

.auth-mark {
  display: grid;
  place-items: center;
  width: 50px;
  height: 50px;
  margin-bottom: 20px;
  color: #734100;
  border-radius: 15px;
  background: linear-gradient(#ffe259,#ff9e18);
  font-family: var(--display);
  font-size: 28px;
  font-weight: 900;
  transform: rotate(-4deg);
}

.eyebrow { margin: 0 0 6px; color: var(--aqua); font-size: 10px; font-weight: 800; letter-spacing: .2em; }
h2 { margin: 0; font-family: var(--display); font-size: clamp(28px, 8vw, 40px); line-height: 1.1; }
.auth-subtitle { margin: 10px 0 22px; color: var(--muted); font-size: 14px; }

.auth-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  padding: 4px;
  border-radius: 13px;
  background: rgba(255,255,255,.05);
}

.auth-tabs button {
  padding: 10px;
  color: var(--muted);
  border: 0;
  border-radius: 10px;
  background: transparent;
  font-weight: 700;
  cursor: pointer;
}

.auth-tabs button.active { color: var(--text); background: rgba(255,255,255,.18); box-shadow: 0 5px 15px rgba(0,54,79,.16); }
.auth-form { display: grid; gap: 14px; margin-top: 20px; }
.auth-form label { display: grid; gap: 7px; }
.auth-form label span { color: #b8bfce; font-size: 12px; font-weight: 700; }
.auth-form input { width: 100%; padding: 13px 14px; color: var(--text); border: 1px solid rgba(188,247,255,.34); border-radius: 12px; outline: none; background: rgba(2,54,84,.48); font: inherit; }
.auth-form input:focus { border-color: var(--aqua); box-shadow: 0 0 0 3px rgba(94,231,226,.1); }
.form-error { margin: -3px 0 0; color: #ff8994; font-size: 12px; }
.submit-button { width: 100%; margin-top: 4px; }
.privacy-note { margin: 18px 0 0; color: #687186; font-size: 10px; text-align: center; }

@media (max-width: 480px) {
  .auth-modal { padding: 28px 22px 24px; border-radius: 22px; }
}
</style>
