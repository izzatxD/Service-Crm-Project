import { useMemo, useState, type FormEvent } from 'react'

import { useAuth } from '../auth/AuthContext'
import { hasPermission } from '../auth/access'
import WorkspaceLayout from '../components/WorkspaceLayout'
import { useWorkspaceSelection } from '../hooks/useWorkspaceSelection'
import { useExpenseCategories, useCreateExpense, useExpenses } from '../hooks/useExpenses'
import { useOrders } from '../hooks/useOrders'
import { useCreatePayment, usePaymentMethods } from '../hooks/usePayments'
import { useToast } from '../hooks/useToast'
import { useWorkspaceSection } from '../hooks/useWorkspaceSection'
import { formatDateTime, formatMoney } from '../lib/format'
import { getPaymentMethodLabel } from '../lib/labels'

type ExpensePeriod = 'today' | '7day' | 'month' | 'all'

const PAYMENT_SECTIONS = ['debtors', 'expenses'] as const
const PAYMENT_DEBTOR_SECTION = ['debtors'] as const
const PAYMENT_EXPENSE_SECTION = ['expenses'] as const

function isInPeriod(dateStr: string, period: ExpensePeriod) {
  if (period === 'all') return true
  const date = new Date(dateStr)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (period === 'today') return date >= today
  if (period === '7day') {
    const ago = new Date(today)
    ago.setDate(ago.getDate() - 7)
    return date >= ago
  }
  if (period === 'month') {
    const ago = new Date(today)
    ago.setDate(1)
    return date >= ago
  }
  return true
}

function RefreshIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  )
}

function getOrderDebt(order: {
  financial: {
    balanceDueAmount: string | number
    paidTotalAmount: string | number
    grandTotalAmount: string | number
  } | null
}) {
  return {
    debt: Number(order.financial?.balanceDueAmount ?? 0),
    paid: Number(order.financial?.paidTotalAmount ?? 0),
    total: Number(order.financial?.grandTotalAmount ?? 0),
  }
}

function PaymentsPage() {
  const { auth } = useAuth()
  const token = auth?.accessToken ?? ''
  const canReadPayments = hasPermission(auth, 'payment.read')
  const canCreatePayment = hasPermission(auth, 'payment.create')
  const canCreateExpense = hasPermission(auth, 'expense.create')
  const canAccessPaymentFlow = canReadPayments || canCreatePayment
  const { toast } = useToast()
  const { organizationId, branchId } = useWorkspaceSelection()

  const [expensePeriod, setExpensePeriod] = useState<ExpensePeriod>('7day')
  const [selectedOrderId, setSelectedOrderId] = useState('')
  const [showPayForm, setShowPayForm] = useState(false)
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [payForm, setPayForm] = useState({
    paymentMethodCode: 'cash',
    amount: '',
    note: '',
  })
  const [expenseForm, setExpenseForm] = useState({
    title: '',
    amount: '',
    expenseCategoryId: '',
    note: '',
  })

  const { data: orders = [], refetch: ordersRefetch } = useOrders(token, organizationId, canAccessPaymentFlow)
  const { data: methods = [] } = usePaymentMethods(token, organizationId, canAccessPaymentFlow)
  const { data: expenses = [], isLoading: expLoading, refetch: expensesRefetch } = useExpenses(token, organizationId, canCreateExpense)
  const { data: categories = [] } = useExpenseCategories(token, organizationId, canCreateExpense)

  const createPayment = useCreatePayment(token)
  const createExpense = useCreateExpense(token, organizationId)

  const currentStaffMember = useMemo(() => {
    return auth?.me?.staffMembers.find((member) => member.organizationId === organizationId) ?? null
  }, [auth?.me?.staffMembers, organizationId])

  const { activeSection } = useWorkspaceSection(
    canAccessPaymentFlow && canCreateExpense
      ? PAYMENT_SECTIONS
      : canAccessPaymentFlow
        ? PAYMENT_DEBTOR_SECTION
        : PAYMENT_EXPENSE_SECTION,
    canAccessPaymentFlow ? 'debtors' : 'expenses',
  )

  const scopedOrders = useMemo(() => {
    if (!branchId) {
      return orders
    }

    return orders.filter((order) => order.branch.id === branchId)
  }, [branchId, orders])

  const scopedExpenses = useMemo(() => {
    if (!branchId) {
      return expenses
    }

    return expenses.filter((expense) => expense.branch?.id === branchId)
  }, [branchId, expenses])

  const debtors = useMemo(() => {
    return scopedOrders.filter((order) => Number(order.financial?.balanceDueAmount ?? 0) > 0)
  }, [scopedOrders])

  const debtSummary = useMemo(() => {
    const debtorCount = debtors.length
    const fullyPaidCount = scopedOrders.filter(
      (order) => Number(order.financial?.balanceDueAmount ?? 0) <= 0.01,
    ).length
    const overdueOrderCount = debtors.filter(
      (order) => Number(order.financial?.paidTotalAmount ?? 0) > 0,
    ).length

    return {
      debtorCount,
      fullyPaidCount,
      overdueOrderCount,
    }
  }, [debtors, scopedOrders])

  const totalDebt = useMemo(() => {
    return debtors.reduce((sum, order) => sum + Number(order.financial?.balanceDueAmount ?? 0), 0)
  }, [debtors])

  const filteredExpenses = useMemo(() => {
    return scopedExpenses.filter((expense) => isInPeriod(expense.expenseDate, expensePeriod))
  }, [expensePeriod, scopedExpenses])

  const expenseTotal = useMemo(() => {
    return filteredExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0)
  }, [filteredExpenses])

  async function handlePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedOrderId) {
      toast('Zakaz tanlanmagan.', 'error')
      return
    }
    if (!payForm.amount) {
      toast('Summani kiriting.', 'error')
      return
    }

    const selectedOrder = debtors.find((order) => order.id === selectedOrderId)
    const maxDebt = Number(selectedOrder?.financial?.balanceDueAmount ?? 0)
    if (Number(payForm.amount) <= 0) {
      toast("To'lov summasi 0 dan katta bo'lishi kerak.", 'error')
      return
    }
    if (maxDebt > 0 && Number(payForm.amount) - maxDebt > 0.01) {
      toast("To'lov summasi qolgan qarzdan oshib ketmasin.", 'error')
      return
    }

    try {
      await createPayment.mutateAsync({
        organizationId,
        orderId: selectedOrderId,
        paymentMethodCode: payForm.paymentMethodCode as 'cash' | 'card' | 'bank_transfer' | 'online' | 'other',
        amount: Number(payForm.amount),
        paidAt: new Date().toISOString(),
        receivedByStaffId: currentStaffMember?.id,
        note: payForm.note || undefined,
      })
      setPayForm({ paymentMethodCode: 'cash', amount: '', note: '' })
      setShowPayForm(false)
      setSelectedOrderId('')
      toast("To'lov qabul qilindi.", 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : "To'lov yozilmadi.", 'error')
    }
  }

  async function handleExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!organizationId) {
      toast('Avval firma tanlang.', 'error')
      return
    }
    if (!expenseForm.title.trim()) {
      toast('Xarajat nomini kiriting.', 'error')
      return
    }
    if (!expenseForm.amount) {
      toast('Summani kiriting.', 'error')
      return
    }
    if (!expenseForm.expenseCategoryId) {
      toast('Kategoriya tanlang.', 'error')
      return
    }

    try {
      await createExpense.mutateAsync({
        organizationId,
        branchId: branchId || undefined,
        expenseCategoryId: expenseForm.expenseCategoryId,
        title: expenseForm.title,
        amount: Number(expenseForm.amount),
        expenseDate: new Date().toISOString(),
        note: expenseForm.note || undefined,
      })
      setExpenseForm({ title: '', amount: '', expenseCategoryId: '', note: '' })
      setShowExpenseForm(false)
      toast('Xarajat yozildi.', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Xarajat yozilmadi.', 'error')
    }
  }

  return (
    <WorkspaceLayout>
      <div className="bot-topbar">
        <div className="bot-topbar-left">
          <div className="bot-topbar-title">Moliya</div>
          <div className="bot-topbar-subtitle">Qarzlar va xarajatlar</div>
        </div>
        <div className="bot-topbar-actions">
          <button
            className="icon-round-btn"
            onClick={() => {
              ordersRefetch()
              expensesRefetch()
            }}
            title="Yangilash"
          >
            <RefreshIcon />
          </button>
        </div>
      </div>

      {!canAccessPaymentFlow && !canCreateExpense ? (
        <div className="empty-state">
          <div className="empty-state-icon">#</div>
          <strong>Bu bo'lim siz uchun yopiq</strong>
          <p>Ruxsat berilgan sahifa yoki rol bilan qayta kiring.</p>
        </div>
      ) : activeSection === 'debtors' && canAccessPaymentFlow ? (
        <section id="debtors">
          <section className="workspace-summary-grid">
            <article className="workspace-summary-card">
              <span>Qarzdor order</span>
              <strong>{debtSummary.debtorCount}</strong>
              <p>Balansida qarz qolgan buyurtmalar</p>
            </article>
            <article className="workspace-summary-card">
              <span>To'liq yopilgan</span>
              <strong>{debtSummary.fullyPaidCount}</strong>
              <p>Tanlangan scope ichida yopilgan orderlar</p>
            </article>
            <article className="workspace-summary-card">
              <span>Qisman to'langan</span>
              <strong>{debtSummary.overdueOrderCount}</strong>
              <p>Avans olingan, lekin qarzi qolganlar</p>
            </article>
            <article className="workspace-summary-card">
              <span>Jami qarz</span>
              <strong>{formatMoney(totalDebt)}</strong>
              <p>Undirilmagan summa</p>
            </article>
          </section>

          {debtors.length > 0 && (
            <div className="finance-total-card">
              <div className="finance-total-label">Mijozlardagi jami qarz</div>
              <div className="finance-total-amount">{formatMoney(totalDebt)}</div>
            </div>
          )}

          {debtors.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon">#</div>
              <strong>Qarzdor yo'q</strong>
              <p>Barcha zakazlar to'liq to'langan</p>
            </div>
          )}

          {debtors.map((order) => {
            const { debt, paid, total } = getOrderDebt(order)
            const isSelected = selectedOrderId === order.id

            return (
              <div key={order.id} className="debtor-card">
                <div className="debtor-name">{order.client.fullName}</div>
                {order.client.phone ? <div className="debtor-phone">{order.client.phone}</div> : null}
                <div className="debtor-car-row">
                  <span className="car-chip">{order.asset.displayName}</span>
                  <span className="car-chip">#{order.orderNumber}</span>
                </div>
                <div className="debtor-amounts">
                  <div className="debtor-debt-info">
                    <div className="debtor-debt-amount">{formatMoney(debt)}</div>
                    <div className="debtor-debt-label">QOLGAN QARZ</div>
                  </div>
                  <div className="debtor-paid-text">{formatMoney(paid)} / {formatMoney(total)} to'langan</div>
                </div>

                {canCreatePayment && (
                  <>
                    <button
                      className="accept-btn"
                      onClick={() => {
                        setSelectedOrderId(isSelected ? '' : order.id)
                        setShowPayForm(isSelected ? false : true)
                      }}
                    >
                      {isSelected ? 'Yopish' : "Qarzni qabul qilish"}
                    </button>

                    {isSelected && showPayForm && (
                      <form onSubmit={handlePayment} className="payments-form-block">
                        <div className="workspace-form-grid">
                          <label className="field">
                            <span>To'lov turi</span>
                            <select
                              value={payForm.paymentMethodCode}
                              onChange={(event) => setPayForm((current) => ({ ...current, paymentMethodCode: event.target.value }))}
                            >
                              {methods.length > 0 ? (
                                methods.map((method) => (
                                  <option key={method.id} value={method.paymentMethodCode}>
                                    {getPaymentMethodLabel(method.paymentMethodCode)}
                                  </option>
                                ))
                              ) : (
                                <>
                                  <option value="cash">Naqd</option>
                                  <option value="card">Karta</option>
                                  <option value="bank_transfer">Bank o'tkazma</option>
                                </>
                              )}
                            </select>
                          </label>
                          <label className="field">
                            <span>Summa</span>
                            <input
                              type="number"
                              value={payForm.amount}
                              onChange={(event) => setPayForm((current) => ({ ...current, amount: event.target.value }))}
                              placeholder={formatMoney(debt)}
                              required
                            />
                          </label>
                        </div>
                        <div className="task-action-row">
                          <button
                            type="button"
                            className="task-action-btn"
                            onClick={() => setPayForm((current) => ({ ...current, amount: String(Math.round(debt)) }))}
                          >
                            To'liq yopish
                          </button>
                          <button
                            type="button"
                            className="task-action-btn"
                            onClick={() => setPayForm((current) => ({ ...current, amount: String(Math.round(debt / 2)) }))}
                          >
                            50%
                          </button>
                        </div>
                        <label className="field">
                          <span>Izoh</span>
                          <input
                            value={payForm.note}
                            onChange={(event) => setPayForm((current) => ({ ...current, note: event.target.value }))}
                            placeholder="Ixtiyoriy"
                          />
                        </label>
                        <button className="primary-btn" disabled={createPayment.isPending}>
                          {createPayment.isPending ? 'Saqlanmoqda...' : "To'lovni tasdiqlash"}
                        </button>
                      </form>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </section>
      ) : activeSection === 'expenses' && canCreateExpense ? (
        <section id="expenses">
          <section className="workspace-summary-grid">
            <article className="workspace-summary-card">
              <span>Tanlangan davr</span>
              <strong>{filteredExpenses.length}</strong>
              <p>Chiqim operatsiyalari soni</p>
            </article>
            <article className="workspace-summary-card">
              <span>Jami chiqim</span>
              <strong>{formatMoney(expenseTotal)}</strong>
              <p>Filter bo'yicha sarf xarajat</p>
            </article>
          </section>

          <div className="filter-chips">
            {(['today', '7day', 'month', 'all'] as ExpensePeriod[]).map((period) => (
              <button
                key={period}
                className={`filter-chip${expensePeriod === period ? ' is-active' : ''}`}
                onClick={() => setExpensePeriod(period)}
              >
                {period === 'today' ? 'BUGUN' : period === '7day' ? '7 KUN' : period === 'month' ? 'SHU OY' : 'JAMI'}
              </button>
            ))}
          </div>

          {expLoading ? (
            <div className="loading-state">
              <div className="loading-spinner" />
              <span>Yuklanmoqda...</span>
            </div>
          ) : (
            <>
              {filteredExpenses.map((expense) => (
                <div key={expense.id} className="expense-item">
                  <div className="expense-icon">-</div>
                  <div className="expense-info">
                    <div className="expense-name">{expense.title}</div>
                    <div className="expense-date">{formatDateTime(expense.expenseDate)}</div>
                  </div>
                  <div className="expense-right">
                    <div className="expense-amount">-{formatMoney(expense.amount)}</div>
                    <div className="expense-actions">
                      <button className="icon-action-btn" title="Kategoriya">
                        #
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {filteredExpenses.length === 0 && (
                <div className="empty-state">
                  <div className="empty-state-icon">#</div>
                  <strong>Xarajat yo'q</strong>
                  <p>Bu davr uchun xarajat topilmadi</p>
                </div>
              )}

              {filteredExpenses.length > 0 && (
                <div className="expense-summary-card">
                  <div className="expense-summary-label">Tanlangan davr chiqimi</div>
                  <div className="expense-summary-amount">-{formatMoney(expenseTotal)}</div>
                  <div className="expense-summary-count">{filteredExpenses.length} ta operatsiya</div>
                </div>
              )}
            </>
          )}

          <div className="payments-expense-wrap">
            {!showExpenseForm ? (
              <button className="ghost-btn" onClick={() => setShowExpenseForm(true)}>
                + Yangi xarajat qo'shish
              </button>
            ) : (
              <div className="panel payments-inline-panel">
                <div className="panel-head">
                  <div>
                    <p className="eyebrow">Yangi xarajat</p>
                    <h3>Chiqim yozish</h3>
                  </div>
                  <button className="icon-round-btn" onClick={() => setShowExpenseForm(false)}>x</button>
                </div>
                <form onSubmit={handleExpense} className="workspace-form-stack">
                  <label className="field">
                    <span>Nomi</span>
                    <input
                      value={expenseForm.title}
                      onChange={(event) => setExpenseForm((current) => ({ ...current, title: event.target.value }))}
                      placeholder="Masalan: Moy xarajati"
                      required
                    />
                  </label>
                  <div className="workspace-form-grid">
                    <label className="field">
                      <span>Summa</span>
                      <input
                        type="number"
                        value={expenseForm.amount}
                        onChange={(event) => setExpenseForm((current) => ({ ...current, amount: event.target.value }))}
                        placeholder="100000"
                        required
                      />
                    </label>
                    <label className="field">
                      <span>Kategoriya</span>
                      <select
                        value={expenseForm.expenseCategoryId}
                        onChange={(event) => setExpenseForm((current) => ({ ...current, expenseCategoryId: event.target.value }))}
                        required
                      >
                        <option value="">Tanlang</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>{category.name}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label className="field">
                    <span>Izoh</span>
                    <input
                      value={expenseForm.note}
                      onChange={(event) => setExpenseForm((current) => ({ ...current, note: event.target.value }))}
                      placeholder="Ixtiyoriy"
                    />
                  </label>
                  <button className="primary-btn" disabled={createExpense.isPending}>
                    {createExpense.isPending ? 'Saqlanmoqda...' : 'Xarajatni saqlash'}
                  </button>
                </form>
              </div>
            )}
          </div>
        </section>
      ) : null}

      <div className="payments-bottom-space" />
    </WorkspaceLayout>
  )
}

export default PaymentsPage
