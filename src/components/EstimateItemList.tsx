import { useEffect, useState } from 'react'
import type { EstimateItem } from '../types/estimate'
import {
  MAX_QUANTITY,
  calcLineAmount,
  normalizeNumericInput,
  validateQuantity,
  validateUnitPrice,
} from '../utils/calculation'
import { formatCurrency } from '../utils/formatCurrency'

interface Props {
  items: EstimateItem[]
  onQuantityChange: (id: string, quantity: number) => void
  onUnitPriceChange: (id: string, unitPrice: number) => void
  onRemove: (id: string) => void
}

interface RowProps {
  item: EstimateItem
  onQuantityChange: (id: string, quantity: number) => void
  onUnitPriceChange: (id: string, unitPrice: number) => void
  onRemove: (id: string) => void
}

/**
 * 項目1件（設計仕様 4章② / 5章の検算の結論）。
 *
 * 1段目 = 識別情報の段（項目名・金額）
 * 2段目 = 操作の段（数量ステッパー・単価・削除）
 * 1段に詰めると375pxで項目名が79pxまで潰れるため、この2段構成は動かさない。
 *
 * 入力は「編集中の文字列」を state で持ち、追加フォームと同じ検証関数を通してから
 * 数値として確定する。経路ごとに検証を書き分けない（片方だけ緩くなるため）。
 */
function EstimateRow({
  item,
  onQuantityChange,
  onUnitPriceChange,
  onRemove,
}: RowProps) {
  const [quantityText, setQuantityText] = useState(String(item.quantity))
  const [unitPriceText, setUnitPriceText] = useState(String(item.unitPrice))
  const [quantityError, setQuantityError] = useState<string | undefined>()
  const [unitPriceError, setUnitPriceError] = useState<string | undefined>()

  // ステッパーなど、入力欄の外から数量が変わったときに表示を合わせる
  useEffect(() => {
    setQuantityText(String(item.quantity))
    setQuantityError(undefined)
  }, [item.quantity])

  const handleQuantityText = (text: string) => {
    setQuantityText(text)
    const error = validateQuantity(text)
    setQuantityError(error)
    if (!error) {
      onQuantityChange(item.id, Number(normalizeNumericInput(text)))
    }
  }

  const handleUnitPriceText = (text: string) => {
    setUnitPriceText(text)
    const error = validateUnitPrice(text)
    setUnitPriceError(error)
    if (!error) {
      onUnitPriceChange(item.id, Number(normalizeNumericInput(text)))
    }
  }

  const step = (delta: number) => {
    const next = item.quantity + delta
    if (next < 1 || next > MAX_QUANTITY) return
    onQuantityChange(item.id, next)
  }

  return (
    <li className="item-card">
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
            onClick={() => step(-1)}
          >
            −
          </button>
          <input
            className={`stepper-value${quantityError ? ' is-error' : ''}`}
            type="text"
            inputMode="numeric"
            value={quantityText}
            aria-label="数量"
            aria-invalid={quantityError ? true : undefined}
            onChange={(e) => handleQuantityText(e.target.value)}
            onBlur={() => {
              if (quantityError) {
                setQuantityText(String(item.quantity))
                setQuantityError(undefined)
              }
            }}
          />
          <button
            type="button"
            className="stepper-btn"
            aria-label="数量を1増やす"
            disabled={item.quantity >= MAX_QUANTITY}
            onClick={() => step(1)}
          >
            ＋
          </button>
        </div>

        <label className={`unit-field${unitPriceError ? ' is-error' : ''}`}>
          <span className="unit-mark">¥</span>
          <input
            className="unit-input"
            type="text"
            inputMode="numeric"
            value={unitPriceText}
            aria-label={`${item.name}の単価`}
            aria-invalid={unitPriceError ? true : undefined}
            onChange={(e) => handleUnitPriceText(e.target.value)}
            onBlur={() => {
              if (unitPriceError) {
                setUnitPriceText(String(item.unitPrice))
                setUnitPriceError(undefined)
              }
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

      {(quantityError || unitPriceError) && (
        <p className="item-error" role="alert">
          {quantityError ?? unitPriceError}
        </p>
      )}
    </li>
  )
}

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
        <EstimateRow
          key={item.id}
          item={item}
          onQuantityChange={onQuantityChange}
          onUnitPriceChange={onUnitPriceChange}
          onRemove={onRemove}
        />
      ))}
    </ul>
  )
}
