/** 見積もりの1項目 */
export interface EstimateItem {
  id: string
  /** 項目名（例: ホームページ制作一式） */
  name: string
  /** 数量。1以上の整数 */
  quantity: number
  /** 単価（円）。1以上の整数 */
  unitPrice: number
}

/** 値引きの指定方法 */
export type DiscountMode = 'amount' | 'percent'

/** 消費税率（%）。設計仕様 7章の確定により選択式 */
export const TAX_RATES = [10, 8, 0] as const
export type TaxRate = (typeof TAX_RATES)[number]

/** 計算結果。計算順序: 小計 − 値引き = 税抜き金額 → 税抜き金額 + 消費税 = 合計金額 */
export interface EstimateTotals {
  /** 各項目の金額（数量 × 単価）の合計 */
  subtotal: number
  /** 実際に差し引かれた値引き額（円） */
  discountAmount: number
  /** 小計 − 値引き */
  taxableAmount: number
  /** 消費税額 */
  taxAmount: number
  /** 税抜き金額 + 消費税 */
  total: number
}

/** 入力検証の結果。空欄・0・負数をここで判定する */
export interface ValidationResult {
  ok: boolean
  /** フィールド名 → エラーメッセージ */
  errors: Record<string, string>
}
