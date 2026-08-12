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
 * - 行の金額     : 数量 × 単価。どちらも整数しか受け付けないため端数は発生しない
 * - 値引き（金額）: 整数しか受け付けないため丸めは発生しない
 * - 値引き（％）  : 小計 × 率 ÷ 100 を四捨五入（Math.round）
 * - 消費税        : 税抜き金額 × 率 ÷ 100 を切り捨て（Math.floor）
 *
 * 消費税を切り捨てにしているのは、日本の実務で端数を切り捨てる扱いが広く使われているため。
 * 「どちらで計算しているか分からない」状態を避けるため、画面にも注記を出す。
 */

/** 入力できる上限。これを超えると桁あふれで合計が合わなくなるため、検証で弾く */
export const MAX_QUANTITY = 100_000
export const MAX_UNIT_PRICE = 1_000_000_000

/**
 * 入力文字列の正規化。
 * 全角数字・カンマ区切り・全角記号を、そのまま受け付けられる形に直す。
 * 「数字を入れているのに数字で入力してくださいと言われる」を防ぐため、
 * 弾くのではなく直してあげる方針にする。
 */
export function normalizeNumericInput(raw: string): string {
  return raw
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[，,]/g, '')
    .replace(/[．]/g, '.')
    .replace(/[－ー−–—]/g, '-')
    .replace(/[％%]/g, '')
    .replace(/[¥￥]/g, '')
    .trim()
}

/**
 * 正規化した文字列が「数字だけで書かれているか」を判定する。
 * Number() をそのまま使うと `1e5`・`0x1f`・`Infinity` が通ってしまうため、
 * 形そのものを正規表現で確かめる。
 */
const NUMERIC_PATTERN = /^-?\d+(\.\d+)?$/

function isNumericText(text: string): boolean {
  return NUMERIC_PATTERN.test(text)
}

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
      : discountValue
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

/** 数量1つ分の検証。追加フォームとインライン編集の両方がこれを通る */
export function validateQuantity(raw: string): string | undefined {
  const text = normalizeNumericInput(raw)
  if (text === '') return '数量を入力してください'
  if (!isNumericText(text)) return '数量は数字で入力してください'

  const value = Number(text)
  if (value < 0) return '数量にマイナスは使えません'
  if (value === 0) return '数量は1以上にしてください'
  if (!Number.isInteger(value)) return '数量は整数で入力してください'
  if (value > MAX_QUANTITY) {
    return `数量は${formatNumber(MAX_QUANTITY)}までにしてください`
  }
  return undefined
}

/** 単価1つ分の検証。追加フォームとインライン編集の両方がこれを通る */
export function validateUnitPrice(raw: string): string | undefined {
  const text = normalizeNumericInput(raw)
  if (text === '') return '単価を入力してください'
  if (!isNumericText(text)) return '単価は数字で入力してください'

  const value = Number(text)
  if (value < 0) return '単価にマイナスは使えません'
  if (value === 0) return '単価は1以上にしてください'
  if (!Number.isInteger(value)) return '単価は1円単位で入力してください'
  if (value > MAX_UNIT_PRICE) {
    return `単価は${formatCurrency(MAX_UNIT_PRICE)}までにしてください`
  }
  return undefined
}

/**
 * 項目の入力検証。空欄・0・負数をここで判定する。
 * 入力欄は文字列のまま受け取る（「空欄」と「0」を区別するため）。
 *
 * この関数は追加フォームと一覧のインライン編集の**両方**が通る。
 * 経路ごとに検証を書き分けると、片方だけ緩い状態が必ず生まれる。
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

  const quantityError = validateQuantity(quantity)
  if (quantityError) errors.quantity = quantityError

  const unitPriceError = validateUnitPrice(unitPrice)
  if (unitPriceError) errors.unitPrice = unitPriceError

  return { ok: Object.keys(errors).length === 0, errors }
}

/** 値引き入力の検証。空欄は「値引きなし」として扱うのでエラーにしない */
export function validateDiscount(
  discountMode: DiscountMode,
  discountValue: string,
  subtotal: number,
): ValidationResult {
  const errors: Record<string, string> = {}
  const text = normalizeNumericInput(discountValue)
  if (text === '') return { ok: true, errors }

  if (!isNumericText(text)) {
    errors.discount = '値引きは数字で入力してください'
    return { ok: false, errors }
  }

  const value = Number(text)
  if (value < 0) {
    errors.discount = '値引きにマイナスは使えません'
  } else if (!Number.isInteger(value)) {
    errors.discount =
      discountMode === 'percent'
        ? '値引きの割合は整数で入力してください'
        : '値引きは1円単位で入力してください'
  } else if (discountMode === 'percent' && value > 100) {
    errors.discount = '値引きは100%までです'
  } else if (discountMode === 'amount' && value > subtotal) {
    errors.discount = '値引きが小計を超えています'
  }

  return { ok: Object.keys(errors).length === 0, errors }
}

/** 検証を通った値引き入力を数値にする */
export function parseDiscountValue(discountValue: string): number {
  const text = normalizeNumericInput(discountValue)
  if (text === '' || !isNumericText(text)) return 0
  return Number(text)
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
