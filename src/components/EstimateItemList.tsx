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
  /** 画面が終わる直前に使う。状態更新を待たず、その場で保存まで済ませる */
  onRestoreNow: (id: string, patch: Partial<EstimateItem>) => void
}

interface RowProps {
  item: EstimateItem
  onQuantityChange: (id: string, quantity: number) => void
  onUnitPriceChange: (id: string, unitPrice: number) => void
  onRemove: (id: string) => void
  onValidityChange: (id: string, hasError: boolean) => void
  onRestoreNow: (id: string, patch: Partial<EstimateItem>) => void
}

/** 入力の誤りで金額を伏せるときの表示 */
const BLANK = '—'

/**
 * 項目1件（設計仕様 4章② / 5章の検算の結論）。
 *
 * 1段目 = 識別情報の段（項目名・金額）
 * 2段目 = 操作の段（数量ステッパー・単価・削除）
 * 1段に詰めると375pxで項目名が79pxまで潰れるため、この2段構成は動かさない。
 */
function EstimateRow({
  item,
  onQuantityChange,
  onUnitPriceChange,
  onRemove,
  onValidityChange,
  onRestoreNow,
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

  /**
   * 自分がこの欄から確定させた値。
   *
   * 表示の書き戻しを「フォーカスが当たっているか」で止めると、
   * ボタンを押してもフォーカスが動かないブラウザで、箱の数字と実際の数量がずれたまま戻らない。
   * 「自分が出した変更か、外から来た変更か」で判断すれば、フォーカスの扱いに左右されない。
   */
  const lastCommittedQuantity = useRef(item.quantity)
  const lastCommittedUnitPrice = useRef(item.unitPrice)

  // 外から数量が変わったとき（ステッパー・復帰処理）だけ表示を合わせる
  useEffect(() => {
    if (item.quantity === lastCommittedQuantity.current) return
    lastCommittedQuantity.current = item.quantity
    setQuantityText(String(item.quantity))
    setQuantityError(undefined)
  }, [item.quantity])

  useEffect(() => {
    if (item.unitPrice === lastCommittedUnitPrice.current) return
    lastCommittedUnitPrice.current = item.unitPrice
    setUnitPriceText(String(item.unitPrice))
    setUnitPriceError(undefined)
  }, [item.unitPrice])

  const handleQuantityText = (text: string) => {
    setQuantityText(text)
    const error = validateQuantity(text)
    setQuantityError(error)
    if (!error) {
      const value = Number(normalizeNumericInput(text))
      lastCommittedQuantity.current = value
      onQuantityChange(item.id, value)
    }
  }

  const handleUnitPriceText = (text: string) => {
    setUnitPriceText(text)
    const error = validateUnitPrice(text)
    setUnitPriceError(error)
    if (!error) {
      const value = Number(normalizeNumericInput(text))
      lastCommittedUnitPrice.current = value
      onUnitPriceChange(item.id, value)
    }
  }

  /** 欄を離れたとき、誤りが残っていたら編集前の値に戻す */
  const restoreQuantity = () => {
    if (!quantityError) return
    const original = originalQuantity.current
    setQuantityError(undefined)
    setQuantityText(String(original))
    lastCommittedQuantity.current = original
    if (original !== item.quantity) onQuantityChange(item.id, original)
  }

  const restoreUnitPrice = () => {
    if (!unitPriceError) return
    const original = originalUnitPrice.current
    setUnitPriceError(undefined)
    setUnitPriceText(String(original))
    lastCommittedUnitPrice.current = original
    if (original !== item.unitPrice) onUnitPriceChange(item.id, original)
  }

  /**
   * 画面が終わる直前の復帰。
   *
   * 通常の復帰は「状態を更新する → 描画後に保存する」の順で走るが、
   * ページを閉じる・読み込み直す・別のページへ移る場面では、
   * その「描画後の保存」まで到達しないことがある。
   * ここでは状態更新を待たず、その場で保存まで済ませる。
   */
  useEffect(() => {
    const restoreImmediately = () => {
      const patch: Partial<EstimateItem> = {}
      if (quantityError) patch.quantity = originalQuantity.current
      if (unitPriceError) patch.unitPrice = originalUnitPrice.current
      if (Object.keys(patch).length === 0) return

      if (patch.quantity !== undefined) {
        lastCommittedQuantity.current = patch.quantity
        setQuantityText(String(patch.quantity))
        setQuantityError(undefined)
      }
      if (patch.unitPrice !== undefined) {
        lastCommittedUnitPrice.current = patch.unitPrice
        setUnitPriceText(String(patch.unitPrice))
        setUnitPriceError(undefined)
      }
      onRestoreNow(item.id, patch)
    }

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') restoreImmediately()
    }

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', restoreImmediately)
    window.addEventListener('beforeunload', restoreImmediately)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', restoreImmediately)
      window.removeEventListener('beforeunload', restoreImmediately)
    }
  })

  // 行に誤りがあるかを親へ伝える（誤った金額を正しい体裁で見せないため）
  useEffect(() => {
    onValidityChange(item.id, Boolean(quantityError || unitPriceError))
  }, [item.id, quantityError, unitPriceError, onValidityChange])

  useEffect(() => {
    return () => onValidityChange(item.id, false)
  }, [item.id, onValidityChange])

  const step = (delta: number) => {
    const next = item.quantity + delta
    if (next < 1 || next > MAX_QUANTITY) return
    // ボタンで意図して変えた値は「編集前の値」として扱う。
    // ここを更新しないと、その後の打ち間違いで復帰したときに、
    // ボタンで増やした分まで一緒に巻き戻ってしまう。
    originalQuantity.current = next
    onQuantityChange(item.id, next)
  }

  const hasError = Boolean(quantityError || unitPriceError)

  return (
    <li className="item-card">
      {/* 1段目: 識別情報 */}
      <div className="item-head">
        <span className="item-name" title={item.name}>
          {item.name}
        </span>
        {/* 入力が誤っているあいだは、この行の金額も伏せる（サマリと基準を揃える） */}
        <span className="item-amount">
          {hasError ? BLANK : formatCurrency(calcLineAmount(item))}
        </span>
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
      {hasError && (
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
  onRestoreNow,
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
          onRestoreNow={onRestoreNow}
        />
      ))}
    </ul>
  )
}
