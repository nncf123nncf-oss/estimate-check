import { useEffect, useRef, useState } from 'react'
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
  onValidityChange: (id: string, hasError: boolean) => void
}

interface RowProps {
  item: EstimateItem
  onQuantityChange: (id: string, quantity: number) => void
  onUnitPriceChange: (id: string, unitPrice: number) => void
  onRemove: (id: string) => void
  onValidityChange: (id: string, hasError: boolean) => void
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
  onValidityChange,
}: RowProps) {
  const [quantityText, setQuantityText] = useState(String(item.quantity))
  const [unitPriceText, setUnitPriceText] = useState(String(item.unitPrice))
  const [quantityError, setQuantityError] = useState<string | undefined>()
  const [unitPriceError, setUnitPriceError] = useState<string | undefined>()

  /**
   * 編集を始める前の値を覚えておく。
   *
   * 打つそばから合計が変わる（＝途中の有効な値がその都度確定する）作りなので、
   * 「300000」を消して「1.5」と打つと、`1` の時点で確定してしまう。
   * そのまま欄を離れると、エラーだけ消えて `1` が残る＝金額が黙って変わる。
   * これを防ぐため、欄を離れるときに誤りが残っていたら**値そのものを編集前に戻す**。
   */
  const originalQuantity = useRef(item.quantity)
  const originalUnitPrice = useRef(item.unitPrice)

  const quantityRef = useRef<HTMLInputElement | null>(null)
  const unitPriceRef = useRef<HTMLInputElement | null>(null)

  /**
   * ステッパーなど、入力欄の外から値が変わったときに表示を合わせる。
   *
   * ただし**その欄を打っている最中は書き戻さない**。
   * 書き戻すと「1,500」のカンマが打つそばから消え、文字列の途中を直したときに
   * カーソルが末尾へ飛ぶ（続けて打った文字が別の場所に入る）。
   */
  useEffect(() => {
    if (document.activeElement === quantityRef.current) return
    setQuantityText(String(item.quantity))
    setQuantityError(undefined)
  }, [item.quantity])

  useEffect(() => {
    if (document.activeElement === unitPriceRef.current) return
    setUnitPriceText(String(item.unitPrice))
    setUnitPriceError(undefined)
  }, [item.unitPrice])

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

  /** 欄を離れたとき、誤りが残っていたら編集前の値に戻す */
  const restoreQuantity = () => {
    if (!quantityError) return
    const original = originalQuantity.current
    setQuantityError(undefined)
    setQuantityText(String(original))
    if (original !== item.quantity) onQuantityChange(item.id, original)
  }

  const restoreUnitPrice = () => {
    if (!unitPriceError) return
    const original = originalUnitPrice.current
    setUnitPriceError(undefined)
    setUnitPriceText(String(original))
    if (original !== item.unitPrice) onUnitPriceChange(item.id, original)
  }

  /**
   * 欄を離れないままページが終わる経路（タブを閉じる・スマホでアプリを切り替える・
   * 裏に回って破棄される）でも、途中で確定した誤った値を残さない。
   * blur だけを塞ぐと「30万円が1円のまま保存されて気づく手がかりが無い」状態が残る。
   * 依存配列を付けず毎描画で貼り直し、常に最新の値を見るようにする。
   */
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') {
        restoreQuantity()
        restoreUnitPrice()
      }
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onHide)
    }
  })

  // 行に誤りがあるかを親へ伝える（誤った合計を正しい体裁で見せないため）
  useEffect(() => {
    onValidityChange(item.id, Boolean(quantityError || unitPriceError))
  }, [item.id, quantityError, unitPriceError, onValidityChange])

  useEffect(() => {
    return () => onValidityChange(item.id, false)
  }, [item.id, onValidityChange])

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
            ref={quantityRef}
            className={`stepper-value${quantityError ? ' is-error' : ''}`}
            type="text"
            inputMode="numeric"
            value={quantityText}
            aria-label="数量"
            aria-invalid={quantityError ? true : undefined}
            onChange={(e) => handleQuantityText(e.target.value)}
            onFocus={() => {
              originalQuantity.current = item.quantity
            }}
            onBlur={restoreQuantity}
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
            ref={unitPriceRef}
            className="unit-input"
            type="text"
            inputMode="numeric"
            value={unitPriceText}
            aria-label={`${item.name}の単価`}
            aria-invalid={unitPriceError ? true : undefined}
            onChange={(e) => handleUnitPriceText(e.target.value)}
            onFocus={() => {
              originalUnitPrice.current = item.unitPrice
            }}
            onBlur={restoreUnitPrice}
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

      {/* 数量と単価の両方が誤っているときは、両方見せる */}
      {(quantityError || unitPriceError) && (
        <div role="alert">
          <ul className="item-error">
            {quantityError && <li>{quantityError}</li>}
            {unitPriceError && <li>{unitPriceError}</li>}
          </ul>
        </div>
      )}
    </li>
  )
}

export function EstimateItemList({
  items,
  onQuantityChange,
  onUnitPriceChange,
  onRemove,
  onValidityChange,
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
          onValidityChange={onValidityChange}
        />
      ))}
    </ul>
  )
}
