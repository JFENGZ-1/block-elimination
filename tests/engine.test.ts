import assert from 'node:assert/strict'
import { BOARD_SIZE, RossGame, type BlockPiece, type GameSnapshot } from '../src/game/RossGame'

const game = new RossGame()
let latest: GameSnapshot | null = null
game.onChange = (snapshot) => (latest = snapshot)

game.start()
assert.ok(latest, '开始游戏后应产生快照')
const started = game.snapshot
assert.equal(started.status, 'running')
assert.equal(started.board.length, BOARD_SIZE)
assert.equal(started.candidates.filter(Boolean).length, 3, '每轮应提供三个备选方块')

let placement: { index: number; row: number; column: number; piece: BlockPiece } | null = null
for (let index = 0; index < started.candidates.length && !placement; index += 1) {
  const piece = started.candidates[index]
  if (!piece) continue
  for (let row = 0; row <= BOARD_SIZE - piece.height && !placement; row += 1) {
    for (let column = 0; column <= BOARD_SIZE - piece.width; column += 1) {
      if (game.canPlace(piece, row, column)) {
        placement = { index, row, column, piece }
        break
      }
    }
  }
}

assert.ok(placement, '空棋盘至少应有一个合法落点')
assert.equal(game.place(placement.index, placement.row, placement.column), true)
const placed = game.snapshot
assert.equal(placed.score, placement.piece.cells.length, '落子应按方块数量计基础分')
assert.equal(placed.canUndo, true)
assert.equal(placed.candidates[placement.index], null, '已使用的备选方块应被消费')

game.undo()
const restored = game.snapshot
assert.equal(restored.score, 0, '撤回后分数应恢复')
assert.equal(restored.canUndo, false, '每次落子只允许撤回一次')
assert.equal(restored.candidates.filter(Boolean).length, 3, '撤回后备选方块应恢复')
assert.ok(restored.board.every((row) => row.every((cell) => cell === 0)), '撤回后棋盘应恢复')

console.log('RossGame engine tests passed')

const clearingGame = new RossGame()
clearingGame.start()
const internals = clearingGame as unknown as {
  board: number[][]
  candidates: Array<BlockPiece | null>
}
internals.board[0] = [1, 1, 1, 1, 1, 1, 1, 1, 1, 0]
internals.candidates = [
  { id: 'single-cell', cells: [[0, 0]], color: 2, width: 1, height: 1 },
  null,
  null,
]
assert.equal(clearingGame.place(0, 0, 9), true)
const cleared = clearingGame.snapshot
assert.equal(cleared.lines, 1, '填满一行后应完成一次消除')
assert.equal(cleared.clearEvent?.lineCount, 1, '快照应携带消除行数')
assert.equal(cleared.clearEvent?.cells.length, BOARD_SIZE, '消除事件应包含整行格子供动效使用')
assert.equal(cleared.clearEvent?.bonus, 12, '首次单行消除应产生 12 奖励分')
assert.ok(cleared.board[0].every((cell) => cell === 0), '完成动效事件后棋盘行应被清空')

console.log('RossGame clear feedback tests passed')

function prepareRiskScenario(target: RossGame) {
  target.start()
  const state = target as unknown as {
    board: number[][]
    candidates: Array<BlockPiece | null>
  }
  state.board = Array.from({ length: BOARD_SIZE }, (_, row) =>
    row === 0
      ? [1, 1, 1, 1, 1, 1, 1, 1, 1, 0]
      : Array.from({ length: BOARD_SIZE }, (_, column) =>
          (row + column) % 2 === 0 ? 1 : 0,
        ),
  )
  state.candidates = [
    { id: 'first-single', cells: [[0, 0]], color: 2, width: 1, height: 1 },
    { id: 'blocked-five', cells: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]], color: 3, width: 5, height: 1 },
    { id: 'rescue-single', cells: [[0, 0]], color: 4, width: 1, height: 1 },
  ]
}

const rescuedGame = new RossGame()
prepareRiskScenario(rescuedGame)
assert.equal(rescuedGame.place(0, 1, 0), true)
assert.deepEqual(rescuedGame.snapshot.warning?.blockedIndices, [1], '第一块后应标记暂时放不下的方块')
assert.equal(rescuedGame.snapshot.warning?.stepsLeft, 1, '仅剩一个可用方块时应提示一步破局')
assert.equal(rescuedGame.snapshot.status, 'running', '预警阶段不能立即失败')
assert.equal(rescuedGame.place(2, 0, 9), true)
assert.equal(rescuedGame.snapshot.warning, null, '第二块完成消除破局后应解除预警')
assert.equal(rescuedGame.snapshot.status, 'running', '成功破局后应继续游戏')
assert.equal(rescuedGame.canPlace(rescuedGame.snapshot.candidates[1]!, 0, 0), true, '危险方块应可放进新空行')

const failedBreakoutGame = new RossGame()
prepareRiskScenario(failedBreakoutGame)
assert.equal(failedBreakoutGame.place(0, 1, 0), true)
assert.ok(failedBreakoutGame.snapshot.warning, '第一块后应出现空间预警')
assert.equal(failedBreakoutGame.place(2, 1, 2), true)
assert.equal(failedBreakoutGame.snapshot.status, 'over', '第二块没有破局时应判定失败')

const freshWarningGame = new RossGame()
freshWarningGame.start()
const freshState = freshWarningGame as unknown as {
  board: number[][]
  candidates: Array<BlockPiece | null>
  createCandidateSet: () => BlockPiece[]
}
freshState.board = Array.from({ length: BOARD_SIZE }, (_, row) =>
  Array.from({ length: BOARD_SIZE }, (_, column) => ((row + column) % 2 === 0 ? 1 : 0)),
)
freshState.candidates = [
  null,
  null,
  { id: 'last-old-piece', cells: [[0, 0]], color: 2, width: 1, height: 1 },
]
freshState.createCandidateSet = () => [
  { id: 'fresh-blocked-five', cells: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]], color: 3, width: 5, height: 1 },
  { id: 'fresh-rescue-one', cells: [[0, 0]], color: 4, width: 1, height: 1 },
  { id: 'fresh-rescue-two', cells: [[0, 0]], color: 5, width: 1, height: 1 },
]
assert.equal(freshWarningGame.place(2, 1, 0), true)
assert.deepEqual(freshWarningGame.snapshot.warning?.blockedIndices, [0], '刷新后应立即标记放不下的方块')
assert.equal(freshWarningGame.snapshot.warning?.stepsLeft, 2, '刷新后有两个可用方块时应提示两步破局')
assert.equal(freshWarningGame.place(1, 1, 2), true)
assert.equal(freshWarningGame.snapshot.warning?.stepsLeft, 1, '使用一个可用方块后应倒计为一步破局')
assert.equal(freshWarningGame.place(2, 1, 4), true)
assert.equal(freshWarningGame.snapshot.status, 'over', '两步均未破局时应判定失败')

console.log('RossGame space warning tests passed')
