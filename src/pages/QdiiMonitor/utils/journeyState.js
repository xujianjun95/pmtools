// 「鉴往」旅程播放状态机：显式 reducer，不在 reducer 内创建任何计时器。
// phase: setup | playing | paused | eventIntro | eventImpact | eventOutcome
//        | adjustingAmount | eventReview | completed | error

export const initialJourneyState = {
  phase: 'setup',
  cursor: 0,
  endIndex: 0,
  activeEventId: null,
  impactEndIndex: null,
  returnPhase: null,
  processedEventIds: [],
  error: null,
}

export const createJourneyState = () => ({ ...initialJourneyState, processedEventIds: [] })

const PLAY_PHASES = ['playing', 'eventImpact']
const ADJUSTABLE_PHASES = ['playing', 'paused', 'eventIntro', 'eventImpact', 'eventOutcome']

function canTick(state, nextIndex) {
  return (
    PLAY_PHASES.includes(state.phase)
    && Number.isInteger(nextIndex)
    && nextIndex > state.cursor
    && nextIndex <= state.endIndex
  )
}

export function journeyReducer(state, action) {
  switch (action.type) {
    case 'START':
      return { ...createJourneyState(), phase: 'playing', endIndex: action.endIndex }
    case 'TICK': {
      if (!canTick(state, action.nextIndex)) return state
      const processed = state.activeEventId && action.eventId === state.activeEventId
        ? [...state.processedEventIds, state.activeEventId]
        : state.processedEventIds
      if (action.eventId && state.phase === 'playing' && !processed.includes(action.eventId)) {
        return { ...state, processed, cursor: action.nextIndex, phase: 'eventIntro', activeEventId: action.eventId }
      }
      return { ...state, processed, cursor: action.nextIndex }
    }
    case 'PAUSE':
      return PLAY_PHASES.includes(state.phase)
        ? { ...state, phase: 'paused', returnPhase: state.phase }
        : state
    case 'RESUME':
      return state.phase === 'paused'
        ? { ...state, phase: state.returnPhase ?? 'playing', returnPhase: null }
        : state
    case 'ACK_EVENT_INTRO':
      return state.phase === 'eventIntro'
        ? { ...state, phase: 'eventImpact', impactEndIndex: action.impactEndIndex }
        : state
    case 'REACH_EVENT_END':
      return state.phase === 'eventImpact' ? { ...state, phase: 'eventOutcome' } : state
    case 'ACK_EVENT_OUTCOME': {
      if (state.phase !== 'eventOutcome') return state
      const processedEventIds = state.activeEventId && !state.processedEventIds.includes(state.activeEventId)
        ? [...state.processedEventIds, state.activeEventId]
        : state.processedEventIds
      return {
        ...state,
        phase: state.cursor >= state.endIndex ? 'completed' : 'playing',
        activeEventId: null,
        impactEndIndex: null,
        processedEventIds,
      }
    }
    case 'OPEN_AMOUNT':
      if (!ADJUSTABLE_PHASES.includes(state.phase)) return state
      return { ...state, phase: 'adjustingAmount', returnPhase: state.phase }
    case 'CLOSE_AMOUNT':
      return state.phase === 'adjustingAmount'
        ? { ...state, phase: state.returnPhase ?? 'paused', returnPhase: null }
        : state
    case 'OPEN_EVENT_REVIEW': {
      // 图上事件标点的回顾弹窗：不改变播放进度，关闭后回到原 phase。
      if (state.phase === 'setup' || state.phase === 'error') return state
      return { ...state, phase: 'eventReview', returnPhase: state.phase, activeEventId: action.eventId }
    }
    case 'CLOSE_EVENT_REVIEW':
      if (state.phase !== 'eventReview') return state
      return { ...state, phase: state.returnPhase ?? 'paused', activeEventId: null }
    case 'COMPLETE':
      return { ...state, cursor: state.endIndex, phase: 'completed', activeEventId: null, impactEndIndex: null }
    case 'FAIL':
      return { ...state, phase: 'error', error: action.error }
    case 'RESTART':
      return createJourneyState()
    default:
      return state
  }
}
