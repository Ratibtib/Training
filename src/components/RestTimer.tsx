import { useEffect, useRef, useState } from 'react'

// Chrono de récup — triple signal : son perçant + vibration + flash visuel.
// Bips à 10s puis 5/4/3/2/1s, gros signal à 0.
export function RestTimer({ seconds }: { seconds: number }) {
  const [remaining, setRemaining] = useState(seconds)
  const [running, setRunning] = useState(false)
  const [flash, setFlash] = useState(false)
  const tick = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioCtx = useRef<AudioContext | null>(null)

  useEffect(() => () => { if (tick.current) clearInterval(tick.current) }, [])

  function getCtx(): AudioContext | null {
    try {
      if (!audioCtx.current) {
        const Ctx = window.AudioContext || (window as any).webkitAudioContext
        if (!Ctx) return null
        audioCtx.current = new Ctx()
      }
      if (audioCtx.current.state === 'suspended') audioCtx.current.resume()
      return audioCtx.current
    } catch { return null }
  }

  // bip d'origine (onde sine), volume augmenté
  function beep(freq: number, dur: number, vol = 1) {
    const ctx = getCtx(); if (!ctx) return
    const t = ctx.currentTime
    const o = ctx.createOscillator(); const g = ctx.createGain()
    o.connect(g); g.connect(ctx.destination)
    o.type = 'sine'; o.frequency.value = freq
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.start(t); o.stop(t + dur + 0.02)
  }

  const vibrate = (ms: number | number[]) => { if (navigator.vibrate) navigator.vibrate(ms) }
  const bipCourt = () => { beep(980, 0.12, 1); vibrate(120) }
  const bipFin = () => {
    beep(640, 0.5, 1); vibrate([200, 80, 400])
    setFlash(true); setTimeout(() => setFlash(false), 900)
  }

  function start() {
    getCtx()
    setRemaining(seconds); setRunning(true)
    if (tick.current) clearInterval(tick.current)
    tick.current = setInterval(() => {
      setRemaining(r => {
        const next = r - 1
        if (next === 10) bipCourt()
        else if (next <= 5 && next >= 1) bipCourt()
        else if (next <= 0) {
          if (tick.current) clearInterval(tick.current)
          setRunning(false); bipFin()
          return 0
        }
        return next
      })
    }, 1000)
  }

  function stop() {
    if (tick.current) clearInterval(tick.current)
    setRunning(false); setRemaining(seconds)
  }

  const mm = Math.floor(remaining / 60)
  const ss = String(remaining % 60).padStart(2, '0')
  const done = remaining === 0
  const soon = running && remaining <= 5

  return (
    <div className={'rest' + (running ? ' running' : '') + (done ? ' done' : '') + (soon ? ' soon' : '') + (flash ? ' flash' : '')}
      onClick={running ? stop : start}>
      <span className="rest-clock">{mm}:{ss}</span>
      <span className="rest-lbl">
        {running ? 'Récup en cours — touche pour arrêter'
          : done ? 'Récup terminée — touche pour relancer'
          : `Récup ${mm}:${ss} — touche pour lancer`}
      </span>
      <span className="rest-go">{running ? 'Stop' : 'Start'}</span>
    </div>
  )
}