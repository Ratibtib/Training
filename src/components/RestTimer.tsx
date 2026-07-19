import { useEffect, useRef, useState } from 'react'

// Chrono de récup au niveau de l'exercice, réutilisable série après série.
// Bips : court à 10s, puis à 5/4/3/2/1s, et un gros bip grave à 0.
export function RestTimer({ seconds }: { seconds: number }) {
  const [remaining, setRemaining] = useState(seconds)
  const [running, setRunning] = useState(false)
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
      // certains navigateurs suspendent le contexte tant qu'on n'a pas interagi
      if (audioCtx.current.state === 'suspended') audioCtx.current.resume()
      return audioCtx.current
    } catch { return null }
  }

  // bip paramétrable : fréquence (grave/aigu), durée, volume
  function beep(freq: number, dur: number, vol = 0.35) {
    const ctx = getCtx(); if (!ctx) return
    const o = ctx.createOscillator(); const g = ctx.createGain()
    o.connect(g); g.connect(ctx.destination)
    o.type = 'sine'; o.frequency.value = freq
    const t = ctx.currentTime
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.start(t); o.stop(t + dur + 0.02)
  }

  const vibrate = (ms: number | number[]) => { if (navigator.vibrate) navigator.vibrate(ms) }
  const bipCourt = () => { beep(880, 0.12, 0.3); vibrate(80) }        // aigu + courte vibration
  const bipFin = () => { beep(440, 0.5, 0.5); vibrate([120, 60, 250]) } // grave, long + vibration marquée

  function start() {
    getCtx() // débloque l'audio sur le tap
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
    <div className={'rest' + (running ? ' running' : '') + (done ? ' done' : '') + (soon ? ' soon' : '')}
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