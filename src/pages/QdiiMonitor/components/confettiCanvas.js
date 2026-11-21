const COLORS = ['#d9b26f', '#b88a4a', '#7a5c3a', '#c0392b', '#f0e0bf', '#e8c98c']
const PARTICLES_PER_BURST = 90
const MAX_PARTICLES = 700
const SECOND_BURST_MS = 180
const FRAME_MS = 1000 / 60

export function confettiAim(x, y) {
  const dx = window.innerWidth * 0.5 - x
  const dy = window.innerHeight * 0.42 - y
  return { angle: Math.atan2(dy, dx), distance: Math.hypot(dx, dy) }
}

function makeParticle(x, y, angle, distance) {
  const direction = angle + (Math.random() * 2 - 1) * 0.55
  const speed = distance / 26 * (0.55 + Math.random() * 0.7)
  return {
    x,
    y,
    vx: Math.cos(direction) * speed,
    vy: Math.sin(direction) * speed,
    angle: Math.random() * Math.PI * 2,
    spin: (Math.random() * 2 - 1) * 0.18,
    width: 5 + Math.random() * 6,
    height: 3 + Math.random() * 4,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    round: Math.random() < 0.3,
    life: 1,
  }
}

export function createConfettiCanvas(canvas) {
  let context = null
  let frame = null
  let previousTime = null
  let elapsed = 0
  let width = 0
  let height = 0
  let ratio = 1
  const particles = []
  const timers = new Set()

  function resize() {
    if (!context) return
    width = window.innerWidth
    height = window.innerHeight
    ratio = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(width * ratio)
    canvas.height = Math.round(height * ratio)
  }

  function simulate() {
    for (let index = particles.length - 1; index >= 0; index--) {
      const particle = particles[index]
      particle.x += particle.vx
      particle.y += particle.vy
      particle.vx *= 0.985
      particle.vy = (particle.vy + 0.28) * 0.985
      particle.angle += particle.spin
      particle.life -= 0.007
      if (
        particle.life <= 0 ||
        particle.x < -12 || particle.x > width + 12 ||
        particle.y < -12 || particle.y > height + 12
      ) {
        particles[index] = particles.at(-1)
        particles.pop()
      }
    }
  }

  function draw(time) {
    if (previousTime !== null) elapsed += Math.min(time - previousTime, 50)
    previousTime = time
    while (elapsed >= FRAME_MS) {
      simulate()
      elapsed -= FRAME_MS
    }

    context.resetTransform()
    context.clearRect(0, 0, canvas.width, canvas.height)
    for (const particle of particles) {
      context.globalAlpha = particle.life
      context.fillStyle = particle.color
      context.setTransform(ratio, 0, 0, ratio, particle.x * ratio, particle.y * ratio)
      if (particle.round) {
        context.beginPath()
        context.arc(0, 0, particle.height / 2, 0, Math.PI * 2)
        context.fill()
      } else {
        context.rotate(particle.angle)
        context.fillRect(-particle.width / 2, -particle.height / 2, particle.width, particle.height)
      }
    }

    frame = particles.length ? requestAnimationFrame(draw) : null
    if (frame === null) {
      previousTime = null
      elapsed = 0
    }
  }

  function burst(x, y) {
    if (!context) {
      context = canvas.getContext('2d')
      if (!context) return
      resize()
    }

    const { angle, distance } = confettiAim(x, y)
    const count = Math.min(PARTICLES_PER_BURST, MAX_PARTICLES - particles.length)
    for (let index = 0; index < count; index++) {
      particles.push(makeParticle(x, y, angle, distance))
    }
    if (frame === null) frame = requestAnimationFrame(draw)
  }

  window.addEventListener('resize', resize)
  return {
    fire(x, y) {
      burst(x, y)
      const timer = window.setTimeout(() => {
        timers.delete(timer)
        burst(x, y)
      }, SECOND_BURST_MS)
      timers.add(timer)
    },
    dispose() {
      window.removeEventListener('resize', resize)
      if (frame !== null) cancelAnimationFrame(frame)
      timers.forEach((timer) => window.clearTimeout(timer))
      if (context) {
        context.resetTransform()
        context.clearRect(0, 0, canvas.width, canvas.height)
      }
    },
  }
}
