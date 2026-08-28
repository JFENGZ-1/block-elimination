const SOUND_KEY = 'ross-blocks:sound:v1'

class GameAudio {
  private context: AudioContext | null = null
  private enabledValue = localStorage.getItem(SOUND_KEY) !== 'off'

  get enabled() {
    return this.enabledValue
  }

  setEnabled(enabled: boolean) {
    this.enabledValue = enabled
    localStorage.setItem(SOUND_KEY, enabled ? 'on' : 'off')
    if (enabled) this.playUi()
  }

  playUi() {
    this.tone(480, 0.045, 'sine', 0.035, 0)
  }

  playPlace() {
    // 清脆起音 + 快速下坠的果冻“扣入”感，在手机扬声器上也能听清。
    this.sweep(720, 360, 0.045, 'triangle', 0.045, 0)
    this.sweep(410, 145, 0.095, 'sine', 0.09, 0.008)
  }

  playClear(lines: number, combo: number) {
    const now = 0
    const root = Math.min(760, 480 + combo * 45)
    ;[1, 1.25, 1.5].forEach((ratio, index) => {
      this.tone(root * ratio, 0.16, 'sine', 0.05, now + index * 0.045)
    })
    if (lines > 1) this.tone(root * 2, 0.22, 'triangle', 0.055, 0.13)
  }

  playWarning() {
    this.tone(260, 0.11, 'square', 0.025, 0)
    this.tone(220, 0.15, 'square', 0.025, 0.12)
  }

  playGameOver() {
    ;[330, 260, 190].forEach((frequency, index) => {
      this.tone(frequency, 0.18, 'triangle', 0.04, index * 0.12)
    })
  }

  private getContext() {
    if (!this.context) this.context = new AudioContext()
    if (this.context.state === 'suspended') void this.context.resume()
    return this.context
  }

  private tone(frequency: number, duration: number, type: OscillatorType, volume: number, delay: number) {
    if (!this.enabledValue) return
    const context = this.getContext()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    const startsAt = context.currentTime + delay
    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, startsAt)
    gain.gain.setValueAtTime(0.0001, startsAt)
    gain.gain.exponentialRampToValueAtTime(volume, startsAt + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, startsAt + duration)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start(startsAt)
    oscillator.stop(startsAt + duration + 0.02)
  }

  private sweep(
    startFrequency: number,
    endFrequency: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    delay: number,
  ) {
    if (!this.enabledValue) return
    const context = this.getContext()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    const startsAt = context.currentTime + delay
    const endsAt = startsAt + duration

    oscillator.type = type
    oscillator.frequency.setValueAtTime(startFrequency, startsAt)
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, endsAt)
    gain.gain.setValueAtTime(0.0001, startsAt)
    gain.gain.exponentialRampToValueAtTime(volume, startsAt + 0.006)
    gain.gain.exponentialRampToValueAtTime(0.0001, endsAt)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start(startsAt)
    oscillator.stop(endsAt + 0.02)
  }
}

export const gameAudio = new GameAudio()
