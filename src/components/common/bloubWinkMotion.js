// Relevant idle -> wink engine code from jeremy-prt/bloub (MIT), commit b4bb3c1.
export const RADIUS = 100
export const HALF_VIEWBOX = 158
export const MORPH_DURATION = 0.3
const EYE_SPLIT_IDLE = 15.46
const EYE_SPLIT_WINK = 16.25
const IDLE_GAZE = { yaw: 28.49, pitch: 28.62, roll: -13 }
const WINK_GAZE = { yaw: -5.37, pitch: 4.55, roll: 6.7 }
const IDLE_EYES = [
  { w: 0.186, h: 0.412 },
  { w: 0.186, h: 0.412 },
]
const WINK_EYES = [
  { w: 0.236, h: 0.464 },
  { w: 0.447, h: 0.089 },
]

const clamp = (value, min = 0, max = 1) =>
  value < min ? min : value > max ? max : value
const lerp = (from, to, progress) => from + (to - from) * progress
const easeOutQuint = (value) => 1 - (1 - value) ** 5
export const round = (value) => Math.round(value * 100) / 100

function createRng(seed) {
  let value = seed >>> 0
  return () => {
    value = (value + 0x6d2b79f5) >>> 0
    let result = Math.imul(value ^ (value >>> 15), 1 | value)
    result = (result + Math.imul(result ^ (result >>> 7), 61 | result)) ^ result
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296
  }
}

const blinkRng = createRng(0x5eed)
const BLINKS = (() => {
  const schedule = []
  let time = 1.4
  while (time < 900) {
    schedule.push(time)
    time += 1.9 + blinkRng() * 2.7
    if (blinkRng() < 0.18) {
      schedule.push(time)
      time += 0.24
    }
  }
  return schedule
})()

function loopNoise(time, period, seed = 0) {
  const phase = (time / period) * Math.PI * 2
  return (
    0.55 * Math.sin(phase + seed) +
    0.3 * Math.sin(2 * phase + seed * 1.7 + 1.1) +
    0.15 * Math.sin(3 * phase + seed * 2.3 + 2.4)
  )
}

function blinkLid(time) {
  for (const start of BLINKS) {
    if (time < start) break
    const progress = (time - start) / 0.18
    if (progress >= 0 && progress <= 1) {
      return progress < 0.45
        ? 1 - progress / 0.45
        : (progress - 0.45) / 0.55
    }
  }
  return 1
}

function spin(first, second, angle) {
  const cosine = Math.cos(angle)
  const sine = Math.sin(angle)
  return [
    first.map((value, index) => value * cosine + second[index] * sine),
    second.map((value, index) => value * cosine - first[index] * sine),
  ]
}

function eyePoses(gaze, scale, split) {
  const radians = (degrees) => (degrees * Math.PI) / 180
  let forward = [0, 0, 1]
  let right = [1, 0, 0]
  let down = [0, 1, 0]
  ;[forward, right] = spin(forward, right, radians(gaze.yaw))
  ;[down, forward] = spin(down, forward, radians(gaze.pitch))
  ;[right, down] = spin(right, down, radians(gaze.roll))

  return [-1, 1].map((side) => {
    const [eyeForward, eyeRight] = spin(forward, right, radians(split * side))
    return {
      x: eyeForward[0] * scale,
      y: eyeForward[1] * scale,
      a: eyeRight[0],
      b: eyeRight[1],
      c: down[0],
      d: down[1],
      depth: eyeForward[2],
    }
  })
}

function capsulePath(width, height) {
  const halfWidth = width / 2
  const halfHeight = height / 2
  const radius = Math.min(halfWidth, halfHeight)
  return (
    `M${round(-halfWidth)} ${round(-halfHeight + radius)}` +
    `A${round(radius)} ${round(radius)} 0 0 1 ${round(-halfWidth + radius)} ${round(-halfHeight)}` +
    `L${round(halfWidth - radius)} ${round(-halfHeight)}` +
    `A${round(radius)} ${round(radius)} 0 0 1 ${round(halfWidth)} ${round(-halfHeight + radius)}` +
    `L${round(halfWidth)} ${round(halfHeight - radius)}` +
    `A${round(radius)} ${round(radius)} 0 0 1 ${round(halfWidth - radius)} ${round(halfHeight)}` +
    `L${round(-halfWidth + radius)} ${round(halfHeight)}` +
    `A${round(radius)} ${round(radius)} 0 0 1 ${round(-halfWidth)} ${round(halfHeight - radius)}Z`
  )
}

export function sampleWink(time) {
  const progress = easeOutQuint(clamp(time / MORPH_DURATION))
  const gaze = {
    yaw:
      lerp(IDLE_GAZE.yaw, WINK_GAZE.yaw, progress) +
      loopNoise(time, 11.3, 0.4) * 5.5 +
      loopNoise(time, 3.7, 2.1) * 1.6,
    pitch:
      lerp(IDLE_GAZE.pitch, WINK_GAZE.pitch, progress) +
      loopNoise(time, 9.1, 1.3) * 4.2 +
      loopNoise(time, 4.3, 0.7) * 1.3,
    roll: lerp(IDLE_GAZE.roll, WINK_GAZE.roll, progress) + loopNoise(time, 13.7, 3.2) * 2.2,
  }
  const split = lerp(EYE_SPLIT_IDLE, EYE_SPLIT_WINK, progress)
  const forced = clamp(time / 0.2)
  const forcedLid = forced < 1 ? Math.abs(forced * 2 - 1) : 1
  const lid = Math.min(blinkLid(time), forcedLid)
  const blinkScale = 0.06 + 0.94 * lid
  const eyes = eyePoses(gaze, RADIUS, split).map((pose, index) => {
    const start = IDLE_EYES[index]
    const target = WINK_EYES[index]
    const width = lerp(start.w, target.w, progress) * RADIUS
    const height = lerp(start.h, target.h, progress) * RADIUS
    return {
      path: capsulePath(width, height),
      transform: `matrix(${round(pose.a)},${round(pose.b * blinkScale)},${round(pose.c)},${round(pose.d * blinkScale)},${round(pose.x)},${round(pose.y)})`,
      opacity: clamp(pose.depth / 0.12),
    }
  })
  return {
    eyes,
    driftX: loopNoise(time, 7.9, 1.9) * 0.6,
    driftY: loopNoise(time, 5.3, 0.3) * 0.7,
    breath: 1 + Math.sin((time / 3.4) * Math.PI * 2) * 0.005,
  }
}
