/**
 * 金額の表示整形。
 * 設計仕様 2章のとおり、通貨記号は「¥」を前置し「円」は後置しない
 * （右揃えの基準が数字でなくなり、桁の縦揃えが崩れるため）。
 */
export function formatCurrency(value: number): string {
  const rounded = Math.round(value)
  const sign = rounded < 0 ? '−' : ''
  return `${sign}¥${Math.abs(rounded).toLocaleString('ja-JP')}`
}

/** 桁区切りのみ（通貨記号なし）。数量など単位が円でないものに使う */
export function formatNumber(value: number): string {
  return Math.round(value).toLocaleString('ja-JP')
}
