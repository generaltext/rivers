import { describe, expect, it } from 'vitest'
import { formatDate, isValidDate, normalizeDate, sortKey, yearOf } from './dates'

describe('normalizeDate', () => {
  it('accepts year, year-month, and full dates, padding months/days', () => {
    expect(normalizeDate('2003')).toBe('2003')
    expect(normalizeDate('2019-8')).toBe('2019-08')
    expect(normalizeDate('2019/08/14')).toBe('2019-08-14')
    expect(normalizeDate(' 2019.8.4 ')).toBe('2019-08-04')
  })
  it('rejects garbage and out-of-range values', () => {
    expect(normalizeDate('')).toBe('')
    expect(normalizeDate('someday')).toBe('')
    expect(normalizeDate('2019-13')).toBe('')
    expect(normalizeDate('2019-02-40')).toBe('')
  })
})

describe('formatDate', () => {
  it('renders humanely at each precision', () => {
    expect(formatDate('2003')).toBe('2003')
    expect(formatDate('2019-08')).toBe('Aug 2019')
    expect(formatDate('2019-08-14')).toBe('Aug 14, 2019')
    expect(formatDate('')).toBe('no date')
    expect(formatDate(undefined)).toBe('no date')
  })
})

describe('sortKey', () => {
  it('orders coarse before fine within a year, and undated last', () => {
    expect(sortKey('2019') < sortKey('2019-05')).toBe(true)
    expect(sortKey('2019-05') < sortKey('2019-05-02')).toBe(true)
    expect(sortKey('2020') > sortKey('2019-12-31')).toBe(true)
    expect(sortKey('') > sortKey('2050')).toBe(true) // undated sorts last
  })
})

describe('misc', () => {
  it('isValidDate mirrors normalizeDate', () => {
    expect(isValidDate('2019')).toBe(true)
    expect(isValidDate('nope')).toBe(false)
  })
  it('yearOf extracts the year', () => {
    expect(yearOf('2019-08')).toBe(2019)
    expect(yearOf('')).toBe(null)
  })
})
