"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Plus, Edit, Trash2, Camera } from "lucide-react"
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
import type { Transaction } from "@/lib/api-client"
import { formatDatePtBR } from "@/lib/dates"
import { categoriesMatch } from "@/lib/categories"

interface TransactionManagerProps {
  type: "receita" | "despesa"
}

const labels = {
  receita: {
    title: "Receitas",
    singular: "Receita",
    newButton: "Nova Receita",
    listTitle: "Lista de Receitas",
    listDescription: "Todas as receitas registradas no sistema",
    amountColor: "text-green-600",
  },
  despesa: {
    title: "Despesas",
    singular: "Despesa",
    newButton: "Nova Despesa",
    listTitle: "Lista de Despesas",
    listDescription: "Todas as despesas registradas no sistema",
    amountColor: "text-red-600",
  },
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

  useEffect(() => {
    loadTransactions()
    loadCategories()

    const handleCategoriesUpdate = () => loadCategories()
    window.addEventListener(`categories-updated-${type}`, handleCategoriesUpdate)
    return () => window.removeEventListener(`categories-updated-${type}`, handleCategoriesUpdate)
  }, [type])

  const loadTransactions = async () => {
    try {
      const data = await fetchTransactions(type)
      setTransactions(data)
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

    const categoryToSave = formData.category === "Nova" ? customCategory : formData.category
    const amountValue = parseCurrencyValue(formData.amount)

    if (!formData.date || !formData.amount || !categoryToSave || amountValue <= 0) {
      toast({ title: "Erro", description: "Todos os campos são obrigatórios", variant: "destructive" })
      return
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
      if (formData.category === "Nova") {
        window.dispatchEvent(new CustomEvent(`categories-updated-${type}`))
      }
      resetForm()
    } catch (error) {
      console.error(`Erro ao salvar ${l.singular.toLowerCase()}:`, error)
      toast({ title: "Erro", description: `Erro ao salvar ${l.singular.toLowerCase()}`, variant: "destructive" })
    }
  }

  const resetForm = () => {
    setIsDialogOpen(false)
    setEditingTransaction(null)
    setFormData({ date: new Date().toISOString().split("T")[0], amount: "", category: "" })
    setCustomCategory("")
    setShowCustomCategory(false)
    setReceiptFile(null)
  }

  const handleReceiptExtracted = ({
    amountGuess,
    dateGuess,
    categoryGuess,
  }: {
    amountGuess: number | null
    dateGuess: string | null
    categoryGuess: string | null
  }) => {
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

  // Se a categoria sugerida pelo OCR já existe (ignorando maiúsculas/minúsculas),
  // seleciona ela; senão seleciona "Nova" e deixa o nome sugerido pré-preenchido
  // para o usuário confirmar — nunca cria a categoria sem revisão.
  const resolveCategoryForGuess = (categoryGuess: string) => {
    const existing = allCategories.find((cat) => categoriesMatch(cat, categoryGuess))
    return existing ?? "Nova"
  }

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction)
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
    setFormData((prev) => ({ ...prev, date: new Date().toISOString().split("T")[0] }))
    setIsDialogOpen(true)
  }

  const getSortedTransactions = () => {
    const sorted = [...transactions].sort((a, b) => {
      let comparison = 0
      switch (sortBy) {
        case "date":
          comparison = a.date.localeCompare(b.date)
          break
        case "amount":
          comparison = a.amount - b.amount
          break
        case "category":
          comparison = a.category.localeCompare(b.category)
          break
      }
      return sortOrder === "asc" ? comparison : -comparison
    })
    return sorted
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{l.title}</h1>
          <p className="text-muted-foreground">
            Total: R${" "}
            {transactions.reduce((sum, t) => sum + t.amount, 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CategoryManager type={type} />
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleNewTransaction}>
                <Plus className="mr-2 h-4 w-4" />
                {l.newButton}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>{editingTransaction ? `Editar ${l.singular}` : l.newButton}</DialogTitle>
                <DialogDescription>
                  {editingTransaction ? `Edite os dados da ${l.singular.toLowerCase()}` : `Adicione uma nova ${l.singular.toLowerCase()}`}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit}>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="date" className="text-right">
                      Data
                    </Label>
                    <Input
                      id="date"
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="amount" className="text-right">
                      Valor
                    </Label>
                    <CurrencyInput
                      id="amount"
                      value={formData.amount}
                      onChange={(value) => setFormData({ ...formData, amount: value })}
                      className="col-span-3"
                      placeholder="0,00"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="category" className="text-right">
                      Categoria
                    </Label>
                    <div className="col-span-3 space-y-2">
                      <Select
                        value={formData.category}
                        onValueChange={(value) => {
                          setFormData({ ...formData, category: value })
                          setShowCustomCategory(value === "Nova")
                          if (value !== "Nova") {
                            setCustomCategory("")
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma categoria" />
                        </SelectTrigger>
                        <SelectContent>
                          {allCategories.map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              {cat}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {showCustomCategory && (
                        <Input
                          placeholder="Digite a nova categoria"
                          value={customCategory}
                          onChange={(e) => setCustomCategory(e.target.value)}
                        />
                      )}
                    </div>
                  </div>
                  {type === "despesa" && (
                    <ReceiptCapture
                      onExtracted={handleReceiptExtracted}
                      onFileSelected={setReceiptFile}
                      existingPhotoUrl={editingTransaction?.receiptPhotoPath ?? null}
                    />
                  )}
                </div>
                <DialogFooter>
                  <Button type="submit">{editingTransaction ? "Atualizar" : "Salvar"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:mb-4">
            <div>
              <CardTitle>{l.listTitle}</CardTitle>
              <CardDescription>{l.listDescription}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium whitespace-nowrap">Ordenar por:</Label>
              <Select value={sortBy} onValueChange={(value: "date" | "amount" | "category") => setSortBy(value)}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Data</SelectItem>
                  <SelectItem value="amount">Valor</SelectItem>
                  <SelectItem value="category">Categoria</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                className="px-3"
              >
                {sortOrder === "asc" ? "↑" : "↓"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Mobile: lista em cards — uma tabela de 4 colunas não cabe numa
              tela estreita sem virar scroll horizontal escondido. */}
          <div className="space-y-3 sm:hidden">
            {getSortedTransactions().map((transaction) => (
              <div key={transaction.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-muted-foreground">{formatDatePtBR(transaction.date)}</span>
                  <span className={`font-medium ${l.amountColor}`}>
                    R$ {transaction.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm capitalize">
                    {transaction.category}
                    {transaction.receiptPhotoPath && (
                      <a
                        href={transaction.receiptPhotoPath}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Ver comprovante"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Camera className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(transaction)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setTransactionToDelete(transaction)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Tablet/desktop: tabela */}
          <div className="hidden sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {getSortedTransactions().map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell>{formatDatePtBR(transaction.date)}</TableCell>
                    <TableCell className="capitalize">
                      <div className="flex items-center gap-2">
                        {transaction.category}
                        {transaction.receiptPhotoPath && (
                          <a
                            href={transaction.receiptPhotoPath}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Ver comprovante"
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Camera className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className={`text-right font-medium ${l.amountColor}`}>
                      R$ {transaction.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(transaction)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setTransactionToDelete(transaction)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!transactionToDelete} onOpenChange={(open) => !open && setTransactionToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover esta {l.singular.toLowerCase()}? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
