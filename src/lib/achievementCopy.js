import { getRunningCopy } from './achievementCopyRunning.js'
import { getMtbCopy } from './achievementCopyMtb.js'
import { getCyclingCopy } from './achievementCopyCycling.js'
import {
  getHikingCopy,
  getSwimmingCopy,
} from './achievementCopyHikingSwimming.js'
import {
  getGeneralCopy,
  getMomentCopy,
} from './achievementCopyGeneral.js'

export const getAchievementStory = ({
  sport,
  metric,
  threshold,
}) => {
  if (sport === 'running') {
    const value = getRunningCopy(metric, threshold)
    if (value) return value
  }

  if (sport === 'mountain_biking') {
    const value = getMtbCopy(metric, threshold)
    if (value) return value
  }

  if (sport === 'cycling') {
    const value = getCyclingCopy(metric, threshold)
    if (value) return value
  }

  if (sport === 'hiking') {
    const value = getHikingCopy(metric, threshold)
    if (value) return value
  }

  if (sport === 'swimming') {
    const value = getSwimmingCopy(metric, threshold)
    if (value) return value
  }

  if (sport === 'all') {
    const moment = getMomentCopy(metric, threshold)
    if (moment) return moment

    const general = getGeneralCopy(metric, threshold)
    if (general) return general
  }

  return null
}
