export function activityEditBlockReason(
  activity: { state: string },
  hasAnswers: boolean
): string | null {
  if (activity.state === 'live') {
    return 'End this activity before editing, including a prepared quiz.';
  }
  if (hasAnswers) {
    return 'Clear all responses before editing this activity.';
  }
  return null;
}
