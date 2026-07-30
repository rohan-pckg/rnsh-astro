const STORAGE_KEY = "rnsh-sound-muted"
const DEFAULT_VOLUME = 0.12

type SoundName = "navigate" | "open" | "back" | "clear" | "tool-switch"

class SoundManager {
  private ctx: AudioContext | null = null
  private volume: number = DEFAULT_VOLUME
  private _muted: boolean = false
  private initialized: boolean = false

  get muted(): boolean {
    return this._muted
  }

  init() {
    if (this.initialized) return
    this._muted = localStorage.getItem(STORAGE_KEY) === "true"
    this.initialized = true
  }

  private getContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext()
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume()
    }
    return this.ctx
  }

  private gain(amount: number = 1) {
    const ctx = this.getContext()
    const g = ctx.createGain()
    g.gain.value = this._muted ? 0 : this.volume * amount
    g.connect(ctx.destination)
    return g
  }

  mute() {
    this._muted = true
    localStorage.setItem(STORAGE_KEY, "true")
  }

  unmute() {
    this._muted = false
    localStorage.setItem(STORAGE_KEY, "false")
  }

  toggleMute() {
    if (this._muted) {
      this.unmute()
    } else {
      this.mute()
    }
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v))
  }

  play(name: SoundName) {
    this.init()
    if (this._muted) return

    switch (name) {
      case "navigate":
        return this.playNavigate()
      case "open":
        return this.playOpen()
      case "back":
        return this.playBack()
      case "clear":
        return this.playClear()
      case "tool-switch":
        return this.playToolSwitch()
    }
  }

  private noise(duration: number, highpass: number = 1000) {
    const ctx = this.getContext()
    const sr = ctx.sampleRate
    const length = Math.floor(sr * duration)
    const buf = ctx.createBuffer(1, length, sr)
    const data = buf.getChannelData(0)
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1
    }
    const source = ctx.createBufferSource()
    source.buffer = buf

    const hp = ctx.createBiquadFilter()
    hp.type = "highpass"
    hp.frequency.value = highpass

    source.connect(hp)
    return { source, node: hp }
  }

  private envelope(g: GainNode, duration: number, attack: number = 0.002) {
    const now = this.getContext().currentTime
    g.gain.setValueAtTime(0, now)
    g.gain.linearRampToValueAtTime(1, now + attack)
    g.gain.exponentialRampToValueAtTime(0.001, now + duration)
    g.gain.setValueAtTime(0, now + duration + 0.01)
  }

  private tone(
    freq: number,
    duration: number,
    type: OscillatorType = "sine",
    volume: number = 1
  ) {
    const ctx = this.getContext()
    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.value = freq
    const g = this.gain(volume)
    osc.connect(g)
    this.envelope(g, duration)
    return osc
  }

  private playNavigate() {
    const osc = this.tone(800, 0.05, "sine", 0.7)
    osc.start()
    osc.stop(this.getContext().currentTime + 0.06)
  }

  private playOpen() {
    const ctx = this.getContext()
    const osc = ctx.createOscillator()
    osc.type = "sine"
    osc.frequency.setValueAtTime(600, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.08)
    const g = this.gain(0.8)
    osc.connect(g)
    this.envelope(g, 0.1, 0.003)
    osc.start()
    osc.stop(ctx.currentTime + 0.12)
  }

  private playBack() {
    const ctx = this.getContext()
    const osc = ctx.createOscillator()
    osc.type = "sine"
    osc.frequency.setValueAtTime(500, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(700, ctx.currentTime + 0.06)
    const g = this.gain(0.6)
    osc.connect(g)
    this.envelope(g, 0.08, 0.003)
    osc.start()
    osc.stop(ctx.currentTime + 0.1)
  }

  private playClear() {
    const ctx = this.getContext()
    const { source, node } = this.noise(0.12, 800)
    const g = ctx.createGain()
    node.connect(g)
    g.connect(ctx.destination)
    g.gain.value = this._muted ? 0 : this.volume * 0.6
    this.envelope(g, 0.12, 0.005)
    source.start()
    source.stop(ctx.currentTime + 0.15)
  }

  private playToolSwitch() {
    const osc = this.tone(1000, 0.04, "sine", 0.5)
    osc.start()
    osc.stop(this.getContext().currentTime + 0.05)
  }
}

export const sound = new SoundManager()
