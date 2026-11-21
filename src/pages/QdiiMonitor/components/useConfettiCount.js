import { useEffect, useRef, useState } from 'react'

const ENDPOINT = '/api/confetti'
const BATCH_SIZE = 20
const IDLE_MS = 800
const TIMEOUT_MS = 3000

async function requestTotal(count) {
  const signal = AbortSignal.timeout(TIMEOUT_MS)
  const options = count === undefined
    ? { signal }
    : {
        signal,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ n: count }),
        keepalive: true,
      }
  const response = await fetch(ENDPOINT, options)
  if (!response.ok) throw new Error('Confetti count unavailable')
  const { total } = await response.json()
  if (!Number.isSafeInteger(total) || total < 0) throw new Error('Invalid confetti count')
  return total
}

export function useConfettiCount() {
  const [total, setTotal] = useState(null)
  const recordRef = useRef(null)

  useEffect(() => {
    let active = true
    let confirmed = null
    let pending = 0
    let inFlight = 0
    let submitted = false
    let idleTimer = null

    function publish() {
      if (active) setTotal(confirmed === null ? null : confirmed + inFlight + pending)
    }

    async function flush() {
      if (!active || inFlight || idleTimer !== null || !pending) return

      submitted = true
      inFlight = Math.min(pending, BATCH_SIZE)
      pending -= inFlight
      try {
        confirmed = await requestTotal(inFlight)
      } catch {
        // The server may have counted the batch before the response was lost.
        confirmed = null
      } finally {
        inFlight = 0
        publish()
        void flush()
      }
    }

    function clearIdleTimer() {
      window.clearTimeout(idleTimer)
      idleTimer = null
    }

    function flushOnExit() {
      clearIdleTimer()
      while (pending > 0) {
        const count = Math.min(pending, BATCH_SIZE)
        pending -= count
        const body = new Blob([JSON.stringify({ n: count })], { type: 'application/json' })
        if (!navigator.sendBeacon?.(ENDPOINT, body)) void requestTotal(count).catch(() => {})
      }
    }

    recordRef.current = () => {
      pending++
      publish()
      clearIdleTimer()
      idleTimer = window.setTimeout(() => {
        idleTimer = null
        void flush()
      }, IDLE_MS)
    }

    queueMicrotask(async () => {
      if (!active) return
      try {
        const initialTotal = await requestTotal()
        if (!submitted) confirmed = initialTotal
      } catch {
        // Hide the total until a POST can supply an authoritative value.
      } finally {
        if (!submitted) publish()
      }
    })

    window.addEventListener('pagehide', flushOnExit)
    return () => {
      active = false
      recordRef.current = null
      window.removeEventListener('pagehide', flushOnExit)
      flushOnExit()
    }
  }, [])

  return [total, () => recordRef.current?.()]
}
