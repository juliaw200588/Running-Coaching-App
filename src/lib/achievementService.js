import { evaluateAchievements } from './achievementEngine.js'

export const loadAndEvaluateAchievements = async ({ supabase, userId }) => {
  if (!supabase) throw new Error('Supabase-Client fehlt.')
  if (!userId) throw new Error('userId fehlt.')

  const [activitiesResult, unlocksResult] = await Promise.all([
    supabase.from('logs').select('*').eq('user_id', userId).order('actual_date', { ascending: true }),
    supabase.from('achievement_unlocks').select('*').eq('user_id', userId),
  ])

  if (activitiesResult.error) throw activitiesResult.error
  if (unlocksResult.error) throw unlocksResult.error

  const evaluation = evaluateAchievements({
    activities: activitiesResult.data || [],
    existingUnlocks: unlocksResult.data || [],
  })

  const rows = evaluation.newlyUnlocked.map(achievement => ({
    user_id: userId,
    achievement_id: achievement.id,
    definition_version: achievement.version,
    unlocked_at: achievement.unlockedAt,
    activity_id: achievement.activityId,
    metadata: {
      sport: achievement.sport,
      category: achievement.category,
      title: achievement.title,
      threshold: achievement.threshold,
      unit: achievement.unit ?? null,
    },
  }))

  if (rows.length) {
    const { error } = await supabase.from('achievement_unlocks').upsert(rows, {
      onConflict: 'user_id,achievement_id',
      ignoreDuplicates: true,
    })
    if (error) throw error
  }

  return evaluation
}

export const markAchievementUnlocksShown = async ({
  supabase,
  userId,
  achievementIds = [],
}) => {
  if (!achievementIds.length) return

  const { error } = await supabase
    .from('achievement_unlocks')
    .update({
      seen_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .in('achievement_id', achievementIds)

  if (error) throw error
}
