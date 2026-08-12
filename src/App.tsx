import { useEffect, useMemo, useState } from 'react'
import type { DiscountMode, EstimateItem } from './types/estimate'
import { EstimateForm } from './components/EstimateForm'
import { EstimateItemList } from './components/EstimateItemList'
import { EstimateSummary } from './components/EstimateSummary'
import { buildShareText, calcTotals, validateDiscount } from './utils/calculation'
import './App.css'

const STORAGE_KEY = 'estimate-soroban.v1'

interface SavedState {
  items: EstimateItem[]
  discountMode: DiscountMode
  discountValue: string
  taxRate: number
}

function loadSaved(): SavedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<SavedState>
    if (!Array.isArray(parsed.items)) return null
    return {
      items: parsed.items,
      discountMode: parsed.discountMode === 'percent' ? 'percent' : 'amount',
      discountValue: typeof parsed.discountValue === 'string' ? parsed.discountValue : '',
      taxRate: typeof parsed.taxRate === 'number' ? parsed.taxRate : 10,
    }
  } catch {
    return null
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

  const subtotalOnly = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
  const discountCheck = validateDiscount(discountMode, discountValue, subtotalOnly)
  const effectiveDiscount = discountCheck.ok ? Number(discountValue || 0) : 0
  const totals = calcTotals(items, discountMode, effectiveDiscount, taxRate)

  const handleAdd = (name: string, quantity: number, unitPrice: number) => {
    setItems((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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

  const handleCopy = async () => {
    const text = buildShareText(
      items,
      totals,
      discountMode,
      effectiveDiscount,
      taxRate,
    )
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('コピーできませんでした。下の内容を選択してコピーしてください。', text)
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
        onDiscountModeChange={setDiscountMode}
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
        <button
          type="button"
          className="copy-btn"
          disabled={items.length === 0}
          onClick={handleCopy}
        >
          {copied ? 'コピーしました' : '内訳をコピー'}
        </button>
      </footer>
    </div>
  )
}

export default App
