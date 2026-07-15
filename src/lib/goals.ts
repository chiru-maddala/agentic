export type PacingStatus = 'no-target' | 'no-progress' | 'ahead' | 'on-pace' | 'behind' | 'overdue'

export function computeGoalPacing(goal: {
  target_number: number | null
  target_date: string | null
  current_value: number | null
  created_at: string
}): { status: PacingStatus; expectedValue: number | null } {
  if (goal.target_number == null || goal.target_date == null) {
    return { status: 'no-target', expectedValue: null }
  }

  const now = Date.now()
  const start = new Date(goal.created_at).getTime()
  const end = new Date(`${goal.target_date}T23:59:59`).getTime()

  if (now > end) {
    const hit = (goal.current_value ?? 0) >= goal.target_number
    return { status: hit ? 'ahead' : 'overdue', expectedValue: goal.target_number }
  }

  const totalDays = Math.max((end - start) / 86400000, 1)
  const elapsedDays = Math.max((now - start) / 86400000, 0)
  const expectedValue = goal.target_number * Math.min(elapsedDays / totalDays, 1)

  if (goal.current_value == null) return { status: 'no-progress', expectedValue }
  if (goal.current_value >= expectedValue * 1.05) return { status: 'ahead', expectedValue }
  if (goal.current_value >= expectedValue * 0.9) return { status: 'on-pace', expectedValue }
  return { status: 'behind', expectedValue }
}
