import type { DiscountMode, EstimateTotals } from '../types/estimate'
import { TAX_RATES } from '../types/estimate'
import { formatCurrency } from '../utils/formatCurrency'

interface Props {
  totals: EstimateTotals
  hasItems: boolean
  discountMode: DiscountMode
  discountValue: string
  discountError?: string
  taxRate: number
  onDiscountModeChange: (mode: DiscountMode) => void
  onDiscountValueChange: (value: string) => void
  onTaxRateChange: (rate: number) => void
}

/**
 * サマリ帯（設計仕様 4章①）。
 * 常に画面上部に固定し、「項目を1つ足しては合計が変わるのを確かめる」を成立させる。
 * 並びは計算順序そのもの: 小計 → 値引き → 税抜き金額 → 消費税 → 合計
 */
export function EstimateSummary({
  totals,
  hasItems,
  discountMode,
  discountValue,
  discountError,
  taxRate,
  onDiscountModeChange,
  onDiscountValueChange,
  onTaxRateChange,
}: Props) {
  return (
    <section className="summary" aria-label="金額の内訳">
      <div className="summary-row">
        <span className="summary-label">小計</span>
        <span className="summary-value">{formatCurrency(totals.subtotal)}</span>
      </div>

      {/* 値引き行: ラベル / 金額・％の切替 / 入力欄 の3列（7章 確定3） */}
      <div className="summary-row summary-row--discount">
        <span className="summary-label">値引き</span>
        <div className="discount-mode" role="group" aria-label="値引きの指定方法">
          <button
            type="button"
            className={`mode-btn${discountMode === 'amount' ? ' is-active' : ''}`}
            aria-pressed={discountMode === 'amount'}
            onClick={() => onDiscountModeChange('amount')}
          >
            ¥
          </button>
          <button
            type="button"
            className={`mode-btn${discountMode === 'percent' ? ' is-active' : ''}`}
            aria-pressed={discountMode === 'percent'}
            onClick={() => onDiscountModeChange('percent')}
          >
            %
          </button>
        </div>
        <input
          className={`discount-input${discountError ? ' is-error' : ''}`}
          type="text"
          inputMode="numeric"
          value={discountValue}
          placeholder="0"
          aria-label={discountMode === 'percent' ? '値引き率' : '値引き額'}
          aria-invalid={discountError ? true : undefined}
          onChange={(e) => onDiscountValueChange(e.target.value)}
        />
      </div>

      {discountError && (
        <p className="summary-error" role="alert">
          {discountError}
        </p>
      )}

      {hasItems && (
        <>
          <div className="summary-divider" />

          <div className="summary-row">
            <span className="summary-label">税抜き金額</span>
            <span className="summary-value">
              {formatCurrency(totals.taxableAmount)}
            </span>
          </div>

          {/* 消費税行: ラベル / 税率プルダウン / 税額 の3列（検算①で解消した箇所） */}
          <div className="summary-row summary-row--tax">
            <span className="summary-label">消費税</span>
            <select
              className="tax-select"
              value={taxRate}
              aria-label="消費税率"
              onChange={(e) => onTaxRateChange(Number(e.target.value))}
            >
              {TAX_RATES.map((rate) => (
                <option key={rate} value={rate}>
                  {rate}%
                </option>
              ))}
            </select>
            <span className="summary-value">{formatCurrency(totals.taxAmount)}</span>
          </div>

          <div className="summary-divider" />
        </>
      )}

      <div className="summary-row summary-row--total">
        <span className="summary-label">合計</span>
        <span className="summary-total">{formatCurrency(totals.total)}</span>
      </div>

      <p className="summary-note">消費税は1円未満を切り捨てて計算しています</p>
    </section>
  )
}
