import test from 'node:test'
import assert from 'node:assert/strict'
import { createJourneyState, journeyReducer } from '../src/pages/QdiiMonitor/utils/journeyState.js'

test('tick pauses at an event intro exactly once', () => {
  let state = createJourneyState()
  state = journeyReducer(state, { type: 'START', endIndex: 10 })
  state = journeyReducer(state, { type: 'TICK', nextIndex: 3, eventId: 'covid' })
  assert.equal(state.phase, 'eventIntro')
  assert.equal(state.activeEventId, 'covid')
  assert.equal(state.cursor, 3)
})

test('event intro continues through impact and ends at outcome', () => {
  const intro = { ...createJourneyState(), phase: 'eventIntro', cursor: 3, activeEventId: 'covid', endIndex: 10 }
  const impact = journeyReducer(intro, { type: 'ACK_EVENT_INTRO', impactEndIndex: 5 })
  assert.equal(impact.phase, 'eventImpact')
  const outcome = journeyReducer(impact, { type: 'REACH_EVENT_END' })
  assert.equal(outcome.phase, 'eventOutcome')
})

test('amount dialog closes back to the phase that opened it', () => {
  const playing = { ...createJourneyState(), phase: 'playing', cursor: 4, endIndex: 10 }
  const adjusting = journeyReducer(playing, { type: 'OPEN_AMOUNT' })
  assert.equal(adjusting.returnPhase, 'playing')
  assert.equal(journeyReducer(adjusting, { type: 'CLOSE_AMOUNT' }).phase, 'playing')
})

test('pausing an event impact resumes the same phase', () => {
  const impact = { ...createJourneyState(), phase: 'eventImpact', cursor: 4, impactEndIndex: 6 }
  const paused = journeyReducer(impact, { type: 'PAUSE' })
  assert.equal(paused.returnPhase, 'eventImpact')
  assert.equal(paused.cursor, 4)
  const resumed = journeyReducer(paused, { type: 'RESUME' })
  assert.equal(resumed.phase, 'eventImpact')
  assert.equal(resumed.cursor, 4)
  assert.equal(resumed.returnPhase, null)
})

test('acknowledging the outcome completes only at the journey end', () => {
  let state = createJourneyState()
  state = journeyReducer(state, { type: 'START', endIndex: 10 })
  state = journeyReducer(state, { type: 'TICK', nextIndex: 3, eventId: 'covid' })
  state = journeyReducer(state, { type: 'ACK_EVENT_INTRO', impactEndIndex: 5 })
  state = journeyReducer(state, { type: 'REACH_EVENT_END' })
  state = journeyReducer(state, { type: 'ACK_EVENT_OUTCOME' })
  assert.equal(state.phase, 'playing')
  assert.deepEqual(state.processedEventIds, ['covid'])
  state = journeyReducer(state, { type: 'COMPLETE' })
  assert.equal(state.phase, 'completed')
  assert.equal(state.cursor, 10)
})

test('processed events do not trigger the intro again', () => {
  let state = createJourneyState()
  state = journeyReducer(state, { type: 'START', endIndex: 10 })
  state = journeyReducer(state, { type: 'TICK', nextIndex: 3, eventId: 'covid' })
  state = journeyReducer(state, { type: 'ACK_EVENT_INTRO', impactEndIndex: 5 })
  state = journeyReducer(state, { type: 'REACH_EVENT_END' })
  state = journeyReducer(state, { type: 'ACK_EVENT_OUTCOME' })
  const again = journeyReducer(state, { type: 'TICK', nextIndex: 6, eventId: 'covid' })
  assert.equal(again.phase, 'playing')
  assert.equal(again.cursor, 6)
  assert.equal(again.activeEventId, null)
})

test('jump to next event stops before the event and does not mark it processed', () => {
  let state = createJourneyState()
  state = journeyReducer(state, { type: 'START', endIndex: 10 })
  state = journeyReducer(state, { type: 'JUMP_TO_NEXT_EVENT', targetIndex: 3 })
  assert.equal(state.cursor, 3)
  assert.equal(state.phase, 'playing')
  assert.deepEqual(state.processedEventIds, [])
  const intro = journeyReducer(state, { type: 'TICK', nextIndex: 4, eventId: 'covid' })
  assert.equal(intro.phase, 'eventIntro')
  assert.equal(intro.activeEventId, 'covid')
})

test('restart clears amount dialog, events and playback state', () => {
  let state = createJourneyState()
  state = journeyReducer(state, { type: 'START', endIndex: 10 })
  state = journeyReducer(state, { type: 'TICK', nextIndex: 3, eventId: 'covid' })
  state = journeyReducer(state, { type: 'ACK_EVENT_INTRO', impactEndIndex: 5 })
  state = journeyReducer(state, { type: 'REACH_EVENT_END' })
  state = journeyReducer(state, { type: 'OPEN_AMOUNT' })
  const reset = journeyReducer(state, { type: 'RESTART' })
  assert.equal(reset.phase, 'setup')
  assert.equal(reset.cursor, 0)
  assert.equal(reset.endIndex, 0)
  assert.equal(reset.activeEventId, null)
  assert.equal(reset.impactEndIndex, null)
  assert.equal(reset.returnPhase, null)
  assert.deepEqual(reset.processedEventIds, [])
})
