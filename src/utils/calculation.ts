import type {
  DiscountMode,
  EstimateItem,
  EstimateTotals,
  ValidationResult,
} from '../types/estimate'
import { formatCurrency, formatNumber } from './formatCurrency'

/**
 * 端数処理の方針（この1箇所に集約する）
 *
 * - 行の金額 : 数量 × 単価。どちらも整数で入力させるため端数は発生しない
 * - 値引き（％）: 小計 × 率 ÷ 100 を四捨五入（Math.round）
 * - 消費税     : 税抜き金額 × 率 ÷ 100 を切り捨て（Math.floor）
 *
 * 消費税を切り捨てにしているのは、日本の実務で端数を切り捨てる扱いが広く使われているため。
 * 「どちらで計算しているか分からない」状態を避けるため、画面にも注記を出す。
 */

/** 1項目の金額 */
export function calcLineAmount(item: EstimateItem): number {
  return item.quantity * item.unitPrice
}

/** 小計（各項目の金額の合計） */
export function calcSubtotal(items: EstimateItem[]): number {
  return items.reduce((sum, item) => sum + calcLineAmount(item), 0)
}

/** 指定された値引きが、実際に何円の値引きになるか */
export function calcDiscountAmount(
  subtotal: number,
  discountMode: DiscountMode,
  discountValue: number,
): number {
  if (!Number.isFinite(discountValue) || discountValue <= 0) return 0
  const raw =
    discountMode === 'percent'
      ? Math.round((subtotal * discountValue) / 100)
      : Math.round(discountValue)
  // 値引きが小計を超えても税抜き金額をマイナスにしない（表示は0円で止める）
  return Math.min(Math.max(raw, 0), subtotal)
}

/**
 * 計算順序（出題どおり）
 *   小計 − 値引き = 税抜き金額
 *   税抜き金額 + 消費税 = 合計金額
 */
export function calcTotals(
  items: EstimateItem[],
  discountMode: DiscountMode,
  discountValue: number,
  taxRate: number,
): EstimateTotals {
  const subtotal = calcSubtotal(items)
  const discountAmount = calcDiscountAmount(subtotal, discountMode, discountValue)
  const taxableAmount = subtotal - discountAmount
  const taxAmount = Math.floor((taxableAmount * taxRate) / 100)
  const total = taxableAmount + taxAmount
  return { subtotal, discountAmount, taxableAmount, taxAmount, total }
}

/**
 * 項目の入力検証。空欄・0・負数をここで判定する。
 * 入力欄は文字列のまま受け取る（「空欄」と「0」を区別するため）。
 */
export function validateItemInput(
  name: string,
  quantity: string,
  unitPrice: string,
): ValidationResult {
  const errors: Record<string, string> = {}

  if (name.trim() === '') {
    errors.name = '項目名を入力してください'
  }

  const qty = Number(quantity)
  if (quantity.trim() === '') {
    errors.quantity = '数量を入力してください'
  } else if (!Number.isFinite(qty)) {
    errors.quantity = '数量は数字で入力してください'
  } else if (qty < 0) {
    errors.quantity = '数量にマイナスは使えません'
  } else if (qty === 0) {
    errors.quantity = '数量は1以上にしてください'
  } else if (!Number.isInteger(qty)) {
    errors.quantity = '数量は整数で入力してください'
  }

  const price = Number(unitPrice)
  if (unitPrice.trim() === '') {
    errors.unitPrice = '単価を入力してください'
  } else if (!Number.isFinite(price)) {
    errors.unitPrice = '単価は数字で入力してください'
  } else if (price < 0) {
    errors.unitPrice = '単価にマイナスは使えません'
  } else if (price === 0) {
    errors.unitPrice = '単価は1以上にしてください'
  } else if (!Number.isInteger(price)) {
    errors.unitPrice = '単価は1円単位で入力してください'
  }

  return { ok: Object.keys(errors).length === 0, errors }
}

/** 値引き入力の検証。空欄は「値引きなし」として扱うのでエラーにしない */
export function validateDiscount(
  discountMode: DiscountMode,
  discountValue: string,
  subtotal: number,
): ValidationResult {
  const errors: Record<string, string> = {}
  if (discountValue.trim() === '') return { ok: true, errors }

  const value = Number(discountValue)
  if (!Number.isFinite(value)) {
    errors.discount = '値引きは数字で入力してください'
  } else if (value < 0) {
    errors.discount = '値引きにマイナスは使えません'
  } else if (discountMode === 'percent' && value > 100) {
    errors.discount = '値引きは100%までです'
  } else if (discountMode === 'amount' && value > subtotal) {
    errors.discount = '値引きが小計を超えています'
  }

  return { ok: Object.keys(errors).length === 0, errors }
}

/**
 * 顧客へ共有する内訳のプレーンテキストを組み立てる。
 * 装飾に頼らず、メールやチャットにそのまま貼れる形にする。
 */
export function buildShareText(
  items: EstimateItem[],
  totals: EstimateTotals,
  discountMode: DiscountMode,
  discountValue: number,
  taxRate: number,
): string {
  const lines: string[] = ['お見積もり', '']

  items.forEach((item) => {
    lines.push(
      `${item.name}　${formatNumber(item.quantity)} × ${formatCurrency(item.unitPrice)}　${formatCurrency(
        calcLineAmount(item),
      )}`,
    )
  })

  lines.push('')
  lines.push(`小計　　　${formatCurrency(totals.subtotal)}`)

  if (totals.discountAmount > 0) {
    const label =
      discountMode === 'percent' ? `値引き（${discountValue}%）` : '値引き'
    lines.push(`${label}　−${formatCurrency(totals.discountAmount)}`)
  }

  lines.push(`税抜き金額　${formatCurrency(totals.taxableAmount)}`)
  lines.push(`消費税（${taxRate}%）　${formatCurrency(totals.taxAmount)}`)
  lines.push(`合計　　　${formatCurrency(totals.total)}`)

  return lines.join('\n')
}
