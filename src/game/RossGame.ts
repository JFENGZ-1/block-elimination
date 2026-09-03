export const BOARD_SIZE = 10

export type Point = readonly [number, number]
export type GameStatus = 'idle' | 'running' | 'over'

export interface BlockPiece {
  id: string
  cells: Point[]
  color: number
  width: number
  height: number
}

export interface GameSnapshot {
  board: number[][]
  candidates: Array<BlockPiece | null>
  score: number
  lines: number
  combo: number
  status: GameStatus
  canUndo: boolean
  clearEvent: ClearEvent | null
  warning: SpaceWarning | null
}

export interface SpaceWarning {
  blockedIndices: number[]
  stepsLeft: number
  message: string
}

export interface ClearEvent {
  id: number
  cells: Point[]
  lineCount: number
  combo: number
  bonus: number
}

interface HistoryState {
  board: number[][]
  candidates: Array<BlockPiece | null>
  score: number
  lines: number
  combo: number
  placementsInBatch: number
}

export interface RossGameSave {
  version: 1
  savedAt: number
  status: 'running'
  board: number[][]
  candidates: Array<BlockPiece | null>
  score: number
  lines: number
  combo: number
  placementsInBatch: number
  history: HistoryState | null
}

export const BLOCK_COLORS = [
  '#00DFFF',
  '#FFD000',
  '#B827FF',
  '#56E51C',
  '#FF3045',
  '#1E7BFF',
  '#FF7614',
]

const SHAPES: Point[][] = [
  [[0, 0]],
  [[0, 0], [1, 0]],
  [[0, 0], [0, 1]],
  [[0, 0], [1, 0], [2, 0]],
  [[0, 0], [0, 1], [0, 2]],
  [[0, 0], [1, 0], [2, 0], [3, 0]],
  [[0, 0], [0, 1], [0, 2], [0, 3]],
  [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]],
  [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]],
  [[0, 0], [1, 0], [0, 1], [1, 1]],
  [[0, 0], [1, 0], [2, 0], [0, 1]],
  [[0, 0], [1, 0], [2, 0], [2, 1]],
  [[0, 0], [0, 1], [0, 2], [1, 2]],
  [[1, 0], [1, 1], [0, 2], [1, 2]],
  [[0, 0], [1, 0], [1, 1]],
  [[1, 0], [0, 1], [1, 1]],
  [[0, 0], [0, 1], [1, 1]],
  [[0, 0], [1, 0], [0, 1]],
  [[0, 0], [1, 0], [2, 0], [1, 1]],
  [[1, 0], [0, 1], [1, 1], [2, 1]],
  [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]],
  [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]],
  [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]],
]

const emptyBoard = () => Array.from({ length: BOARD_SIZE }, () => Array<number>(BOARD_SIZE).fill(0))

function clonePiece(piece: BlockPiece | null): BlockPiece | null {
  return piece ? { ...piece, cells: [...piece.cells] } : null
}

function makePiece(cells: Point[], color: number): BlockPiece {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    cells,
    color,
    width: Math.max(...cells.map(([x]) => x)) + 1,
    height: Math.max(...cells.map(([, y]) => y)) + 1,
  }
}

function isSafeCounter(value: unknown) {
  return Number.isSafeInteger(value) && Number(value) >= 0
}

function isBoard(value: unknown): value is number[][] {
  return Array.isArray(value) && value.length === BOARD_SIZE && value.every((row) =>
    Array.isArray(row) && row.length === BOARD_SIZE && row.every((cell) =>
      Number.isInteger(cell) && cell >= 0 && cell <= BLOCK_COLORS.length,
    ),
  )
}

function isPiece(value: unknown): value is BlockPiece {
  if (!value || typeof value !== 'object') return false
  const piece = value as Partial<BlockPiece>
  if (
    typeof piece.id !== 'string' || piece.id.length > 100 ||
    !Number.isInteger(piece.color) || Number(piece.color) < 1 || Number(piece.color) > BLOCK_COLORS.length ||
    !Number.isInteger(piece.width) || Number(piece.width) < 1 || Number(piece.width) > BOARD_SIZE ||
    !Number.isInteger(piece.height) || Number(piece.height) < 1 || Number(piece.height) > BOARD_SIZE ||
    !Array.isArray(piece.cells) || piece.cells.length < 1 || piece.cells.length > BOARD_SIZE * BOARD_SIZE
  ) return false

  const cells = piece.cells as unknown[]
  if (!cells.every((cell) =>
    Array.isArray(cell) && cell.length === 2 &&
    Number.isInteger(cell[0]) && cell[0] >= 0 && cell[0] < Number(piece.width) &&
    Number.isInteger(cell[1]) && cell[1] >= 0 && cell[1] < Number(piece.height),
  )) return false

  const uniqueCells = new Set(cells.map((cell) => `${(cell as number[])[0]}-${(cell as number[])[1]}`))
  return uniqueCells.size === cells.length
}

function isCandidateSet(value: unknown): value is Array<BlockPiece | null> {
  return Array.isArray(value) && value.length === 3 && value.every((piece) => piece === null || isPiece(piece))
}

function isHistory(value: unknown): value is HistoryState {
  if (!value || typeof value !== 'object') return false
  const history = value as Partial<HistoryState>
  return isBoard(history.board) && isCandidateSet(history.candidates) &&
    isSafeCounter(history.score) && isSafeCounter(history.lines) && isSafeCounter(history.combo) &&
    isSafeCounter(history.placementsInBatch) && Number(history.placementsInBatch) <= 3
}

function isRossGameSave(value: unknown): value is RossGameSave {
  if (!value || typeof value !== 'object') return false
  const save = value as Partial<RossGameSave>
  return save.version === 1 && save.status === 'running' && isSafeCounter(save.savedAt) &&
    isBoard(save.board) && isCandidateSet(save.candidates) && save.candidates.some(Boolean) &&
    isSafeCounter(save.score) && isSafeCounter(save.lines) && isSafeCounter(save.combo) &&
    isSafeCounter(save.placementsInBatch) && Number(save.placementsInBatch) <= 3 &&
    (save.history === null || isHistory(save.history))
}

function canPlaceOnBoard(piece: BlockPiece, row: number, column: number, board: number[][]) {
  return piece.cells.every(([x, y]) => {
    const targetRow = row + y
    const targetColumn = column + x
    return targetRow >= 0 && targetRow < BOARD_SIZE &&
      targetColumn >= 0 && targetColumn < BOARD_SIZE &&
      board[targetRow][targetColumn] === 0
  })
}

function canFitOnBoard(piece: BlockPiece, board: number[][]) {
  for (let row = 0; row <= BOARD_SIZE - piece.height; row += 1) {
    for (let column = 0; column <= BOARD_SIZE - piece.width; column += 1) {
      if (canPlaceOnBoard(piece, row, column, board)) return true
    }
  }
  return false
}

function boardAfterPlacement(piece: BlockPiece, row: number, column: number, board: number[][]) {
  const nextBoard = board.map((line) => [...line])
  for (const [x, y] of piece.cells) nextBoard[row + y][column + x] = piece.color

  const completedRows = Array.from({ length: BOARD_SIZE }, (_, index) => index).filter((index) =>
    nextBoard[index].every(Boolean),
  )
  const completedColumns = Array.from({ length: BOARD_SIZE }, (_, columnIndex) => columnIndex).filter(
    (columnIndex) => nextBoard.every((line) => Boolean(line[columnIndex])),
  )
  for (const rowIndex of completedRows) nextBoard[rowIndex].fill(0)
  for (const columnIndex of completedColumns) {
    for (let rowIndex = 0; rowIndex < BOARD_SIZE; rowIndex += 1) nextBoard[rowIndex][columnIndex] = 0
  }
  return nextBoard
}

function hasCompletionSequence(candidates: BlockPiece[], board: number[][]) {
  let visitedStates = 0
  const memo = new Map<string, boolean>()

  function search(remaining: BlockPiece[], currentBoard: number[][]): boolean {
    if (remaining.length === 0) return true
    // 三块搜索通常几十步即可完成；上限用于保护低性能手机免受极端组合拖累。
    if (++visitedStates > 20_000) return false

    const pieceKey = remaining
      .map((piece) => `${piece.width}x${piece.height}:${piece.cells.map(([x, y]) => `${x},${y}`).join(';')}`)
      .sort()
      .join('|')
    const stateKey = `${currentBoard.map((line) => line.map((cell) => Number(Boolean(cell))).join('')).join('')}/${pieceKey}`
    const cached = memo.get(stateKey)
    if (cached !== undefined) return cached

    const choices = remaining.map((piece, index) => {
      const placements: Array<readonly [number, number]> = []
      for (let row = 0; row <= BOARD_SIZE - piece.height; row += 1) {
        for (let column = 0; column <= BOARD_SIZE - piece.width; column += 1) {
          if (canPlaceOnBoard(piece, row, column, currentBoard)) placements.push([row, column])
        }
      }
      return { index, piece, placements }
    }).filter((choice) => choice.placements.length > 0)
      .sort((left, right) => left.placements.length - right.placements.length)

    for (const choice of choices) {
      const nextRemaining = remaining.filter((_, index) => index !== choice.index)
      for (const [row, column] of choice.placements) {
        const nextBoard = boardAfterPlacement(choice.piece, row, column, currentBoard)
        if (search(nextRemaining, nextBoard)) {
          memo.set(stateKey, true)
          return true
        }
      }
    }
    memo.set(stateKey, false)
    return false
  }

  return search(candidates, board)
}

export class RossGame {
  private board = emptyBoard()
  private candidates: Array<BlockPiece | null> = []
  private scoreValue = 0
  private linesValue = 0
  private comboValue = 0
  private statusValue: GameStatus = 'idle'
  private history: HistoryState | null = null
  private clearEventValue: ClearEvent | null = null
  private warningValue: SpaceWarning | null = null
  private placementsInBatch = 0
  private eventSequence = 0

  onChange?: (snapshot: GameSnapshot) => void
  onGameOver?: (snapshot: GameSnapshot) => void

  get snapshot(): GameSnapshot {
    return {
      board: this.board.map((row) => [...row]),
      candidates: this.candidates.map(clonePiece),
      score: this.scoreValue,
      lines: this.linesValue,
      combo: this.comboValue,
      status: this.statusValue,
      canUndo: Boolean(this.history),
      clearEvent: this.clearEventValue
        ? { ...this.clearEventValue, cells: [...this.clearEventValue.cells] }
        : null,
      warning: this.warningValue ? { ...this.warningValue, blockedIndices: [...this.warningValue.blockedIndices] } : null,
    }
  }

  exportState(): RossGameSave | null {
    if (this.statusValue !== 'running') return null
    return {
      version: 1,
      savedAt: Date.now(),
      status: 'running',
      board: this.board.map((row) => [...row]),
      candidates: this.candidates.map(clonePiece),
      score: this.scoreValue,
      lines: this.linesValue,
      combo: this.comboValue,
      placementsInBatch: this.placementsInBatch,
      history: this.history
        ? {
            ...this.history,
            board: this.history.board.map((row) => [...row]),
            candidates: this.history.candidates.map(clonePiece),
          }
        : null,
    }
  }

  restore(rawSave: unknown) {
    if (!isRossGameSave(rawSave)) return false
    const hasPlayableCandidate = rawSave.candidates.some((piece) => Boolean(piece && canFitOnBoard(piece, rawSave.board)))
    const isFreshBatch = rawSave.placementsInBatch === 0 && rawSave.candidates.every(Boolean)
    const isUnsafeFreshBatch = isFreshBatch && !hasCompletionSequence(rawSave.candidates as BlockPiece[], rawSave.board)
    if (!hasPlayableCandidate && !isFreshBatch) return false

    this.board = rawSave.board.map((row) => [...row])
    this.candidates = rawSave.candidates.map(clonePiece)
    this.scoreValue = rawSave.score
    this.linesValue = rawSave.lines
    this.comboValue = rawSave.combo
    this.placementsInBatch = rawSave.placementsInBatch
    this.history = rawSave.history
      ? {
          ...rawSave.history,
          board: rawSave.history.board.map((row) => [...row]),
          candidates: rawSave.history.candidates.map(clonePiece),
        }
      : null
    this.statusValue = 'running'
    this.clearEventValue = null
    this.warningValue = null
    this.eventSequence = 0

    // 兼容旧版本可能保存下来的“有一步可走、但整组实际无法破局”状态。
    if (isUnsafeFreshBatch) this.candidates = this.createPlayableCandidateSet()

    this.updateSpaceWarning()
    this.emit()
    return true
  }

  start(initialScore = 0, randomizeBoard = false) {
    this.board = randomizeBoard ? this.createRandomOpeningBoard() : emptyBoard()
    this.scoreValue = Number.isSafeInteger(initialScore) && initialScore >= 0 ? initialScore : 0
    this.linesValue = 0
    this.comboValue = 0
    this.history = null
    this.clearEventValue = null
    this.warningValue = null
    this.placementsInBatch = 0
    this.statusValue = 'running'
    this.candidates = this.createPlayableCandidateSet()
    this.updateSpaceWarning()
    this.emit()
  }

  canPlace(piece: BlockPiece, row: number, column: number) {
    return piece.cells.every(([x, y]) => {
      const targetRow = row + y
      const targetColumn = column + x
      return (
        targetRow >= 0 &&
        targetRow < BOARD_SIZE &&
        targetColumn >= 0 &&
        targetColumn < BOARD_SIZE &&
        this.board[targetRow][targetColumn] === 0
      )
    })
  }

  place(candidateIndex: number, row: number, column: number) {
    if (this.statusValue !== 'running') return false
    const piece = this.candidates[candidateIndex]
    if (!piece || !this.canPlace(piece, row, column)) return false

    this.history = {
      board: this.board.map((line) => [...line]),
      candidates: this.candidates.map(clonePiece),
      score: this.scoreValue,
      lines: this.linesValue,
      combo: this.comboValue,
      placementsInBatch: this.placementsInBatch,
    }

    for (const [x, y] of piece.cells) this.board[row + y][column + x] = piece.color
    this.scoreValue += piece.cells.length
    this.candidates[candidateIndex] = null
    this.placementsInBatch += 1

    const completedRows = Array.from({ length: BOARD_SIZE }, (_, index) => index).filter((index) =>
      this.board[index].every(Boolean),
    )
    const completedColumns = Array.from({ length: BOARD_SIZE }, (_, columnIndex) => columnIndex).filter(
      (columnIndex) => this.board.every((line) => Boolean(line[columnIndex])),
    )
    const cleared = completedRows.length + completedColumns.length

    if (cleared > 0) {
      this.comboValue += 1
      const bonus = cleared * 12 * this.comboValue
      this.scoreValue += bonus
      this.linesValue += cleared
      const clearedCells = new Map<string, Point>()
      for (const rowIndex of completedRows) {
        for (let columnIndex = 0; columnIndex < BOARD_SIZE; columnIndex += 1) {
          clearedCells.set(`${columnIndex}-${rowIndex}`, [columnIndex, rowIndex])
        }
      }
      for (const columnIndex of completedColumns) {
        for (let rowIndex = 0; rowIndex < BOARD_SIZE; rowIndex += 1) {
          clearedCells.set(`${columnIndex}-${rowIndex}`, [columnIndex, rowIndex])
        }
      }
      this.clearEventValue = {
        id: ++this.eventSequence,
        cells: [...clearedCells.values()],
        lineCount: cleared,
        combo: this.comboValue,
        bonus,
      }
      for (const rowIndex of completedRows) this.board[rowIndex].fill(0)
      for (const columnIndex of completedColumns) {
        for (let rowIndex = 0; rowIndex < BOARD_SIZE; rowIndex += 1) this.board[rowIndex][columnIndex] = 0
      }
    } else {
      this.comboValue = 0
      this.clearEventValue = null
    }

    if (this.candidates.every((candidate) => candidate === null)) {
      this.candidates = this.createPlayableCandidateSet()
      this.placementsInBatch = 0
    }
    this.updateSpaceWarning()
    this.checkGameOver()
    this.emit()
    return true
  }

  undo() {
    if (!this.history || this.statusValue !== 'running') return
    this.board = this.history.board.map((line) => [...line])
    this.candidates = this.history.candidates.map(clonePiece)
    this.scoreValue = this.history.score
    this.linesValue = this.history.lines
    this.comboValue = this.history.combo
    this.placementsInBatch = this.history.placementsInBatch
    this.history = null
    this.clearEventValue = null
    this.updateSpaceWarning()
    this.emit()
  }

  private createCandidateSet() {
    return Array.from({ length: 3 }, () => {
      const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)]
      const color = Math.floor(Math.random() * BLOCK_COLORS.length) + 1
      return makePiece(shape, color)
    })
  }

  private createPlayableCandidateSet() {
    let candidates = this.createCandidateSet()
    for (
      let attempt = 0;
      attempt < 16 && !hasCompletionSequence(candidates, this.board);
      attempt += 1
    ) {
      candidates = this.createCandidateSet()
    }

    if (hasCompletionSequence(candidates, this.board)) return candidates

    // 极端棋盘下使用三个单格块兜底；稳定棋盘至少有 10 个空格，因此可保证完整走完。
    return Array.from({ length: 3 }, () =>
      makePiece([[0, 0]], Math.floor(Math.random() * BLOCK_COLORS.length) + 1),
    )
  }

  private createRandomOpeningBoard() {
    const board = emptyBoard()
    const positions = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => index)
    for (let index = positions.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1))
      ;[positions[index], positions[swapIndex]] = [positions[swapIndex], positions[index]]
    }

    const occupiedCount = 18 + Math.floor(Math.random() * 9)
    for (const position of positions.slice(0, occupiedCount)) {
      const row = Math.floor(position / BOARD_SIZE)
      const column = position % BOARD_SIZE
      board[row][column] = Math.floor(Math.random() * BLOCK_COLORS.length) + 1
    }

    for (let row = 0; row < BOARD_SIZE; row += 1) {
      if (board[row].every(Boolean)) board[row][Math.floor(Math.random() * BOARD_SIZE)] = 0
    }
    for (let column = 0; column < BOARD_SIZE; column += 1) {
      if (board.every((row) => Boolean(row[column]))) board[Math.floor(Math.random() * BOARD_SIZE)][column] = 0
    }
    return board
  }

  private checkGameOver() {
    const isFreshBatch = this.placementsInBatch === 0 && this.candidates.every(Boolean)
    // 新批次不仅要“眼下有一块能放”，还必须存在把三块完整走完的顺序。
    if (isFreshBatch && !hasCompletionSequence(this.candidates as BlockPiece[], this.board)) {
      this.candidates = this.createPlayableCandidateSet()
      this.updateSpaceWarning()
    }
    const playable = this.candidates.some((piece) => Boolean(piece && this.canFitAnywhere(piece)))
    if (!playable) {
      this.warningValue = null
      this.statusValue = 'over'
      const result = this.snapshot
      this.onChange?.(result)
      this.onGameOver?.(result)
    }
  }

  private updateSpaceWarning() {
    const blockedIndices = this.candidates.flatMap((piece, index) =>
      piece && !this.canFitAnywhere(piece) ? [index] : [],
    )
    const playablePieces = this.candidates.filter((piece) => Boolean(piece && this.canFitAnywhere(piece)))
    this.warningValue = blockedIndices.length > 0 && playablePieces.length > 0
      ? {
          blockedIndices,
          stepsLeft: playablePieces.length,
          message: `${blockedIndices.length} 个方块暂时放不下，还有 ${playablePieces.length} 次破局机会`,
        }
      : null
  }

  private canFitAnywhere(piece: BlockPiece) {
    for (let row = 0; row <= BOARD_SIZE - piece.height; row += 1) {
      for (let column = 0; column <= BOARD_SIZE - piece.width; column += 1) {
        if (this.canPlace(piece, row, column)) return true
      }
    }
    return false
  }

  private emit() {
    this.onChange?.(this.snapshot)
  }
}
