import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type ReviewStatus = 'unreviewed' | 'business' | 'personal'
type View = 'dashboard' | 'swipe' | 'ledger' | 'scheduleC' | 'settings'

interface UserProfile {
  name: string
  email: string
  profession: string
}

interface ReminderSettings {
  enabled: boolean
  weekday: number
  hour: number
}

interface Transaction {
  id: string
  date: string
  merchant: string
  amount: number
  suggestedCategory: ScheduleCId
  note: string
  reviewStatus: ReviewStatus
  reviewedAt?: string
}

interface AppState {
  user: UserProfile | null
  bankConnected: boolean
  transactions: Transaction[]
  lastBankSync: string | null
  reminder: ReminderSettings
}

const STORAGE_KEY = 'swipe-writeoff-state-v1'
const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const scheduleCCategories = [
  { id: 'advertising', label: 'Advertising', line: '8' },
  { id: 'car', label: 'Car and truck expenses', line: '9' },
  { id: 'commissions', label: 'Commissions and fees', line: '10' },
  { id: 'insurance', label: 'Insurance', line: '15' },
  { id: 'legal', label: 'Legal and professional services', line: '17' },
  { id: 'office', label: 'Office expenses', line: '18' },
  { id: 'rent', label: 'Rent / lease', line: '20b' },
  { id: 'supplies', label: 'Supplies', line: '22' },
  { id: 'travel', label: 'Travel / meals', line: '24a' },
  { id: 'utilities', label: 'Utilities', line: '25' },
] as const

type ScheduleCId = (typeof scheduleCCategories)[number]['id']

const sampleTransactions: Transaction[] = [
  { id: 'txn_001', date: '2026-04-18', merchant: 'Delta Airlines', amount: 428.53, suggestedCategory: 'travel', note: 'Client visit to Phoenix', reviewStatus: 'unreviewed' },
  { id: 'txn_002', date: '2026-04-17', merchant: 'Adobe Creative Cloud', amount: 59.99, suggestedCategory: 'supplies', note: 'Monthly software subscription', reviewStatus: 'unreviewed' },
  { id: 'txn_003', date: '2026-04-16', merchant: 'Shell Fuel', amount: 82.14, suggestedCategory: 'car', note: 'Mileage for contractor work', reviewStatus: 'unreviewed' },
  { id: 'txn_004', date: '2026-04-15', merchant: 'Whole Foods', amount: 123.34, suggestedCategory: 'supplies', note: 'Personal groceries', reviewStatus: 'unreviewed' },
  { id: 'txn_005', date: '2026-04-14', merchant: 'WeWork', amount: 310.0, suggestedCategory: 'rent', note: 'Co-working membership', reviewStatus: 'unreviewed' },
  { id: 'txn_006', date: '2026-04-13', merchant: 'AT&T', amount: 95.42, suggestedCategory: 'utilities', note: 'Business phone plan', reviewStatus: 'unreviewed' },
  { id: 'txn_007', date: '2026-04-12', merchant: 'Chipotle', amount: 16.88, suggestedCategory: 'travel', note: 'Personal lunch', reviewStatus: 'unreviewed' },
  { id: 'txn_008', date: '2026-04-11', merchant: 'QuickBooks Online', amount: 30.0, suggestedCategory: 'office', note: 'Bookkeeping software', reviewStatus: 'unreviewed' },
]

const defaultState: AppState = {
  user: null,
  bankConnected: false,
  transactions: [],
  lastBankSync: null,
  reminder: {
    enabled: true,
    weekday: 1,
    hour: 9,
  },
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

const nextReminderDate = (settings: ReminderSettings) => {
  const now = new Date()
  const next = new Date(now)
  next.setHours(settings.hour, 0, 0, 0)
  const dayDelta = (settings.weekday - now.getDay() + 7) % 7
  next.setDate(now.getDate() + dayDelta)

  if (next <= now) {
    next.setDate(next.getDate() + 7)
  }

  return next
}

function App() {
  const [appState, setAppState] = useState<AppState>(() => {
    const persisted = localStorage.getItem(STORAGE_KEY)
    if (!persisted) {
      return defaultState
    }

    try {
      return JSON.parse(persisted) as AppState
    } catch {
      return defaultState
    }
  })
  const [activeView, setActiveView] = useState<View>('dashboard')
  const [loadingBank, setLoadingBank] = useState(false)
  const [swipeClass, setSwipeClass] = useState<'swipe-left' | 'swipe-right' | ''>('')
  const swipeTimerRef = useRef<number | null>(null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState))
  }, [appState])

  useEffect(() => () => {
    if (swipeTimerRef.current) {
      window.clearTimeout(swipeTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!appState.reminder.enabled) {
      return
    }

    const reminderDate = nextReminderDate(appState.reminder)
    const delay = Math.min(reminderDate.getTime() - Date.now(), 2_147_000_000)
    const timeout = window.setTimeout(() => {
      if (Notification.permission === 'granted') {
        new Notification('SwipeWriteOff reminder', {
          body: "You've got transactions waiting to be reviewed.",
        })
      }
    }, Math.max(delay, 0))

    return () => window.clearTimeout(timeout)
  }, [appState.reminder])

  const unreviewedTransactions = useMemo(
    () => appState.transactions.filter((transaction) => transaction.reviewStatus === 'unreviewed'),
    [appState.transactions],
  )
  const businessTransactions = useMemo(
    () => appState.transactions.filter((transaction) => transaction.reviewStatus === 'business'),
    [appState.transactions],
  )
  const personalTransactions = useMemo(
    () => appState.transactions.filter((transaction) => transaction.reviewStatus === 'personal'),
    [appState.transactions],
  )

  const currentTransaction = unreviewedTransactions[0]
  const reviewedCount = appState.transactions.length - unreviewedTransactions.length
  const businessTotal = businessTransactions.reduce((sum, transaction) => sum + transaction.amount, 0)
  const estimatedTaxSavings = businessTotal * 0.24
  const weeklyReviewGoal = 15
  const progressToGoal = Math.min(Math.round((reviewedCount / weeklyReviewGoal) * 100), 100)
  const scheduleCSummary = scheduleCCategories.map((category) => {
    const categoryTransactions = businessTransactions.filter(
      (transaction) => transaction.suggestedCategory === category.id,
    )
    const total = categoryTransactions.reduce((sum, transaction) => sum + transaction.amount, 0)

    return {
      ...category,
      count: categoryTransactions.length,
      total,
    }
  })
  const sortedUnreviewedByDate = [...unreviewedTransactions].sort((a, b) =>
    b.date.localeCompare(a.date),
  )
  const topUnreviewedAmount = sortedUnreviewedByDate.slice(0, 5).reduce((sum, item) => sum + item.amount, 0)

  const handleBankConnection = () => {
    setLoadingBank(true)
    window.setTimeout(() => {
      setAppState((previous) => {
        const knownIds = new Set(previous.transactions.map((transaction) => transaction.id))
        const imported = sampleTransactions.filter((transaction) => !knownIds.has(transaction.id))

        return {
          ...previous,
          bankConnected: true,
          transactions: [...imported, ...previous.transactions].sort((a, b) => b.date.localeCompare(a.date)),
          lastBankSync: new Date().toISOString(),
        }
      })
      setLoadingBank(false)
    }, 700)
  }

  const setReviewStatus = useCallback((transactionId: string, reviewStatus: ReviewStatus) => {
    setAppState((previous) => ({
      ...previous,
      transactions: previous.transactions.map((transaction) =>
        transaction.id === transactionId
          ? { ...transaction, reviewStatus, reviewedAt: new Date().toISOString() }
          : transaction,
      ),
    }))
  }, [])

  const setCategory = useCallback((transactionId: string, suggestedCategory: ScheduleCId) => {
    setAppState((previous) => ({
      ...previous,
      transactions: previous.transactions.map((transaction) =>
        transaction.id === transactionId ? { ...transaction, suggestedCategory } : transaction,
      ),
    }))
  }, [])

  const handleSwipe = useCallback((reviewStatus: Exclude<ReviewStatus, 'unreviewed'>) => {
    if (!currentTransaction) {
      return
    }

    setSwipeClass(reviewStatus === 'business' ? 'swipe-right' : 'swipe-left')
    if (swipeTimerRef.current) {
      window.clearTimeout(swipeTimerRef.current)
    }
    swipeTimerRef.current = window.setTimeout(() => {
      setReviewStatus(currentTransaction.id, reviewStatus)
      setSwipeClass('')
    }, 220)
  }, [currentTransaction, setReviewStatus])

  const handleUndoToQueue = useCallback((transactionId: string) => {
    setReviewStatus(transactionId, 'unreviewed')
  }, [setReviewStatus])

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (activeView !== 'swipe') {
        return
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        handleSwipe('personal')
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        handleSwipe('business')
      }
    }

    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [activeView, handleSwipe])

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      return
    }
    await Notification.requestPermission()
  }

  const sendTestNotification = () => {
    if (Notification.permission === 'granted') {
      new Notification('Time to classify this week’s expenses', {
        body: 'Open SwipeWriteOff and clear your unreviewed queue in under 5 minutes.',
      })
    }
  }

  const updateReminder = <K extends keyof ReminderSettings>(key: K, value: ReminderSettings[K]) => {
    setAppState((previous) => ({
      ...previous,
      reminder: {
        ...previous.reminder,
        [key]: value,
      },
    }))
  }

  const createAccount = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const name = String(formData.get('name') ?? '').trim()
    const email = String(formData.get('email') ?? '').trim()
    const profession = String(formData.get('profession') ?? '').trim()
    if (!name || !email || !profession) {
      return
    }

    setAppState((previous) => ({
      ...previous,
      user: { name, email, profession },
    }))
    setActiveView('dashboard')
  }

  const renderLedgerSection = (title: string, transactions: Transaction[], emptyMessage: string) => (
    <section className="repository">
      <header>
        <h3>{title}</h3>
        <span>{transactions.length} transactions</span>
      </header>
      {transactions.length === 0 ? (
        <p className="empty-state">{emptyMessage}</p>
      ) : (
        <ul className="transaction-list">
          {transactions.map((transaction) => (
            <li key={transaction.id}>
              <div>
                <strong>{transaction.merchant}</strong>
                <p>{transaction.note}</p>
                <small>{formatDate(transaction.date)}</small>
              </div>
              <div className="transaction-actions">
                <span>{formatCurrency(transaction.amount)}</span>
                <label className="category-select">
                  Category
                  <select
                    value={transaction.suggestedCategory}
                    onChange={(event) => setCategory(transaction.id, event.target.value as ScheduleCId)}
                  >
                    {scheduleCCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </label>
                {transaction.reviewStatus !== 'business' && (
                  <button type="button" onClick={() => setReviewStatus(transaction.id, 'business')}>
                    Move to Business
                  </button>
                )}
                {transaction.reviewStatus !== 'personal' && (
                  <button type="button" onClick={() => setReviewStatus(transaction.id, 'personal')}>
                    Move to Personal
                  </button>
                )}
                {transaction.reviewStatus !== 'unreviewed' && (
                  <button type="button" onClick={() => handleUndoToQueue(transaction.id)}>
                    Send to Queue
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )

  if (!appState.user) {
    return (
      <main className="shell onboarding-shell">
        <section className="onboarding-card">
          <p className="eyebrow">SwipeWriteOff</p>
          <h1>Tinder-style tax write-off tracking for 1099 workers</h1>
          <p className="description">
            Connect your account, review transactions in seconds, and keep your Schedule C organized all year.
          </p>
          <ul>
            <li>Swipe right for business expenses</li>
            <li>Swipe left for personal spending</li>
            <li>Reclassify anything at any time</li>
            <li>Preview your Schedule C totals automatically</li>
          </ul>
          <form onSubmit={createAccount}>
            <label>
              Full name
              <input name="name" required />
            </label>
            <label>
              Email
              <input name="email" type="email" required />
            </label>
            <label>
              Profession / 1099 role
              <input name="profession" required placeholder="Photographer, real estate agent, etc." />
            </label>
            <button type="submit">Create account</button>
          </form>
        </section>
      </main>
    )
  }

  return (
    <main className="shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Welcome back, {appState.user.name}</p>
          <h1>1099 Expense Organizer</h1>
          <p className="description">
            {appState.bankConnected
              ? `${unreviewedTransactions.length} transactions waiting for review`
              : 'Connect your bank to start importing transactions.'}
          </p>
        </div>
        <button type="button" className="bank-button" onClick={handleBankConnection} disabled={loadingBank}>
          {loadingBank ? 'Syncing...' : appState.bankConnected ? 'Sync bank transactions' : 'Connect bank'}
        </button>
      </header>

      <nav className="navigation">
        {[
          ['dashboard', 'Dashboard'],
          ['swipe', 'Swipe Queue'],
          ['ledger', 'Repository'],
          ['scheduleC', 'Schedule C'],
          ['settings', 'Reminders'],
        ].map(([view, label]) => (
          <button
            key={view}
            type="button"
            className={activeView === view ? 'active' : ''}
            onClick={() => setActiveView(view as View)}
          >
            {label}
          </button>
        ))}
      </nav>

      {activeView === 'dashboard' && (
        <section className="view dashboard">
          <div className="stat-grid">
            <article>
              <h2>{appState.transactions.length}</h2>
              <p>Total imported transactions</p>
            </article>
            <article>
              <h2>{reviewedCount}</h2>
              <p>Classified this cycle</p>
            </article>
            <article>
              <h2>{formatCurrency(businessTotal)}</h2>
              <p>Potential Schedule C deductions</p>
            </article>
            <article>
              <h2>{formatCurrency(estimatedTaxSavings)}</h2>
              <p>Estimated tax savings (24%)</p>
            </article>
          </div>

          <article className="goal-card">
            <header>
              <h3>Weekly review progress</h3>
              <strong>{progressToGoal}%</strong>
            </header>
            <div className="progress-track">
              <span style={{ width: `${progressToGoal}%` }}></span>
            </div>
            <p>
              You reviewed {reviewedCount} out of {weeklyReviewGoal} target transactions.
            </p>
          </article>

          <article className="quick-summary">
            <h3>Current queue snapshot</h3>
            <p>
              Top 5 unreviewed transactions total <strong>{formatCurrency(topUnreviewedAmount)}</strong>.
            </p>
            <ul>
              {sortedUnreviewedByDate.slice(0, 5).map((transaction) => (
                <li key={transaction.id}>
                  <span>{transaction.merchant}</span>
                  <span>{formatCurrency(transaction.amount)}</span>
                </li>
              ))}
            </ul>
          </article>
        </section>
      )}

      {activeView === 'swipe' && (
        <section className="view">
          {!appState.bankConnected && (
            <p className="empty-state">
              Connect your bank first to load transactions into your swipe queue.
            </p>
          )}
          {appState.bankConnected && !currentTransaction && (
            <p className="empty-state">
              Queue complete. Sync more transactions or revisit your repository to reclassify entries.
            </p>
          )}
          {currentTransaction && (
            <article className={`swipe-card ${swipeClass}`}>
              <p className="pill">{formatDate(currentTransaction.date)}</p>
              <h2>{currentTransaction.merchant}</h2>
              <p className="amount">{formatCurrency(currentTransaction.amount)}</p>
              <p>{currentTransaction.note}</p>
              <small>
                Suggested Schedule C bucket:{' '}
                {
                  scheduleCCategories.find(
                    (category) => category.id === currentTransaction.suggestedCategory,
                  )?.label
                }
              </small>
              <div className="swipe-actions">
                <button type="button" className="decline" onClick={() => handleSwipe('personal')}>
                  Swipe left: Personal
                </button>
                <button type="button" className="accept" onClick={() => handleSwipe('business')}>
                  Swipe right: Business
                </button>
              </div>
              <p className="helper">Tip: use keyboard arrows ⬅ and ➡ to classify quickly.</p>
            </article>
          )}
        </section>
      )}

      {activeView === 'ledger' && (
        <section className="view ledger-view">
          {renderLedgerSection(
            'Business expense repository',
            businessTransactions,
            'No business expenses classified yet.',
          )}
          {renderLedgerSection(
            'Personal expense repository',
            personalTransactions,
            'No personal expenses classified yet.',
          )}
          {renderLedgerSection(
            'Unreviewed queue',
            unreviewedTransactions,
            'Everything has been classified.',
          )}
        </section>
      )}

      {activeView === 'scheduleC' && (
        <section className="view schedule-view">
          <article className="form-preview">
            <header>
              <p className="eyebrow">Visual Schedule C preview</p>
              <h2>Profit or Loss From Business (Draft)</h2>
              <p>Generated from your right-swiped transactions.</p>
            </header>
            <table>
              <thead>
                <tr>
                  <th>Line</th>
                  <th>Category</th>
                  <th>Transactions</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {scheduleCSummary.map((item) => (
                  <tr key={item.id}>
                    <td>{item.line}</td>
                    <td>{item.label}</td>
                    <td>{item.count}</td>
                    <td>{formatCurrency(item.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>Total deductible expenses</td>
                  <td>{formatCurrency(businessTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </article>
        </section>
      )}

      {activeView === 'settings' && (
        <section className="view settings-view">
          <article className="settings-card">
            <h2>Reminder notifications</h2>
            <p>Set a weekly check-in cadence so tax prep never piles up.</p>
            <label className="toggle">
              <input
                type="checkbox"
                checked={appState.reminder.enabled}
                onChange={(event) => updateReminder('enabled', event.target.checked)}
              />
              Enable weekly reminder
            </label>
            <div className="settings-grid">
              <label>
                Day of week
                <select
                  value={appState.reminder.weekday}
                  onChange={(event) => updateReminder('weekday', Number(event.target.value))}
                >
                  {WEEKDAY_LABELS.map((day, index) => (
                    <option key={day} value={index}>
                      {day}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Hour (24h)
                <input
                  min={0}
                  max={23}
                  type="number"
                  value={appState.reminder.hour}
                  onChange={(event) =>
                    updateReminder('hour', Math.max(0, Math.min(23, Number(event.target.value) || 0)))
                  }
                />
              </label>
            </div>
            <p className="next-reminder">
              Next reminder: {nextReminderDate(appState.reminder).toLocaleString()}
            </p>
            <div className="settings-actions">
              <button type="button" onClick={requestNotificationPermission}>
                Request browser permission
              </button>
              <button type="button" onClick={sendTestNotification}>
                Send test reminder
              </button>
            </div>
          </article>
          <article className="settings-card">
            <h2>Bank sync</h2>
            <p>
              Current mode uses sample data to simulate a Plaid-style account connection. Replace this connection
              method with your preferred banking provider in production.
            </p>
            <p>
              Last synced:{' '}
              {appState.lastBankSync ? formatDate(appState.lastBankSync) : 'No sync performed yet'}
            </p>
          </article>
        </section>
      )}
    </main>
  )
}

export default App
