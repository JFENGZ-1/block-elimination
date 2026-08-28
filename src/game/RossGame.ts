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
  warning: SpaceWarning | null
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

  start() {
    this.board = emptyBoard()
    this.scoreValue = 0
    this.linesValue = 0
    this.comboValue = 0
    this.history = null
    this.clearEventValue = null
    this.warningValue = null
    this.placementsInBatch = 0
    this.statusValue = 'running'
    this.candidates = this.createCandidateSet()
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
      warning: this.warningValue
        ? { ...this.warningValue, blockedIndices: [...this.warningValue.blockedIndices] }
        : null,
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
      this.candidates = this.createCandidateSet()
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
    this.warningValue = this.history.warning
      ? { ...this.history.warning, blockedIndices: [...this.history.warning.blockedIndices] }
      : null
    this.history = null
    this.clearEventValue = null
    this.emit()
  }

  private createCandidateSet() {
    return Array.from({ length: 3 }, () => {
      const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)]
      const color = Math.floor(Math.random() * BLOCK_COLORS.length) + 1
      return makePiece(shape, color)
    })
  }

  private checkGameOver() {
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
