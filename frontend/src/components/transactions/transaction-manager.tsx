
import type React from "react"

import { useState, useEffect } from "react"
import { useSearchParams } from "react-router-dom"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Pencil, Plus, Search, Trash2 } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { CurrencyInput, parseCurrencyValue } from "@/components/transactions/currency-input"
import { CategoryManager } from "@/components/transactions/category-manager"
import { ReceiptCapture } from "@/components/transactions/receipt-capture"
import {
  fetchTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  fetchCategories,
  uploadReceipt,
} from "@/lib/api-client"
import type { ReceiptExtraction, Transaction } from "@/lib/api-client"
import { getReceiptUrl, getReceiptThumbUrl } from "@/lib/api-client"
import { formatDatePtBR, getMonthIndex, getYear } from "@/lib/dates"
import { categoriesMatch } from "@/lib/categories"
import { findDuplicateTransactions } from "@/lib/duplicates"
import { MONTHS, money } from "@/lib/finance"
import { cn } from "@/lib/utils"

interface TransactionManagerProps {
  type: "receita" | "despesa"
}

const labels = {
  receita: {
    title: "Receitas",
    singular: "Receita",
    newButton: "Nova receita",
    amountColor: "text-emerald-700",
    button: "bg-emerald-700 hover:bg-emerald-800",
    soft: "bg-emerald-100 text-emerald-700",
    inputBorder: "[&_input]:border-emerald-700",
    chosen: "border-emerald-700 bg-emerald-50 text-emerald-900",
  },
  despesa: {
    title: "Despesas",
    singular: "Despesa",
    newButton: "Nova despesa",
    amountColor: "text-rose-700",
    button: "bg-rose-700 hover:bg-rose-800",
    soft: "bg-rose-100 text-rose-700",
    inputBorder: "[&_input]:border-rose-700",
    chosen: "border-rose-700 bg-rose-50 text-rose-900",
  },
}

// "YYYY-MM-DD" de hoje e de ontem no fuso local, como o campo de data espera.
function localIsoDate(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function TransactionManager({ type }: TransactionManagerProps) {
  const l = labels[type]

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [formData, setFormData] = useState({ date: "", amount: "", category: "" })
  const [customCategory, setCustomCategory] = useState("")
  const [showCustomCategory, setShowCustomCategory] = useState(false)
  const [allCategories, setAllCategories] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<"date" | "amount" | "category">("date")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [lightboxTransaction, setLightboxTransaction] = useState<Transaction | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [duplicateWarning, setDuplicateWarning] = useState<Transaction[] | null>(null)
  const [receiptMeta, setReceiptMeta] = useState<{ barcode: string | null; payee: string | null } | null>(null)
  const [categoryHint, setCategoryHint] = useState<string | null>(null)
  // Mês mostrado na lista; null mostra todos os lançamentos.
  const [month, setMonth] = useState<{ year: number; month: number } | null>(null)
  const [categoryFilter, setCategoryFilter] = useState("")
  const [search, setSearch] = useState("")
  const [showAllCategories, setShowAllCategories] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    loadTransactions()
    loadCategories()

    const handleCategoriesUpdate = () => loadCategories()
    window.addEventListener(`categories-updated-${type}`, handleCategoriesUpdate)
    return () => window.removeEventListener(`categories-updated-${type}`, handleCategoriesUpdate)
  }, [type])

  // Os atalhos da Visão geral chegam com ?novo=1 e abrem o formulário direto.
  useEffect(() => {
    if (searchParams.get("novo")) {
      handleNewTransaction()
      setSearchParams({}, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const loadTransactions = async () => {
    try {
      const data = await fetchTransactions(type)
      setTransactions(data)
      setMonth((current) => {
        if (current || data.length === 0) return current
        const latest = data.reduce((max, t) => (t.date > max ? t.date : max), "")
        return { year: getYear(latest), month: getMonthIndex(latest) }
      })
    } catch (error) {
      console.error(`Erro ao carregar ${l.title.toLowerCase()}:`, error)
      toast({ title: "Erro", description: `Erro ao carregar ${l.title.toLowerCase()}`, variant: "destructive" })
    }
  }

  const loadCategories = async () => {
    try {
      const data = await fetchCategories(type)
      setAllCategories([...data.map((c) => c.name), "Nova"])
    } catch (error) {
      console.error("Erro ao carregar categorias:", error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await saveTransaction(false)
  }

  const saveTransaction = async (allowDuplicate: boolean) => {
    if (isSaving) return

    const categoryToSave = formData.category === "Nova" ? customCategory : formData.category
    const amountValue = parseCurrencyValue(formData.amount)

    if (!formData.date || !formData.amount || !categoryToSave || amountValue <= 0) {
      toast({ title: "Erro", description: "Todos os campos são obrigatórios", variant: "destructive" })
      return
    }

    setIsSaving(true)
    try {
      // Checa antes de enviar o comprovante, pra não deixar arquivo órfão se
      // o usuário desistir. Recarrega a lista pra pegar lançamentos feitos
      // em outro aparelho; se falhar, usa a que já está na tela.
      if (!allowDuplicate) {
        const latest = await fetchTransactions(type).catch(() => transactions)
        const duplicates = findDuplicateTransactions(
          latest,
          { date: formData.date, amount: amountValue, category: categoryToSave },
          editingTransaction?.id,
        )
        if (duplicates.length > 0) {
          setDuplicateWarning(duplicates)
          return
        }
      }

      let receiptPhotoPath: string | undefined
      if (receiptFile) {
        try {
          const uploaded = await uploadReceipt(receiptFile)
          receiptPhotoPath = uploaded.path
        } catch (error) {
          console.error("Erro ao enviar foto do comprovante:", error)
          toast({ title: "Erro", description: "Erro ao enviar foto do comprovante", variant: "destructive" })
          return
        }
      }

      const payload = {
        date: formData.date,
        description: `${categoryToSave} - ${formatDatePtBR(formData.date)}`,
        amount: amountValue,
        category: categoryToSave,
        ...(receiptPhotoPath ? { receiptPhotoPath } : {}),
        ...(receiptMeta ? { barcode: receiptMeta.barcode, payee: receiptMeta.payee } : {}),
      }

      try {
        if (editingTransaction) {
          await updateTransaction(editingTransaction.id, payload)
          toast({ title: "Sucesso", description: `${l.singular} atualizada` })
        } else {
          await createTransaction({ ...payload, type })
          toast({ title: "Sucesso", description: `${l.singular} adicionada` })
        }
        await loadTransactions()
        // Mostra o mês do lançamento salvo, pra ele aparecer na lista.
        setMonth({ year: getYear(formData.date), month: getMonthIndex(formData.date) })
        if (formData.category === "Nova") {
          window.dispatchEvent(new CustomEvent(`categories-updated-${type}`))
        }
        resetForm()
      } catch (error) {
        console.error(`Erro ao salvar ${l.singular.toLowerCase()}:`, error)
        toast({ title: "Erro", description: `Erro ao salvar ${l.singular.toLowerCase()}`, variant: "destructive" })
      }
    } finally {
      setIsSaving(false)
    }
  }

  const resetForm = () => {
    setIsDialogOpen(false)
    setEditingTransaction(null)
    setFormData({ date: localIsoDate(), amount: "", category: "" })
    setCustomCategory("")
    setShowCustomCategory(false)
    setReceiptFile(null)
    setReceiptMeta(null)
    setCategoryHint(null)
    setShowAllCategories(false)
  }

  const handleReceiptExtracted = ({
    amountGuess,
    dateGuess,
    categoryGuess,
    barcodeGuess,
    payeeGuess,
    categorySource,
    categoryReason,
  }: ReceiptExtraction) => {
    setReceiptMeta({ barcode: barcodeGuess, payee: payeeGuess })
    setCategoryHint(
      categorySource === "historico" && categoryReason
        ? `Categoria sugerida pelo histórico (${categoryReason})`
        : categorySource === "nova"
          ? "Nenhuma categoria cadastrada corresponde — confira o nome da nova categoria"
          : null,
    )

    setFormData((prev) => ({
      ...prev,
      amount:
        amountGuess !== null
          ? amountGuess.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : prev.amount,
      date: dateGuess ?? prev.date,
      category: categoryGuess ? resolveCategoryForGuess(categoryGuess) : prev.category,
    }))

    if (categoryGuess) {
      const existing = allCategories.find((cat) => categoriesMatch(cat, categoryGuess))
      setShowCustomCategory(!existing)
      setCustomCategory(existing ? "" : categoryGuess)
    }
  }

  // Se a categoria sugerida pela IA já existe (ignorando maiúsculas/minúsculas),
  // seleciona ela; senão seleciona "Nova" e deixa o nome sugerido pré-preenchido
  // para o usuário confirmar — nunca cria a categoria sem revisão.
  const resolveCategoryForGuess = (categoryGuess: string) => {
    const existing = allCategories.find((cat) => categoriesMatch(cat, categoryGuess))
    return existing ?? "Nova"
  }

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction)
    setReceiptMeta(null)
    setCategoryHint(null)
    const isCustomCategory = !allCategories.slice(0, -1).includes(transaction.category)

    setFormData({
      date: transaction.date,
      amount: transaction.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      category: isCustomCategory ? "Nova" : transaction.category,
    })

    if (isCustomCategory) {
      setCustomCategory(transaction.category)
      setShowCustomCategory(true)
    }

    setIsDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!transactionToDelete) return
    try {
      await deleteTransaction(transactionToDelete.id)
      await loadTransactions()
      setTransactionToDelete(null)
      toast({ title: "Sucesso", description: `${l.singular} removida` })
    } catch (error) {
      console.error(`Erro ao remover ${l.singular.toLowerCase()}:`, error)
      toast({ title: "Erro", description: `Erro ao remover ${l.singular.toLowerCase()}`, variant: "destructive" })
    }
  }

  const handleNewTransaction = () => {
    resetForm()
    setFormData((prev) => ({ ...prev, date: localIsoDate() }))
    setIsDialogOpen(true)
  }

  const pickCategory = (value: string) => {
    setFormData({ ...formData, category: value })
    setCategoryHint(null)
    setShowCustomCategory(value === "Nova")
    if (value !== "Nova") {
      setCustomCategory("")
    }
  }

  // ── Lista ──────────────────────────────────────────────────────────

  const inMonth = month
    ? transactions.filter((t) => getYear(t.date) === month.year && getMonthIndex(t.date) === month.month)
    : transactions
  const periodText = month ? `${MONTHS[month.month]} ${month.year}` : "todos os meses"
  const periodTotal = inMonth.reduce((sum, t) => sum + t.amount, 0)

  const categoryTotals = new Map<string, number>()
  for (const t of inMonth) categoryTotals.set(t.category, (categoryTotals.get(t.category) ?? 0) + t.amount)
  const chips = [...categoryTotals.entries()].sort((a, b) => b[1] - a[1])

  const query = search.trim().toLowerCase()
  const visible = inMonth.filter(
    (t) =>
      (!categoryFilter || t.category === categoryFilter) &&
      (!query ||
        t.category.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query) ||
        formatDatePtBR(t.date).includes(query) ||
        t.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 }).includes(query)),
  )
  const direction = sortOrder === "asc" ? 1 : -1

  type Group = { key: string; label: string; total: number | null; items: Transaction[] }
  let groups: Group[]
  if (sortBy === "date") {
    const byDay = new Map<string, Transaction[]>()
    for (const t of visible) byDay.set(t.date, [...(byDay.get(t.date) ?? []), t])
    groups = [...byDay.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]) * direction)
      .map(([date, items]) => {
        const [y, m, d] = date.split("-").map(Number)
        return {
          key: date,
          label: `${String(d).padStart(2, "0")} de ${MONTHS[m - 1].toLowerCase()}${month ? "" : ` de ${y}`}`,
          total: items.reduce((sum, t) => sum + t.amount, 0),
          items,
        }
      })
  } else if (sortBy === "amount") {
    const sorted = [...visible].sort((a, b) => (a.amount - b.amount) * direction)
    groups = sorted.length
      ? [{ key: "valor", label: direction < 0 ? "Do maior para o menor" : "Do menor para o maior", total: null, items: sorted }]
      : []
  } else {
    const byCat = new Map<string, Transaction[]>()
    for (const t of visible) byCat.set(t.category, [...(byCat.get(t.category) ?? []), t])
    groups = [...byCat.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]) * direction)
      .map(([name, items]) => ({
        key: name,
        label: name,
        total: items.reduce((sum, t) => sum + t.amount, 0),
        items: [...items].sort((a, b) => b.date.localeCompare(a.date)),
      }))
  }

  const shiftMonth = (delta: number) => {
    if (!month) return
    const index = month.year * 12 + month.month + delta
    setMonth({ year: Math.floor(index / 12), month: index % 12 })
    setCategoryFilter("")
  }

  const sortButton = (key: "date" | "amount" | "category", label: string) => (
    <button
      key={key}
      type="button"
      aria-pressed={sortBy === key}
      onClick={() => {
        if (sortBy === key) setSortOrder(sortOrder === "asc" ? "desc" : "asc")
        else {
          setSortBy(key)
          setSortOrder(key === "category" ? "asc" : "desc")
        }
      }}
      className={cn("inline-flex h-[34px] items-center gap-1 rounded-lg px-3 font-medium", sortBy === key ? "bg-white shadow-sm" : "text-slate-600")}
    >
      {label}
      {sortBy === key && <span className="font-bold text-blue-700">{sortOrder === "desc" ? "↓" : "↑"}</span>}
    </button>
  )

  const today = localIsoDate()
  const yesterday = localIsoDate(-1)
  // As 8 categorias mais usadas primeiro; as outras ficam atrás de "Ver todas".
  const usage = new Map<string, number>()
  for (const t of transactions) usage.set(t.category, (usage.get(t.category) ?? 0) + 1)
  const ranked = allCategories.filter((c) => c !== "Nova").sort((a, b) => (usage.get(b) ?? 0) - (usage.get(a) ?? 0))
  const FEW = 8
  const categoryChoices =
    showAllCategories || ranked.length <= FEW + 1
      ? ranked
      : [...ranked.slice(0, FEW), ...ranked.slice(FEW).filter((c) => c === formData.category)]

  return (
    <div className="flex flex-col gap-5 text-[14px] text-slate-900">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight">{l.title}</h1>
          <p className="mt-1 text-slate-600">
            <strong className={cn("tabular-nums", l.amountColor)}>{money(periodTotal)}</strong> em {periodText} ·{" "}
            {inMonth.length} lançamentos
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CategoryManager type={type} />
          <button
            type="button"
            onClick={handleNewTransaction}
            className={cn("inline-flex h-[42px] items-center gap-2 rounded-[10px] px-4 font-semibold text-white", l.button)}
          >
            <Plus className="h-[18px] w-[18px]" />
            {l.newButton}
          </button>
        </div>
      </div>

      <section aria-label="Filtros" className="flex flex-wrap items-center gap-3 rounded-[14px] border border-slate-200 bg-white/85 p-3">
        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            disabled={!month}
            aria-label="Mês anterior"
            className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
          >
            <ChevronLeft className="h-[18px] w-[18px]" />
          </button>
          <span className="min-w-[140px] text-center text-base font-bold">{month ? `${MONTHS[month.month]} ${month.year}` : "Todos os meses"}</span>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            disabled={!month}
            aria-label="Próximo mês"
            className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
          >
            <ChevronRight className="h-[18px] w-[18px]" />
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            const now = new Date()
            setMonth(month ? null : { year: now.getFullYear(), month: now.getMonth() })
            setCategoryFilter("")
          }}
          className="h-10 rounded-[10px] border border-slate-200 bg-white px-3 font-medium hover:bg-slate-50"
        >
          {month ? "Ver todos os meses" : "Ver por mês"}
        </button>
        <label className="flex h-10 max-w-[360px] flex-[1_1_220px] items-center gap-2 rounded-[10px] border border-slate-300 bg-white px-3">
          <Search className="h-4 w-4 text-slate-500" />
          <span className="sr-only">Buscar {l.singular.toLowerCase()}</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Buscar ${l.singular.toLowerCase()}`}
            className="min-w-0 flex-1 bg-transparent outline-none"
          />
        </label>
        <div className="flex-auto" />
        <div role="group" aria-label="Ordenar por" className="inline-flex rounded-[10px] bg-slate-100 p-[3px]">
          {sortButton("date", "Data")}
          {sortButton("amount", "Valor")}
          {sortButton("category", "Categoria")}
        </div>
      </section>

      {chips.length > 0 && (
        <section aria-label="Categorias" className="flex flex-wrap gap-2">
          {[["", periodTotal] as [string, number], ...chips].map(([name, total]) => {
            const active = categoryFilter === name
            return (
              <button
                key={name || "todas"}
                type="button"
                aria-pressed={active}
                onClick={() => setCategoryFilter(name)}
                className={cn(
                  "inline-flex h-[38px] items-center gap-2 rounded-full border px-3.5",
                  active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white hover:bg-slate-50",
                )}
              >
                <span className="font-semibold capitalize">{name || "Todas"}</span>
                <span className="tabular-nums opacity-85">{money(total)}</span>
              </button>
            )
          })}
        </section>
      )}

      <section aria-label="Lançamentos" className="rounded-[14px] border border-slate-200 bg-white/90 px-5 pb-5 pt-2 shadow-[0_4px_16px_rgba(15,23,42,0.05)]">
        {groups.map((group) => (
          <div key={group.key}>
            <div className="flex items-center justify-between border-b border-slate-200 px-1 pb-1.5 pt-4 tabular-nums">
              <span className={cn("font-bold text-slate-700", sortBy === "category" && "capitalize")}>{group.label}</span>
              {group.total !== null && <span className="text-[13px] font-semibold text-slate-600">{money(group.total)}</span>}
            </div>
            {group.items.map((t) => (
              <div key={t.id} className="group flex items-center gap-3 border-b border-slate-100 px-1 py-2.5 hover:bg-slate-50">
                <span className={cn("flex h-9 w-9 flex-none items-center justify-center rounded-[10px]", l.soft)}>
                  {type === "receita" ? <ArrowUp className="h-[18px] w-[18px]" /> : <ArrowDown className="h-[18px] w-[18px]" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium capitalize">{t.category}</span>
                  <span className="block text-xs text-slate-500">{formatDatePtBR(t.date)}</span>
                </span>
                {t.receiptPhotoPath && (
                  <button type="button" onClick={() => setLightboxTransaction(t)} title="Ver comprovante" aria-label="Ver comprovante" className="shrink-0">
                    <img
                      src={getReceiptThumbUrl(t.receiptPhotoPath) ?? ""}
                      alt=""
                      className="h-8 w-8 rounded border object-cover transition-transform hover:scale-110"
                      onError={(e) => {
                        e.currentTarget.style.display = "none"
                      }}
                    />
                  </button>
                )}
                <span className={cn("min-w-[110px] text-right font-semibold tabular-nums", l.amountColor)}>{money(t.amount)}</span>
                <span className="flex gap-0.5 opacity-60 group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => handleEdit(t)}
                    aria-label="Editar"
                    title="Editar"
                    className="flex h-[34px] w-[34px] items-center justify-center rounded-lg text-slate-700 hover:bg-slate-200"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setTransactionToDelete(t)}
                    aria-label="Excluir"
                    title="Excluir"
                    className="flex h-[34px] w-[34px] items-center justify-center rounded-lg text-slate-700 hover:bg-slate-200"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </span>
              </div>
            ))}
          </div>
        ))}
        {groups.length === 0 && (
          <p className="px-1 pb-1 pt-5 text-slate-500">
            {inMonth.length === 0
              ? `Nenhuma ${l.singular.toLowerCase()} em ${periodText}.`
              : `Nenhuma ${l.singular.toLowerCase()} combina com a busca ou a categoria escolhida.`}
          </p>
        )}
      </section>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[520px]" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="text-[19px]">{editingTransaction ? `Editar ${l.singular.toLowerCase()}` : l.newButton}</DialogTitle>
            <DialogDescription className="sr-only">
              {editingTransaction ? `Edite os dados da ${l.singular.toLowerCase()}` : `Adicione uma nova ${l.singular.toLowerCase()}`}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {type === "despesa" && (
              <ReceiptCapture
                onExtracted={handleReceiptExtracted}
                onFileSelected={setReceiptFile}
                existingPhotoUrl={editingTransaction?.receiptPhotoPath ?? null}
              />
            )}

            <div>
              <label htmlFor="amount" className="mb-1.5 block font-semibold">
                Valor
              </label>
              <CurrencyInput
                id="amount"
                value={formData.amount}
                onChange={(value) => setFormData({ ...formData, amount: value })}
                className={cn(
                  "[&>span]:left-4 [&>span]:text-xl [&>span]:font-semibold [&_input]:h-16 [&_input]:rounded-[14px] [&_input]:border-2 [&_input]:pl-14 [&_input]:text-[28px] [&_input]:font-bold [&_input]:tabular-nums",
                  l.inputBorder,
                )}
                placeholder="0,00"
              />
            </div>

            <div>
              <span className="mb-1.5 block font-semibold">Data</span>
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { value: today, label: "Hoje" },
                  { value: yesterday, label: "Ontem" },
                ].map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    aria-pressed={formData.date === option.value}
                    onClick={() => setFormData({ ...formData, date: option.value })}
                    className={cn(
                      "h-10 rounded-[10px] border px-3.5 font-medium",
                      formData.date === option.value ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white hover:bg-slate-50",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
                <Input
                  id="date"
                  type="date"
                  aria-label="Outra data"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="h-10 w-auto"
                />
              </div>
            </div>

            <div>
              <span className="mb-1.5 block font-semibold">Categoria</span>
              <div role="group" aria-label="Categoria" className="grid grid-cols-2 gap-2">
                {categoryChoices.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    aria-pressed={formData.category === cat}
                    onClick={() => pickCategory(cat)}
                    className={cn(
                      "h-11 truncate rounded-[10px] border px-3 text-left font-medium capitalize",
                      formData.category === cat ? l.chosen : "border-slate-300 bg-white hover:bg-slate-50",
                    )}
                  >
                    {cat}
                  </button>
                ))}
                <button
                  type="button"
                  aria-pressed={formData.category === "Nova"}
                  onClick={() => pickCategory("Nova")}
                  className={cn(
                    "flex h-11 items-center gap-1.5 rounded-[10px] border px-3 text-left font-medium",
                    formData.category === "Nova" ? l.chosen : "border-blue-300 bg-white text-blue-700 hover:bg-blue-50",
                  )}
                >
                  <Plus className="h-4 w-4" /> Nova categoria
                </button>
              </div>
              {ranked.length > FEW + 1 && (
                <button
                  type="button"
                  onClick={() => setShowAllCategories(!showAllCategories)}
                  className="mt-2 text-[13px] font-semibold text-blue-700 hover:text-blue-900"
                >
                  {showAllCategories ? "Mostrar só as mais usadas" : `Ver todas as ${ranked.length} categorias`}
                </button>
              )}
              {categoryHint && <p className="mt-2 text-xs text-slate-600">{categoryHint}</p>}
              {showCustomCategory && (
                <Input
                  className="mt-2"
                  placeholder="Nome da nova categoria"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                />
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <button
                type="button"
                onClick={() => setIsDialogOpen(false)}
                className="h-11 rounded-[10px] border border-slate-300 bg-white px-[18px] font-medium hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button type="submit" disabled={isSaving} className={cn("h-11 rounded-[10px] px-5 font-semibold text-white disabled:opacity-60", l.button)}>
                {isSaving ? "Salvando..." : editingTransaction ? "Salvar alterações" : `Salvar ${l.singular.toLowerCase()}`}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!transactionToDelete} onOpenChange={(open) => !open && setTransactionToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {l.singular.toLowerCase()}?</AlertDialogTitle>
            <AlertDialogDescription>
              {transactionToDelete &&
                `${transactionToDelete.category} de ${formatDatePtBR(transactionToDelete.date)}, ${money(transactionToDelete.amount)}. `}
              Não dá para desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!duplicateWarning} onOpenChange={(open) => !open && setDuplicateWarning(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Talvez já esteja lançada</AlertDialogTitle>
            <AlertDialogDescription>
              Já existe {l.singular.toLowerCase()} com a mesma categoria e o mesmo valor neste mês:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="space-y-1 text-sm">
            {duplicateWarning?.map((t) => (
              <li key={t.id} className="flex justify-between gap-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
                <span>
                  {formatDatePtBR(t.date)} · <span className="capitalize">{t.category}</span>
                </span>
                <span className={cn("font-medium", l.amountColor)}>{money(t.amount)}</span>
              </li>
            ))}
          </ul>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setDuplicateWarning(null)
                saveTransaction(true)
              }}
            >
              Salvar mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Lightbox de comprovante */}
      <Dialog
        open={!!lightboxTransaction}
        onOpenChange={(open) => {
          if (!open) setLightboxTransaction(null)
        }}
      >
        <DialogContent className="max-w-[90vw] border-0 bg-black/90 p-0 sm:max-w-[700px]">
          <DialogHeader className="sr-only">
            <DialogTitle>Comprovante</DialogTitle>
          </DialogHeader>
          {lightboxTransaction?.receiptPhotoPath && (
            <img
              src={getReceiptUrl(lightboxTransaction.receiptPhotoPath) ?? ""}
              alt="Comprovante"
              className="h-auto max-h-[85vh] w-full rounded-lg object-contain"
            />
          )}
          <DialogFooter className="absolute bottom-2 right-2">
            <button
              type="button"
              onClick={() => setLightboxTransaction(null)}
              className="rounded-md bg-black/50 px-3 py-1.5 text-sm text-white hover:bg-black/70"
            >
              Fechar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
