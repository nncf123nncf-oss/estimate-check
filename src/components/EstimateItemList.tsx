import type { EstimateItem } from '../types/estimate'
import { calcLineAmount } from '../utils/calculation'
import { formatCurrency } from '../utils/formatCurrency'

interface Props {
  items: EstimateItem[]
  onQuantityChange: (id: string, quantity: number) => void
  onUnitPriceChange: (id: string, unitPrice: number) => void
  onRemove: (id: string) => void
}

/**
 * 項目リスト（設計仕様 4章② / 5章の検算の結論）。
 *
 * 1件を2段に分ける:
 *   1段目 = 識別情報の段（項目名・金額）
 *   2段目 = 操作の段（数量ステッパー・単価・削除）
 * 1段に詰めると375pxで項目名が79pxまで潰れるため、この2段構成は動かさない。
 */
export function EstimateItemList({
  items,
  onQuantityChange,
  onUnitPriceChange,
  onRemove,
}: Props) {
  if (items.length === 0) {
    return (
      <p className="empty">
        まだ項目がありません。下の入力欄から1つめの項目を追加してください。
      </p>
    )
  }

  return (
    <ul className="item-list">
      {items.map((item) => (
        <li key={item.id} className="item-card">
          {/* 1段目: 識別情報 */}
          <div className="item-head">
            <span className="item-name" title={item.name}>
              {item.name}
            </span>
            <span className="item-amount">{formatCurrency(calcLineAmount(item))}</span>
          </div>

          {/* 2段目: 操作 */}
          <div className="item-ops">
            <div className="stepper" role="group" aria-label={`${item.name}の数量`}>
              <button
                type="button"
                className="stepper-btn"
                aria-label="数量を1減らす"
                disabled={item.quantity <= 1}
                onClick={() => onQuantityChange(item.id, item.quantity - 1)}
              >
                −
              </button>
              <input
                className="stepper-value"
                type="text"
                inputMode="numeric"
                value={String(item.quantity)}
                aria-label="数量"
                onChange={(e) => {
                  const next = Number(e.target.value)
                  if (e.target.value === '') return
                  if (!Number.isFinite(next) || next < 1) return
                  onQuantityChange(item.id, Math.floor(next))
                }}
              />
              <button
                type="button"
                className="stepper-btn"
                aria-label="数量を1増やす"
                onClick={() => onQuantityChange(item.id, item.quantity + 1)}
              >
                ＋
              </button>
            </div>

            <label className="unit-field">
              <span className="unit-mark">¥</span>
              <input
                className="unit-input"
                type="text"
                inputMode="numeric"
                value={String(item.unitPrice)}
                aria-label={`${item.name}の単価`}
                onChange={(e) => {
                  const next = Number(e.target.value)
                  if (e.target.value === '') return
                  if (!Number.isFinite(next) || next < 0) return
                  onUnitPriceChange(item.id, Math.floor(next))
                }}
              />
            </label>

            <button
              type="button"
              className="delete-btn"
              aria-label={`${item.name}を削除`}
              onClick={() => {
                if (window.confirm(`「${item.name}」を削除します。よろしいですか？`)) {
                  onRemove(item.id)
                }
              }}
            >
              削除
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}
