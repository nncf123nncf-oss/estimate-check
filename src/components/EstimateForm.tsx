import { useState } from 'react'
import { validateItemInput } from '../utils/calculation'

interface Props {
  onAdd: (name: string, quantity: number, unitPrice: number) => void
}

/**
 * 項目追加行（設計仕様 4章③）。
 * 項目追加がこの道具の主操作なので、ボタンの奥にしまわず常に開いておく。
 * モバイルでは項目名がフル幅、数量・単価・追加ボタンが次の行に折り返す。
 */
export function EstimateForm({ onAdd }: Props) {
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unitPrice, setUnitPrice] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const result = validateItemInput(name, quantity, unitPrice)
    setErrors(result.errors)
    if (!result.ok) return

    onAdd(name.trim(), Number(quantity), Number(unitPrice))
    setName('')
    setQuantity('1')
    setUnitPrice('')
    setErrors({})
  }

  return (
    <form className="add-form" onSubmit={handleSubmit} noValidate>
      <div className="add-row">
        <input
          className={`add-name${errors.name ? ' is-error' : ''}`}
          type="text"
          value={name}
          placeholder="項目名（例: ホームページ制作一式）"
          aria-label="項目名"
          aria-invalid={errors.name ? true : undefined}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="add-nums">
          <input
            className={`add-qty${errors.quantity ? ' is-error' : ''}`}
            type="text"
            inputMode="numeric"
            value={quantity}
            placeholder="数量"
            aria-label="数量"
            aria-invalid={errors.quantity ? true : undefined}
            onChange={(e) => setQuantity(e.target.value)}
          />
          <input
            className={`add-price${errors.unitPrice ? ' is-error' : ''}`}
            type="text"
            inputMode="numeric"
            value={unitPrice}
            placeholder="単価"
            aria-label="単価"
            aria-invalid={errors.unitPrice ? true : undefined}
            onChange={(e) => setUnitPrice(e.target.value)}
          />
          <button type="submit" className="add-btn">
            ＋ 追加
          </button>
        </div>
      </div>

      {(errors.name || errors.quantity || errors.unitPrice) && (
        <ul className="add-errors" role="alert">
          {errors.name && <li>{errors.name}</li>}
          {errors.quantity && <li>{errors.quantity}</li>}
          {errors.unitPrice && <li>{errors.unitPrice}</li>}
        </ul>
      )}
    </form>
  )
}
