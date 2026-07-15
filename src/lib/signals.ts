export type SignalCategory = 'world' | 'action'

// World Signals: intelligence pulled from outside the company (reports, research).
// Actions: evidence of what Chiru actually did (check-ins, tasks, notes, chats).
export const SIGNAL_TYPE_CATEGORY: Record<string, SignalCategory> = {
  report_insight: 'world',
  report_strategic: 'world',
  report_generated: 'world',
  research_done: 'world',
  manual_checkin: 'action',
  task_created: 'action',
  task_completed: 'action',
  note_created: 'action',
  chat_insight: 'action',
  person_added: 'action',
  meeting_added: 'action',
  goal_progress_updated: 'action',
}

export function categoryForType(type: string): SignalCategory {
  return SIGNAL_TYPE_CATEGORY[type] ?? 'action'
}
