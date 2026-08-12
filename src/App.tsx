import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

const STORAGE_KEY = 'estimate-check.v1'

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
  const [showFallback, setShowFallback] = useState(false)
  // 誤りのある行のid。誤った合計を「正しい体裁」で見せないために集める
  const [rowErrors, setRowErrors] = useState<Record<string, boolean>>({})
  const fallbackRef = useRef<HTMLTextAreaElement | null>(null)

  // いまの状態を常に持っておく（画面が終わる直前に、描画を待たず保存するため）
  const stateRef = useRef({ items, discountMode, discountValue, taxRate })
  stateRef.current = { items, discountMode, discountValue, taxRate }

  const persist = (nextItems: EstimateItem[]) => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...stateRef.current, items: nextItems }),
      )
    } catch {
      // 保存できない環境（プライベートモード等）でも計算は続けられるようにする
    }
  }

  useEffect(() => {
    persist(items)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, discountMode, discountValue, taxRate])

  /**
   * 画面が終わる直前の復帰。
   * 通常の経路は「状態を更新 → 描画後に保存」だが、ページを閉じる・読み込み直す場面では
   * その保存まで到達しないことがある。ここでは状態更新を待たず、その場で保存する。
   */
  const handleRestoreNow = useCallback(
    (id: string, patch: Partial<EstimateItem>) => {
      const next = stateRef.current.items.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      )
      stateRef.current = { ...stateRef.current, items: next }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stateRef.current))
      } catch {
        // 保存できなくても、この後の状態更新で画面は正しくなる
      }
      setItems(next)
    },
    [],
  )

  useEffect(() => {
    if (showFallback && fallbackRef.current) {
      fallbackRef.current.focus()
      fallbackRef.current.select()
    }
  }, [showFallback])

  const subtotalOnly = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
  const discountCheck = validateDiscount(discountMode, discountValue, subtotalOnly)
  const effectiveDiscount = discountCheck.ok ? parseDiscountValue(discountValue) : 0
  const totals = calcTotals(items, discountMode, effectiveDiscount, taxRate)
  const hasRowError = Object.values(rowErrors).some(Boolean)
  const canShare = items.length > 0 && discountCheck.ok && !hasRowError
  // 共有テキストは毎回いまの内容から作り直す。
  // 一度作った文字列を持ち回すと、開いたまま編集したときに古い内訳が残る。
  const shareText = buildShareText(
    items,
    totals,
    discountMode,
    effectiveDiscount,
    taxRate,
  )

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

  const handleValidityChange = useCallback((id: string, hasError: boolean) => {
    setRowErrors((prev) => {
      if (!hasError) {
        if (!(id in prev)) return prev
        const next = { ...prev }
        delete next[id]
        return next
      }
      return prev[id] ? prev : { ...prev, [id]: true }
    })
  }, [])

  /**
   * 値引きの単位を切り替えたら入力値を消す。
   * 残したままにすると「10%」が「¥10」に化けて、警告も出ずに合計だけが変わる。
   */
  const handleDiscountModeChange = (mode: DiscountMode) => {
    setDiscountMode(mode)
    setDiscountValue('')
  }

  const handleCopy = async () => {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('clipboard unavailable')
      }
      await navigator.clipboard.writeText(shareText)
      setShowFallback(false)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // コピーできない環境（権限拒否・http配信など）では、
      // 改行を保ったまま選べる形で画面に出す。
      setShowFallback(true)
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">見積チェック</h1>
        <p className="page-lead">項目を足すたびに、合計がその場で変わります</p>
      </header>

      <EstimateSummary
        totals={totals}
        hasItems={items.length > 0}
        discountMode={discountMode}
        discountValue={discountValue}
        discountError={discountCheck.errors.discount}
        valuesHidden={hasRowError}
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
          onValidityChange={handleValidityChange}
          onRestoreNow={handleRestoreNow}
        />

        <EstimateForm onAdd={handleAdd} />
      </main>

      <footer className="page-foot">
        {items.length > 0 && (!discountCheck.ok || hasRowError) && (
          <p className="foot-note">入力の誤りを直すと内訳をコピーできます</p>
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

      {showFallback && (
        <div className="fallback">
          <p className="fallback-note">
            自動でコピーできませんでした。下の内訳を選んでコピーしてください。
          </p>
          <textarea
            ref={fallbackRef}
            className="fallback-text"
            readOnly
            rows={12}
            value={shareText}
            aria-label="内訳（選んでコピーしてください）"
          />
          <button
            type="button"
            className="copy-btn"
            onClick={() => setShowFallback(false)}
          >
            閉じる
          </button>
        </div>
      )}
    </div>
  )
}

export default App
