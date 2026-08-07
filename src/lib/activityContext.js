export async function enrichActivityContext({
  userId,
  logId = null,
  polarExerciseId = null,
  force = false,
}) {
  if (!userId) return null

  try {
    const response = await fetch('/api/activity/enrich', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        logId,
        polarExerciseId,
        force,
      }),
    })

    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      console.warn(
        'Aktivitätskontext konnte nicht ergänzt werden:',
        payload?.error
      )
      return null
    }

    return payload
  } catch (error) {
    console.warn(
      'Aktivitätskontext konnte nicht ergänzt werden:',
      error
    )
    return null
  }
}
