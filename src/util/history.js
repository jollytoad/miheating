export const periodDuration = 1000*60*60

export const folder = 'history'

export function topOfPeriod(now) {
  return Math.floor(now / periodDuration) * periodDuration
}
