// Web Audio API notification sound + vibration

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext()
  }
  return audioCtx
}

export function playNotificationSound(type: 'info' | 'warning' | 'critical' = 'info') {
  try {
    const ctx = getAudioContext()

    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()
    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)

    switch (type) {
      case 'critical':
        oscillator.frequency.value = 880
        gainNode.gain.value = 0.3
        oscillator.type = 'square'
        break
      case 'warning':
        oscillator.frequency.value = 660
        gainNode.gain.value = 0.2
        oscillator.type = 'sine'
        break
      default:
        oscillator.frequency.value = 523
        gainNode.gain.value = 0.15
        oscillator.type = 'sine'
    }

    oscillator.start()
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)
    oscillator.stop(ctx.currentTime + 0.5)

    // Double beep for critical
    if (type === 'critical') {
      const osc2 = ctx.createOscillator()
      const gain2 = ctx.createGain()
      osc2.connect(gain2)
      gain2.connect(ctx.destination)
      osc2.frequency.value = 880
      osc2.type = 'square'
      gain2.gain.value = 0.3
      osc2.start(ctx.currentTime + 0.3)
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8)
      osc2.stop(ctx.currentTime + 0.8)
    }
  } catch (e) {
    console.warn('Audio playback failed:', e)
  }
}

export function vibrate(pattern: number | number[] = 200) {
  try {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern)
    }
  } catch {
    // Vibration not supported
  }
}

export function notifyWithFeedback(severity: 'info' | 'warning' | 'critical') {
  playNotificationSound(severity)
  if (severity === 'critical') {
    vibrate([200, 100, 200, 100, 200])
  } else if (severity === 'warning') {
    vibrate([200, 100, 200])
  } else {
    vibrate(200)
  }
}
