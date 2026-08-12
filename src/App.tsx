import { useEffect, useMemo, useRef, useState } from 'react'
import type { DiscountMode, EstimateItem, TaxRate } from './types/estimate'
import { TAX_RATES } from './types/estimate'
import { EstimateForm } from './components/EstimateForm'
import { EstimateItemList } from './components/EstimateItemList'
import { EstimateSummary } from './components/EstimateSummary'
import {
  MAX_QUANTITY,
  MAX_UNIT_PRICE,
  buildShareText,
  calcTotals,
  parseDiscountValue,
  validateDiscount,
} from './utils/calculation'
import './App.css'

const STORAGE_KEY = 'estimate-soroban.v1'

interface SavedState {
  items: EstimateItem[]
  discountMode: DiscountMode
  discountValue: string
  taxRate: number
}

/**
 * 保存データの中身を1件ずつ確かめる。
 * 配列かどうかだけ見て中身を信用すると、壊れたデータで画面が真っ白になり、
 * しかも壊れたデータが残るのでリロードしても直らない（＝利用者が自力で復旧できない）。
 */
function isValidItem(value: unknown): value is EstimateItem {
  if (typeof value !== 'object' || value === null) return false
  const o = value as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    o.id !== '' &&
    typeof o.name === 'string' &&
    typeof o.quantity === 'number' &&
    Number.isInteger(o.quantity) &&
    o.quantity >= 1 &&
    o.quantity <= MAX_QUANTITY &&
    typeof o.unitPrice === 'number' &&
    Number.isInteger(o.unitPrice) &&
    o.unitPrice >= 0 &&
    o.unitPrice <= MAX_UNIT_PRICE
  )
}

function isValidTaxRate(value: unknown): value is TaxRate {
  return (
    typeof value === 'number' && (TAX_RATES as readonly number[]).includes(value)
  )
}

function loadSaved(): SavedState | null {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
  if (!raw) return null

  const discard = () => {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // 消せなくても、この後は初期状態で起動するので実害はない
    }
    return null
  }

  try {
    const parsed = JSON.parse(raw) as Partial<SavedState>
    if (!Array.isArray(parsed.items)) return discard()
    // 1件でも壊れていたら、その回の見積もり全体が信用できないので保存ごと捨てる
    if (!parsed.items.every(isValidItem)) return discard()

    return {
      items: parsed.items,
      discountMode: parsed.discountMode === 'percent' ? 'percent' : 'amount',
      discountValue:
        typeof parsed.discountValue === 'string' ? parsed.discountValue : '',
      taxRate: isValidTaxRate(parsed.taxRate) ? parsed.taxRate : 10,
    }
  } catch {
    return discard()
  }
}

function App() {
  const saved = useMemo(loadSaved, [])
  const [items, setItems] = useState<EstimateItem[]>(saved?.items ?? [])
  const [discountMode, setDiscountMode] = useState<DiscountMode>(
    saved?.discountMode ?? 'amount',
  )
  const [discountValue, setDiscountValue] = useState(saved?.discountValue ?? '')
  const [taxRate, setTaxRate] = useState<number>(saved?.taxRate ?? 10)
  const [copied, setCopied] = useState(false)
  const [fallbackText, setFallbackText] = useState<string | null>(null)
  const fallbackRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ items, discountMode, discountValue, taxRate }),
      )
    } catch {
      // 保存できない環境（プライベートモード等）でも計算は続けられるようにする
    }
  }, [items, discountMode, discountValue, taxRate])

  useEffect(() => {
    if (fallbackText && fallbackRef.current) {
      fallbackRef.current.focus()
      fallbackRef.current.select()
    }
  }, [fallbackText])

  const subtotalOnly = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
  const discountCheck = validateDiscount(discountMode, discountValue, subtotalOnly)
  const effectiveDiscount = discountCheck.ok ? parseDiscountValue(discountValue) : 0
  const totals = calcTotals(items, discountMode, effectiveDiscount, taxRate)
  const canShare = items.length > 0 && discountCheck.ok

  const handleAdd = (name: string, quantity: number, unitPrice: number) => {
    setItems((prev) => [
      ...prev,
      {
        id:
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        name,
        quantity,
        unitPrice,
      },
    ])
  }

  const handleQuantityChange = (id: string, quantity: number) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, quantity } : item)),
    )
  }

  const handleUnitPriceChange = (id: string, unitPrice: number) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, unitPrice } : item)),
    )
  }

  const handleRemove = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }

  /**
   * 値引きの単位を切り替えたら入力値を消す。
   * 残したままにすると「10%」が「¥10」に化けて、警告も出ずに合計だけが変わる。
   */
  const handleDiscountModeChange = (mode: DiscountMode) => {
    setDiscountMode(mode)
    setDiscountValue('')
  }

  const handleCopy = async () => {
    const text = buildShareText(
      items,
      totals,
      discountMode,
      effectiveDiscount,
      taxRate,
    )
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('clipboard unavailable')
      }
      await navigator.clipboard.writeText(text)
      setFallbackText(null)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // コピーできない環境（権限拒否・http配信など）では、
      // 改行を保ったまま選べる形で画面に出す。
      setFallbackText(text)
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">見積もりそろばん</h1>
        <p className="page-lead">項目を足すたびに、合計がその場で変わります</p>
      </header>

      <EstimateSummary
        totals={totals}
        hasItems={items.length > 0}
        discountMode={discountMode}
        discountValue={discountValue}
        discountError={discountCheck.errors.discount}
        taxRate={taxRate}
        onDiscountModeChange={handleDiscountModeChange}
        onDiscountValueChange={setDiscountValue}
        onTaxRateChange={setTaxRate}
      />

      <main className="page-main">
        <h2 className="section-title">見積もり項目 {items.length}件</h2>

        <EstimateItemList
          items={items}
          onQuantityChange={handleQuantityChange}
          onUnitPriceChange={handleUnitPriceChange}
          onRemove={handleRemove}
        />

        <EstimateForm onAdd={handleAdd} />
      </main>

      <footer className="page-foot">
        {!discountCheck.ok && items.length > 0 && (
          <p className="foot-note">値引きを直すと内訳をコピーできます</p>
        )}
        <button
          type="button"
          className="copy-btn"
          disabled={!canShare}
          onClick={handleCopy}
        >
          {copied ? 'コピーしました' : '内訳をコピー'}
        </button>
      </footer>

      {fallbackText && (
        <div className="fallback">
          <p className="fallback-note">
            自動でコピーできませんでした。下の内訳を選んでコピーしてください。
          </p>
          <textarea
            ref={fallbackRef}
            className="fallback-text"
            readOnly
            rows={12}
            value={fallbackText}
            aria-label="内訳（選んでコピーしてください）"
          />
          <button
            type="button"
            className="copy-btn"
            onClick={() => setFallbackText(null)}
          >
            閉じる
          </button>
        </div>
      )}
    </div>
  )
}

export default App
