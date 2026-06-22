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
import { Plus, Edit, Trash2 } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { CurrencyInput, parseCurrencyValue } from "@/components/currency-input"
import { CategoryManager } from "@/components/category-manager"

interface Despesa {
  id: string
  date: string
  description: string
  amount: number
  category: string
  paymentMethod: string
}

const defaultCategories = ["Salários", "Suprimentos", "Manutenção", "Contas Fixas", "Impostos"]

export default function Despesas() {
  const [despesas, setDespesas] = useState<Despesa[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingDespesa, setEditingDespesa] = useState<Despesa | null>(null)
  const [formData, setFormData] = useState({
    date: "",
    amount: "",
    category: "",
  })
  const [customCategory, setCustomCategory] = useState("")
  const [showCustomCategory, setShowCustomCategory] = useState(false)
  const [allCategories, setAllCategories] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<"date" | "amount" | "category">("date")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")

  useEffect(() => {
    loadDespesas()
    loadCategories()

    // Escutar mudanças nas categorias
    const handleCategoriesUpdate = () => {
      loadCategories()
    }

    window.addEventListener("categories-updated-despesa", handleCategoriesUpdate)

    return () => {
      window.removeEventListener("categories-updated-despesa", handleCategoriesUpdate)
    }
  }, [])

  const loadDespesas = () => {
    try {
      const stored = localStorage.getItem("financial-transactions")
      if (stored) {
        const transactions = JSON.parse(stored)
        const despesasOnly = transactions.filter((t: any) => t.type === "despesa")
        setDespesas(despesasOnly)
      }
    } catch (error) {
      console.error("Erro ao carregar despesas:", error)
      setDespesas([])
    }
  }

  const loadCategories = () => {
    try {
      const stored = localStorage.getItem("all-categories-despesa")
      if (stored) {
        const categories = JSON.parse(stored)
        setAllCategories(categories)
      } else {
        const categoriesWithNova = [...defaultCategories, "Nova"]
        localStorage.setItem("all-categories-despesa", JSON.stringify(categoriesWithNova))
        setAllCategories(categoriesWithNova)
      }
    } catch (error) {
      console.error("Erro ao carregar categorias:", error)
      const fallback = [...defaultCategories, "Nova"]
      setAllCategories(fallback)
    }
  }

  const saveToStorage = (newDespesas: Despesa[]) => {
    try {
      const stored = localStorage.getItem("financial-transactions")
      const allTransactions = stored ? JSON.parse(stored) : []
      const receitas = allTransactions.filter((t: any) => t.type === "receita")
      const despesasWithType = newDespesas.map((d) => ({ ...d, type: "despesa" }))
      const updatedTransactions = [...receitas, ...despesasWithType]
      localStorage.setItem("financial-transactions", JSON.stringify(updatedTransactions))
    } catch (error) {
      console.error("Erro ao salvar despesas:", error)
      toast({
        title: "Erro",
        description: "Erro ao salvar despesa",
        variant: "destructive",
      })
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const categoryToSave = formData.category === "Nova" ? customCategory : formData.category
    const amountValue = parseCurrencyValue(formData.amount)

    if (!formData.date || !formData.amount || !categoryToSave || amountValue <= 0) {
      toast({
        title: "Erro",
        description: "Todos os campos são obrigatórios",
        variant: "destructive",
      })
      return
    }

    // Se é uma categoria personalizada nova, salvar ela
    if (formData.category === "Nova" && customCategory && !allCategories.includes(customCategory)) {
      const stored = localStorage.getItem("all-categories-despesa")
      const existing = stored ? JSON.parse(stored) : []
      const updated = existing.filter((cat: string) => cat !== "Nova")
      updated.push(customCategory)
      updated.push("Nova")
      localStorage.setItem("all-categories-despesa", JSON.stringify(updated))
      setAllCategories(updated)
    }

    const newDespesa: Despesa = {
      id: editingDespesa?.id || Date.now().toString(),
      date: formData.date,
      description: `${categoryToSave} - ${new Date(formData.date).toLocaleDateString("pt-BR")}`,
      amount: amountValue,
      category: categoryToSave,
      paymentMethod: "",
    }

    let updatedDespesas
    if (editingDespesa) {
      updatedDespesas = despesas.map((d) => (d.id === editingDespesa.id ? newDespesa : d))
      toast({ title: "Sucesso", description: "Despesa atualizada" })
    } else {
      updatedDespesas = [...despesas, newDespesa]
      toast({ title: "Sucesso", description: "Despesa adicionada" })
    }

    setDespesas(updatedDespesas)
    saveToStorage(updatedDespesas)
    resetForm()
  }

  const resetForm = () => {
    setIsDialogOpen(false)
    setEditingDespesa(null)
    setFormData({
      date: new Date().toISOString().split("T")[0],
      amount: "",
      category: "",
    })
    setCustomCategory("")
    setShowCustomCategory(false)
  }

  const handleEdit = (despesa: Despesa) => {
    setEditingDespesa(despesa)
    const isCustomCategory = !allCategories.slice(0, -1).includes(despesa.category)

    setFormData({
      date: despesa.date,
      amount: despesa.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      category: isCustomCategory ? "Nova" : despesa.category,
    })

    if (isCustomCategory) {
      setCustomCategory(despesa.category)
      setShowCustomCategory(true)
    }

    setIsDialogOpen(true)
  }

  const handleDelete = (id: string) => {
    const updated = despesas.filter((d) => d.id !== id)
    setDespesas(updated)
    saveToStorage(updated)
    toast({ title: "Sucesso", description: "Despesa removida" })
  }

  const handleNewDespesa = () => {
    resetForm()
    setFormData((prev) => ({ ...prev, date: new Date().toISOString().split("T")[0] }))
    setIsDialogOpen(true)
  }

  const getSortedDespesas = () => {
    const sorted = [...despesas].sort((a, b) => {
      let comparison = 0

      switch (sortBy) {
        case "date":
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime()
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Despesas</h1>
          <p className="text-muted-foreground">
            Total: R${" "}
            {despesas.reduce((sum, d) => sum + d.amount, 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="flex gap-2">
          <CategoryManager type="despesa" />
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleNewDespesa}>
                <Plus className="mr-2 h-4 w-4" />
                Nova Despesa
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>{editingDespesa ? "Editar Despesa" : "Nova Despesa"}</DialogTitle>
                <DialogDescription>
                  {editingDespesa ? "Edite os dados da despesa" : "Adicione uma nova despesa"}
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
                </div>
                <DialogFooter>
                  <Button type="submit">{editingDespesa ? "Atualizar" : "Salvar"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            <div>
              <CardTitle>Lista de Despesas</CardTitle>
              <CardDescription>Todas as despesas registradas no sistema</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">Ordenar por:</Label>
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
              {getSortedDespesas().map((despesa) => (
                <TableRow key={despesa.id}>
                  <TableCell>{new Date(despesa.date).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell className="capitalize">{despesa.category}</TableCell>
                  <TableCell className="text-right font-medium text-red-600">
                    R$ {despesa.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(despesa)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDelete(despesa.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
