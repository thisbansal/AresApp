/**
 * Utility functions for time and duration formatting across the application.
 */

/**
 * Format a duration in seconds into a human-readable HH:MM:SS or MM:SS format.
 * 
 * @param {number} secs - The duration in seconds.
 * @returns {string} Formatted time string.
 */
export const formatTime = (secs) => {
  if (isNaN(secs)) return '0:00'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = Math.floor(secs % 60)
  const formattedS = s < 10 ? `0${s}` : s
  if (h > 0) {
    const formattedM = m < 10 ? `0${m}` : m
    return `${h}:${formattedM}:${formattedS}`
  }
  return `${m}:${formattedS}`
}

/**
 * Format the remaining time of media playback as a negative string.
 * 
 * @param {number} current - Current playback time in seconds.
 * @param {number} total - Total duration in seconds.
 * @returns {string} Formatted remaining time string (e.g. -1:30:00).
 */
export const formatRemainingTime = (current, total) => {
  const remaining = total - current
  if (isNaN(remaining) || remaining <= 0) return '-0:00'
  return `-${formatTime(remaining)}`
}
