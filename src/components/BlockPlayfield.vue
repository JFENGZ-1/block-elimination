<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import {
  BLOCK_COLORS,
  BOARD_SIZE,
  type BlockPiece,
  type ClearEvent,
  type GameSnapshot,
  type RossGame,
} from '@/game/RossGame'
import { gameAudio } from '@/services/gameAudio'

const props = defineProps<{ snapshot: GameSnapshot; game: RossGame }>()
const boardRef = ref<HTMLElement | null>(null)
const dragPieceRef = ref<HTMLElement | null>(null)
const selectedIndex = ref<number | null>(null)
const hoverCell = ref<{ row: number; column: number; valid: boolean } | null>(null)
const drag = ref<{
  index: number
  startX: number
  startY: number
  unit: number
  stepX: number
  stepY: number
  originLeft: number
  originTop: number
} | null>(null)
const activeClear = ref<ClearEvent | null>(null)
const breakthrough = ref(false)
let didDrag = false
let clearTimer = 0
let breakthroughTimer = 0
let dragFrame = 0
let pendingPointerX = 0
let pendingPointerY = 0
let dragListenersActive = false

const draggingPiece = computed(() => {
  const index = drag.value?.index
  return index === undefined ? null : props.snapshot.candidates[index]
})

const ghostCells = computed(() => {
  if (!hoverCell.value || !draggingPiece.value) return []
  return draggingPiece.value.cells
    .map(([x, y]) => ({
      row: hoverCell.value!.row + y,
      column: hoverCell.value!.column + x,
      valid: hoverCell.value!.valid,
      color: draggingPiece.value!.color,
    }))
    .filter(({ row, column }) => row >= 0 && row < BOARD_SIZE && column >= 0 && column < BOARD_SIZE)
})

function blockColor(value: number) {
  return value ? BLOCK_COLORS[value - 1] : 'transparent'
}

function pieceStyle(piece: BlockPiece) {
  return { '--piece-width': piece.width, '--piece-height': piece.height }
}

function cellStyle(x: number, y: number, piece: BlockPiece) {
  return {
    left: `${(x / piece.width) * 100}%`,
    top: `${(y / piece.height) * 100}%`,
    width: `${100 / piece.width}%`,
    height: `${100 / piece.height}%`,
    '--block-color': blockColor(piece.color),
  }
}

function addDragListeners() {
  if (dragListenersActive) return
  dragListenersActive = true
  window.addEventListener('pointermove', onPointerMove, { passive: true })
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerCancel)
}

function removeDragListeners() {
  if (!dragListenersActive) return
  dragListenersActive = false
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerCancel)
}

function beginDrag(index: number, event: PointerEvent) {
  if (props.snapshot.status !== 'running' || !props.snapshot.candidates[index]) return
  if (event.currentTarget instanceof HTMLElement) event.currentTarget.setPointerCapture?.(event.pointerId)
  const cells = boardRef.value?.querySelectorAll<HTMLElement>('.board-cell')
  const firstCell = cells?.[0]?.getBoundingClientRect()
  const secondCell = cells?.[1]?.getBoundingClientRect()
  const nextRowCell = cells?.[BOARD_SIZE]?.getBoundingClientRect()
  const fallbackUnit = (boardRef.value?.getBoundingClientRect().width || 360) / BOARD_SIZE
  const stepX = firstCell && secondCell ? secondCell.left - firstCell.left : fallbackUnit
  const stepY = firstCell && nextRowCell ? nextRowCell.top - firstCell.top : fallbackUnit
  selectedIndex.value = index
  drag.value = {
    index,
    startX: event.clientX,
    startY: event.clientY,
    unit: Math.min(stepX, stepY),
    stepX,
    stepY,
    originLeft: firstCell?.left || boardRef.value?.getBoundingClientRect().left || 0,
    originTop: firstCell?.top || boardRef.value?.getBoundingClientRect().top || 0,
  }
  pendingPointerX = event.clientX
  pendingPointerY = event.clientY
  didDrag = false
  addDragListeners()
  updateHover(event.clientX, event.clientY)
  void nextTick(() => positionDragPiece(event.clientX, event.clientY))
}

function updateHover(clientX: number, clientY: number) {
  if (!boardRef.value || !drag.value) return
  const piece = props.snapshot.candidates[drag.value.index]
  if (!piece) return
  const floatingLeft = clientX - (piece.width * drag.value.unit) / 2
  const floatingTop = clientY - 82
  const column = Math.round((floatingLeft - drag.value.originLeft) / drag.value.stepX)
  const row = Math.round((floatingTop - drag.value.originTop) / drag.value.stepY)
  const inside = row + piece.height > 0 && row < BOARD_SIZE && column + piece.width > 0 && column < BOARD_SIZE
  if (!inside) {
    if (hoverCell.value) hoverCell.value = null
    return
  }
  if (hoverCell.value?.row === row && hoverCell.value.column === column) return
  hoverCell.value = { row, column, valid: props.game.canPlace(piece, row, column) }
}

function positionDragPiece(clientX: number, clientY: number) {
  if (!dragPieceRef.value) return
  dragPieceRef.value.style.transform = `translate3d(${clientX}px, ${clientY - 82}px, 0) translateX(-50%)`
  dragPieceRef.value.style.opacity = '1'
}

function onPointerMove(event: PointerEvent) {
  if (!drag.value) return
  const coalesced = event.getCoalescedEvents?.()
  const latest = coalesced?.length ? coalesced[coalesced.length - 1] : event
  pendingPointerX = latest.clientX
  pendingPointerY = latest.clientY
  // 视觉方块直接跟随最新真实触点；棋盘命中计算仍按帧合并，避免 Vue 高频更新。
  positionDragPiece(pendingPointerX, pendingPointerY)
  if (!dragFrame) dragFrame = window.requestAnimationFrame(applyPointerMove)
}

function applyPointerMove() {
  dragFrame = 0
  if (!drag.value) return
  if (Math.abs(pendingPointerX - drag.value.startX) + Math.abs(pendingPointerY - drag.value.startY) > 4) didDrag = true
  updateHover(pendingPointerX, pendingPointerY)
}

function onPointerUp(event: PointerEvent) {
  if (!drag.value) return
  pendingPointerX = event.clientX
  pendingPointerY = event.clientY
  if (dragFrame) window.cancelAnimationFrame(dragFrame)
  applyPointerMove()
  if (hoverCell.value?.valid) {
    if (commitPlacement(drag.value.index, hoverCell.value.row, hoverCell.value.column)) selectedIndex.value = null
  }
  drag.value = null
  hoverCell.value = null
  removeDragListeners()
}

function onPointerCancel() {
  if (dragFrame) window.cancelAnimationFrame(dragFrame)
  dragFrame = 0
  drag.value = null
  hoverCell.value = null
  removeDragListeners()
}

function choosePiece(index: number) {
  if (didDrag || !props.snapshot.candidates[index]) return
  selectedIndex.value = selectedIndex.value === index ? null : index
}

function placeByTap(row: number, column: number) {
  if (selectedIndex.value === null) return
  const piece = props.snapshot.candidates[selectedIndex.value]
  if (!piece) return
  const startRow = row - Math.floor(piece.height / 2)
  const startColumn = column - Math.floor(piece.width / 2)
  if (commitPlacement(selectedIndex.value, startRow, startColumn)) selectedIndex.value = null
}

function commitPlacement(index: number, row: number, column: number) {
  const wasWarning = Boolean(props.snapshot.warning)
  const beforeLines = props.snapshot.lines
  const placed = props.game.place(index, row, column)
  if (!placed) return false
  const result = props.game.snapshot
  gameAudio.playPlace()
  if (result.lines > beforeLines) gameAudio.playClear(result.lines - beforeLines, result.combo)
  if (result.warning) gameAudio.playWarning()
  if (wasWarning && !result.warning && result.status === 'running') {
    window.clearTimeout(breakthroughTimer)
    breakthrough.value = false
    // 破局通常伴随消除，错峰播放可避免 Safari 同一帧合成两套特效。
    const revealDelay = result.lines > beforeLines ? 620 : 0
    breakthroughTimer = window.setTimeout(() => {
      breakthrough.value = true
      breakthroughTimer = window.setTimeout(() => (breakthrough.value = false), 900)
    }, revealDelay)
  }
  return true
}

const effectCenter = computed(() => {
  const cells = activeClear.value?.cells || []
  if (!cells.length) return { x: 50, y: 50 }
  const x = cells.reduce((total, [column]) => total + column + 0.5, 0) / cells.length
  const y = cells.reduce((total, [, row]) => total + row + 0.5, 0) / cells.length
  return { x: x * 10, y: y * 10 }
})

watch(
  () => props.snapshot.clearEvent?.id,
  () => {
    if (!props.snapshot.clearEvent) return
    activeClear.value = props.snapshot.clearEvent
    window.clearTimeout(clearTimer)
    clearTimer = window.setTimeout(() => (activeClear.value = null), 760)
  },
)

onBeforeUnmount(() => {
  removeDragListeners()
  window.cancelAnimationFrame(dragFrame)
  window.clearTimeout(clearTimer)
  window.clearTimeout(breakthroughTimer)
})
</script>

<template>
  <div class="playfield-wrap" :class="{ 'is-dragging': drag }">
    <div
      ref="boardRef"
      class="block-board"
      :class="{ 'rescue-mode': snapshot.warning }"
      role="grid"
      aria-label="10 × 10 坨坨方块棋盘"
    >
      <button
        v-for="(_, index) in BOARD_SIZE * BOARD_SIZE"
        :key="index"
        class="board-cell"
        :class="{
          occupied: snapshot.board[Math.floor(index / BOARD_SIZE)][index % BOARD_SIZE],
        }"
        :style="{ '--block-color': blockColor(snapshot.board[Math.floor(index / BOARD_SIZE)][index % BOARD_SIZE]) }"
        :aria-label="`第 ${Math.floor(index / BOARD_SIZE) + 1} 行，第 ${(index % BOARD_SIZE) + 1} 列`"
        @click="placeByTap(Math.floor(index / BOARD_SIZE), index % BOARD_SIZE)"
      />
      <div v-if="ghostCells.length" class="ghost-layer" aria-hidden="true">
        <i
          v-for="cell in ghostCells"
          :key="`${cell.row}-${cell.column}`"
          class="ghost-cell"
          :class="cell.valid ? 'valid' : 'invalid'"
          :style="{
            gridColumn: cell.column + 1,
            gridRow: cell.row + 1,
            '--block-color': blockColor(cell.color),
          }"
        />
      </div>
      <div v-if="activeClear" class="effect-layer" aria-hidden="true">
        <i
          v-for="([column, row], index) in activeClear.cells"
          :key="`${activeClear.id}-${column}-${row}`"
          class="clear-flash"
          :style="{ gridColumn: column + 1, gridRow: row + 1, '--delay': `${index * 9}ms` }"
        />
        <i
          v-for="index in 18"
          :key="`particle-${activeClear.id}-${index}`"
          class="clear-particle"
          :style="{
            left: `${effectCenter.x}%`,
            top: `${effectCenter.y}%`,
            '--angle': `${index * 20}deg`,
            '--distance': `${44 + (index % 5) * 12}px`,
            '--particle-color': BLOCK_COLORS[index % BLOCK_COLORS.length],
          }"
        />
        <strong class="clear-score">
          +{{ activeClear.bonus }}
          <small v-if="activeClear.combo > 1">COMBO ×{{ activeClear.combo }}</small>
        </strong>
      </div>

      <Transition name="breakthrough">
        <div v-if="breakthrough" class="breakthrough-toast" role="status" aria-live="polite">
          <span>✦</span>
          <b>破局成功</b>
          <small>继续挑战</small>
        </div>
      </Transition>
    </div>

    <div class="candidate-rack" aria-label="待放置方块">
      <button
        v-for="(piece, index) in snapshot.candidates"
        :key="piece?.id || `empty-${index}`"
        class="candidate-slot"
        :class="{
          selected: selectedIndex === index,
          used: !piece,
          'at-risk': snapshot.warning?.blockedIndices.includes(index),
        }"
        :disabled="!piece || snapshot.status !== 'running'"
        @pointerdown.prevent="beginDrag(index, $event)"
        @click="choosePiece(index)"
      >
        <span
          v-if="piece"
          class="piece"
          :class="{ 'long-piece-preview': Math.max(piece.width, piece.height) >= 5 }"
          :style="pieceStyle(piece)"
        >
          <i
            v-for="([x, y], cellIndex) in piece.cells"
            :key="cellIndex"
            class="piece-cell"
            :style="cellStyle(x, y, piece)"
          />
        </span>
        <small v-if="piece && snapshot.warning?.blockedIndices.includes(index)" class="risk-chip">
          待破局
        </small>
      </button>
    </div>

    <div
      v-if="drag && draggingPiece"
      ref="dragPieceRef"
      class="drag-piece piece"
      :style="{
        ...pieceStyle(draggingPiece),
        '--unit': `${drag.unit}px`,
      }"
    >
      <i
        v-for="([x, y], cellIndex) in draggingPiece.cells"
        :key="cellIndex"
        class="piece-cell"
        :style="cellStyle(x, y, draggingPiece)"
      />
    </div>
  </div>
</template>

<style scoped>
.playfield-wrap { --board-gap: clamp(1px, .32vw, 2px); --board-padding: clamp(7px, 1.6vw, 11px); position: relative; }
.block-board { position: relative; display: grid; grid-template-columns: repeat(10, minmax(0, 1fr)); grid-template-rows: repeat(10, minmax(0, 1fr)); gap: var(--board-gap); width: 100%; aspect-ratio: 1; padding: var(--board-padding); overflow: hidden; border: 3px solid #d9953c; border-radius: 14px; background: #173c45; box-shadow: 0 0 0 2px #75461d, 0 0 0 4px #f3c36d, 0 8px 20px rgba(0,32,48,.35), inset 0 0 0 2px rgba(255,232,165,.34), inset 0 0 26px rgba(2,27,39,.42); transition: border-color .18s ease; }
.block-board.rescue-mode { border-color: #ffe46b; box-shadow: 0 0 0 2px #9f5d15, 0 0 0 4px #fff0a4, 0 0 20px rgba(255,184,38,.3), inset 0 0 22px rgba(105,48,0,.13); }
.board-cell { position: relative; align-self: stretch; justify-self: stretch; min-width: 0; min-height: 0; padding: 0; border: 1px solid rgba(131,198,202,.2); border-radius: 1px; appearance: none; -webkit-appearance: none; background: rgba(5,42,50,.78); box-shadow: inset 0 0 5px rgba(0,19,28,.3); cursor: pointer; line-height: 0; transition: transform .12s ease, background .12s ease; }
.board-cell::before { content: ''; position: absolute; inset: 0 0 2px; border: 1px solid rgba(3,16,25,.82); border-radius: 2px; background: conic-gradient(from 45deg at 50% 50%, color-mix(in srgb, var(--block-color) 78%, black) 0 25%, color-mix(in srgb, var(--block-color) 64%, black) 25% 50%, color-mix(in srgb, var(--block-color) 88%, white) 50% 75%, color-mix(in srgb, var(--block-color) 58%, white) 75% 100%); opacity: 0; box-shadow: 0 2px 0 #041922, 0 3px 4px rgba(0,14,23,.42); transform: scale(.9); transition: opacity .15s ease, transform .18s cubic-bezier(.2,.8,.25,1.15), filter .15s ease; }
.board-cell::after { content: ''; position: absolute; z-index: 1; left: 15%; top: 18%; width: 70%; height: 64%; border: 1px solid rgba(255,255,255,.14); border-radius: 1px; background: linear-gradient(145deg, color-mix(in srgb, var(--block-color) 90%, white) 0%, var(--block-color) 52%, color-mix(in srgb, var(--block-color) 92%, black) 100%); box-shadow: inset 2px 2px 3px rgba(255,255,255,.18), inset -2px -2px 3px rgba(0,15,25,.16); opacity: 0; pointer-events: none; transform: scale(.76); transition: opacity .15s ease, transform .18s ease; }
.board-cell.occupied::before { opacity: 1; filter: saturate(1.2) brightness(1.06); transform: scale(1); }
.board-cell.occupied::after { opacity: 1; transform: scale(1); }
.ghost-layer { position: absolute; z-index: 2; inset: 0; display: grid; grid-template-columns: repeat(10, minmax(0, 1fr)); grid-template-rows: repeat(10, minmax(0, 1fr)); gap: var(--board-gap); padding: var(--board-padding); contain: layout paint style; pointer-events: none; }
.ghost-cell { position: relative; min-width: 0; min-height: 0; border-radius: 2px; }
.ghost-cell.valid { border: 1px solid rgba(3,16,25,.7); background: conic-gradient(from 45deg at 50% 50%, color-mix(in srgb, var(--block-color) 78%, black) 0 25%, color-mix(in srgb, var(--block-color) 64%, black) 25% 50%, color-mix(in srgb, var(--block-color) 88%, white) 50% 75%, color-mix(in srgb, var(--block-color) 58%, white) 75% 100%); box-shadow: 0 2px 0 rgba(4,25,34,.8), 0 0 9px rgba(94,231,226,.3); opacity: .58; }
.ghost-cell.valid::after { content: ''; position: absolute; inset: 17% 14% 20%; border: 1px solid rgba(255,255,255,.16); border-radius: 1px; background: linear-gradient(145deg, color-mix(in srgb, var(--block-color) 90%, white), var(--block-color) 52%, color-mix(in srgb, var(--block-color) 92%, black)); opacity: .65; }
.ghost-cell.invalid { border: 1px solid rgba(255,162,171,.65); background: rgba(255,74,92,.42); box-shadow: inset 0 0 10px rgba(255,72,91,.38); }
.candidate-rack { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; min-height: 120px; margin-top: 14px; }
.candidate-slot { position: relative; display: grid; place-items: center; min-width: 0; min-height: 112px; padding: 10px; overflow: hidden; color: var(--muted); border: 1px solid rgba(161,242,255,.28); border-radius: 18px; background: linear-gradient(180deg, rgba(4,83,113,.68), rgba(4,49,77,.58)); box-shadow: inset 0 1px rgba(255,255,255,.12), 0 9px 24px rgba(0,44,70,.2); cursor: grab; touch-action: none; transition: transform .18s ease, border-color .18s ease, opacity .18s ease; }
.candidate-slot:hover:not(:disabled), .candidate-slot.selected { border-color: rgba(94,231,226,.35); background: rgba(94,231,226,.06); transform: translateY(-2px); }
.candidate-slot:active { cursor: grabbing; }
.candidate-slot.used { opacity: .35; }
.candidate-slot.at-risk { border-color: rgba(255,210,74,.92); background: radial-gradient(circle at 50% 38%, rgba(255,189,47,.2), transparent 48%), linear-gradient(180deg, rgba(132,77,13,.68), rgba(65,37,16,.62)); box-shadow: inset 0 1px rgba(255,255,255,.2), 0 0 0 3px rgba(255,181,38,.13), 0 0 18px rgba(255,155,24,.24); }
.candidate-slot.at-risk::before { content: ''; position: absolute; inset: 0; pointer-events: none; background: linear-gradient(125deg, transparent 25%, rgba(255,225,111,.12) 50%, transparent 75%); }
.risk-chip { position: absolute; z-index: 2; right: 7px; bottom: 7px; padding: 3px 7px; color: #6e3500; border: 1px solid rgba(255,255,255,.45); border-radius: 10px; background: linear-gradient(#fff08a,#ffb51f); box-shadow: 0 3px 8px rgba(75,30,0,.3); font-size: 8px; font-weight: 900; letter-spacing: .06em; }
.piece { --unit: min(24px, 6vw); position: relative; display: block; width: calc(var(--piece-width) * var(--unit)); height: calc(var(--piece-height) * var(--unit)); }
.candidate-slot .long-piece-preview { --unit: min(20px, 4.2vw); }
.piece-cell { position: absolute; display: block; padding: 1px; }
.piece-cell::after { content: ''; position: absolute; z-index: 1; inset: 0 1px 2px; border: 1px solid rgba(3,16,25,.82); border-radius: 2px; background: conic-gradient(from 45deg at 50% 50%, color-mix(in srgb, var(--block-color) 78%, black) 0 25%, color-mix(in srgb, var(--block-color) 64%, black) 25% 50%, color-mix(in srgb, var(--block-color) 88%, white) 50% 75%, color-mix(in srgb, var(--block-color) 58%, white) 75% 100%); box-shadow: 0 2px 0 #041922, 0 3px 4px rgba(0,14,23,.4); filter: saturate(1.14) brightness(1.06); }
.piece-cell::before { content: ''; position: absolute; z-index: 2; left: 15%; top: 18%; width: 70%; height: 64%; border: 1px solid rgba(255,255,255,.14); border-radius: 1px; background: linear-gradient(145deg, color-mix(in srgb, var(--block-color) 90%, white) 0%, var(--block-color) 52%, color-mix(in srgb, var(--block-color) 92%, black) 100%); box-shadow: inset 2px 2px 3px rgba(255,255,255,.18), inset -2px -2px 3px rgba(0,15,25,.16); pointer-events: none; }
.drag-piece { position: fixed; z-index: 100; left: 0; top: 0; opacity: 0; pointer-events: none; contain: layout paint style; filter: drop-shadow(0 18px 20px rgba(0,0,0,.35)); transform: translate3d(-9999px,-9999px,0); transform-origin: center; will-change: transform; }
.playfield-wrap.is-dragging .board-cell,
.playfield-wrap.is-dragging .board-cell::before,
.playfield-wrap.is-dragging .board-cell::after,
.playfield-wrap.is-dragging .candidate-slot { transition: none; }
.playfield-wrap.is-dragging .block-board.rescue-mode,
.playfield-wrap.is-dragging .candidate-slot.at-risk,
.playfield-wrap.is-dragging .candidate-slot.at-risk::before { animation-play-state: paused; }
.playfield-wrap.is-dragging .block-board.rescue-mode { filter: none; }
.effect-layer { position: absolute; z-index: 5; inset: 0; display: grid; grid-template-columns: repeat(10, minmax(0, 1fr)); grid-template-rows: repeat(10, minmax(0, 1fr)); gap: var(--board-gap); padding: var(--board-padding); pointer-events: none; }
.clear-flash { border-radius: 12%; background: white; box-shadow: 0 0 15px white, 0 0 30px #8ff9ff; animation: clear-flash .62s cubic-bezier(.18,.75,.25,1) var(--delay) both; }
.clear-particle { position: absolute; width: 7px; height: 7px; border-radius: 2px; background: var(--particle-color); box-shadow: 0 0 8px var(--particle-color); animation: particle-burst .68s ease-out both; transform: translate(-50%,-50%) rotate(var(--angle)) translateX(var(--distance)); }
.clear-score { position: absolute; z-index: 3; left: 50%; top: 50%; display: grid; justify-items: center; color: #fff5a8; font-family: var(--display); font-size: clamp(22px,7vw,38px); text-shadow: 0 3px #e57800, 0 0 18px rgba(255,242,117,.75); animation: score-pop .72s cubic-bezier(.16,.84,.28,1) both; transform: translate(-50%,-50%); }
.clear-score small { color: white; font-family: var(--mono); font-size: 9px; letter-spacing: .1em; text-shadow: 0 2px 7px rgba(0,54,86,.7); }
.breakthrough-toast { position: absolute; z-index: 9; left: 50%; top: 50%; display: grid; justify-items: center; gap: 1px; min-width: 142px; padding: 15px 22px; contain: layout paint; color: white; border: 1px solid rgba(183,255,196,.74); border-radius: 20px; background: linear-gradient(145deg, rgba(18,180,122,.95), rgba(3,105,94,.95)); box-shadow: 0 12px 24px rgba(0,49,49,.3), inset 0 1px rgba(255,255,255,.28); pointer-events: none; transform: translate3d(-50%,-50%,0); will-change: transform, opacity; }
.breakthrough-toast span { color: #fff48b; font-size: 23px; text-shadow: 0 0 12px rgba(255,242,102,.8); }
.breakthrough-toast b { font-family: var(--display); font-size: 17px; }
.breakthrough-toast small { color: rgba(225,255,242,.75); font-size: 8px; letter-spacing: .12em; }
.breakthrough-enter-active { animation: breakthrough-pop .38s cubic-bezier(.2,.9,.25,1.2); }
.breakthrough-leave-active { transition: .28s ease; }
.breakthrough-leave-to { opacity: 0; transform: translate(-50%,-65%) scale(.9); }

@keyframes clear-flash { 0% { opacity: 0; transform: scale(.55) rotate(-8deg); } 22% { opacity: 1; transform: scale(1.12) rotate(2deg); } 100% { opacity: 0; transform: scale(.2) rotate(18deg); } }
@keyframes particle-burst { 0% { opacity: 1; transform: translate(-50%,-50%) rotate(var(--angle)) translateX(8px) scale(1.2); } 100% { opacity: 0; transform: translate(-50%,-50%) rotate(var(--angle)) translateX(var(--distance)) scale(.25); } }
@keyframes score-pop { 0% { opacity: 0; transform: translate(-50%,-35%) scale(.55); } 28% { opacity: 1; transform: translate(-50%,-58%) scale(1.14); } 100% { opacity: 0; transform: translate(-50%,-105%) scale(.92); } }
@keyframes breakthrough-pop { 0% { opacity: 0; transform: translate(-50%,-42%) scale(.55); } 70% { opacity: 1; transform: translate(-50%,-52%) scale(1.08); } 100% { transform: translate(-50%,-50%) scale(1); } }

@media (min-width: 701px) and (max-width: 1180px) {
  .candidate-rack { min-height: 132px; gap: 12px; }
  .candidate-slot { min-height: 124px; }
}

@media (any-pointer: coarse) and (min-width: 701px) and (max-width: 1400px) {
  .candidate-rack { min-height: 100px; margin-top: 8px; gap: 9px; }
  .candidate-slot { min-height: 94px; padding: 7px; }
  .candidate-slot .piece { --unit: min(20px, 2.2vh); }
  .candidate-slot .long-piece-preview { --unit: min(16px, 1.8vh); }
}

@media (max-width: 700px) {
  .candidate-rack { min-height: 100px; }
  .candidate-slot { min-height: 94px; padding: 7px; }
  .piece { --unit: min(22px, 5.8vw); }
}

@media (any-pointer: coarse) and (max-width: 700px) {
  .candidate-rack { min-height: 92px; margin-top: 8px; gap: 8px; }
  .candidate-slot { min-height: 86px; padding: 6px; }
  .candidate-slot .piece { --unit: min(19px, 5vw, 2.3vh); }
  .candidate-slot .long-piece-preview { --unit: min(15px, 4vw, 1.8vh); }
}

@media (any-pointer: coarse) {
  .board-cell.occupied::before, .piece-cell::after { filter: none; }
  .drag-piece { filter: none; }
  .clear-flash { box-shadow: 0 0 7px rgba(255,255,255,.8); }
  .clear-particle { box-shadow: none; }
  .breakthrough-toast span { text-shadow: none; }
}
</style>
