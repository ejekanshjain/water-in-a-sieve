/** Who rings you while you carry water, in turn. */
export type Caller = 'interviewer' | 'mum' | 'scam' | 'water'

export const CALLER_ORDER: readonly Caller[] = [
  'interviewer',
  'mum',
  'scam',
  'water'
]

/** How each caller shows on the screen. */
export const CALLER_NAME: Record<Caller, string> = {
  interviewer: 'Interviewer',
  mum: 'Mum',
  scam: 'Unknown',
  water: 'Water Co.'
}

/** Each caller's opening line, shown while the phone rings. */
export const RING_LINES: Record<Caller, string> = {
  interviewer: 'Quick one about tomorrow…',
  mum: 'Are you drinking enough water?',
  scam: 'Congratulations! You won a cruise!',
  water: 'About your supply…'
}

/** What they say once you answer. The interviewer asks a question instead. */
export const TALK_LINES: Record<Exclude<Caller, 'interviewer'>, string> = {
  mum: "I've sent you 20 coins. Buy a snack.",
  scam: 'Press 1 to claim your cruise.',
  water: 'Soon.'
}

/** An interview question with two answers: E picks the first, F the second. */
export interface InterviewQuestion {
  question: string
  e: string
  f: string
}

const FIRST_QUESTION: InterviewQuestion = {
  question: 'What is your greatest strength?',
  e: 'Steady Hands',
  f: 'Carrying Things'
}

export const INTERVIEW: readonly InterviewQuestion[] = [
  FIRST_QUESTION,
  {
    question: 'Where do you see yourself in five years?',
    e: 'At a Well',
    f: 'In a Bath'
  },
  {
    question: 'Why should we hire you?',
    e: "I Don't Spill",
    f: 'I Own a Sieve'
  },
  { question: 'What is your greatest weakness?', e: 'Flies', f: 'Sneezing' }
]

/** Calls you've had: whose turn it is, who calls back, and your interview answer. */
export interface CallLog {
  /** Index into CALLER_ORDER for the next new call. */
  next: number
  /** A caller who rings again on the next carry: Mum after you decline, the scam twice. */
  callback: Caller | null
  /** The scam already rang once in a row. */
  scamAgain: boolean
  /** Interviewer calls so far, which picks the next question. */
  questions: number
  /** Your latest interview answer, for the ending. */
  answer: string | null
}

export function createCallLog(): CallLog {
  return {
    next: 0,
    callback: null,
    scamAgain: false,
    questions: 0,
    answer: null
  }
}

/** The caller for a new call: a callback if one is waiting, otherwise the next in turn. */
export function nextCaller(log: CallLog): Caller {
  if (log.callback) {
    const caller = log.callback
    log.callback = null
    return caller
  }
  const caller = CALLER_ORDER[log.next % CALLER_ORDER.length] ?? 'mum'
  log.next++
  return caller
}

/** The question the interviewer asks on call number `count` (0-based). */
export function interviewQuestion(count: number): InterviewQuestion {
  return INTERVIEW[count % INTERVIEW.length] ?? FIRST_QUESTION
}
