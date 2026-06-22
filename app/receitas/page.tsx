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
import { Plus, Edit, Trash2 } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { CurrencyInput, parseCurrencyValue } from "@/components/currency-input"
import { CategoryManager } from "@/components/category-manager"
import { safeJSONParse } from "@/lib/storage"

interface Receita {
  id: string
  date: string
  description: string
  amount: number
  category: string
  paymentMethod: string
}

const defaultCategories = ["Comissão Contas", "Comissão Bolão", "Comissão Jogos"]

export default function Receitas() {
  const [receitas, setReceitas] = useState<Receita[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingReceita, setEditingReceita] = useState<Receita | null>(null)
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
  const [receitaToDelete, setReceitaToDelete] = useState<Receita | null>(null)

  useEffect(() => {
    loadReceitas()
    loadCategories()

    // Escutar mudanças nas categorias
    const handleCategoriesUpdate = () => {
      loadCategories()
    }

    window.addEventListener("categories-updated-receita", handleCategoriesUpdate)

    return () => {
      window.removeEventListener("categories-updated-receita", handleCategoriesUpdate)
    }
  }, [])

  const loadReceitas = () => {
    const stored = localStorage.getItem("financial-transactions")
    const transactions = safeJSONParse<(Receita & { type: string })[]>(stored, [])
    const receitasOnly = transactions.filter((t) => t.type === "receita")
    setReceitas(receitasOnly)
  }

  const loadCategories = () => {
    try {
      const stored = localStorage.getItem("all-categories-receita")
      if (stored) {
        const categories = safeJSONParse<string[]>(stored, defaultCategories)
        setAllCategories(categories)
      } else {
        const categoriesWithNova = [...defaultCategories, "Nova"]
        localStorage.setItem("all-categories-receita", JSON.stringify(categoriesWithNova))
        setAllCategories(categoriesWithNova)
      }
    } catch (error) {
      console.error("Erro ao carregar categorias:", error)
      const fallback = [...defaultCategories, "Nova"]
      setAllCategories(fallback)
    }
  }

  const saveToStorage = (newReceitas: Receita[]) => {
    try {
      const stored = localStorage.getItem("financial-transactions")
      const allTransactions = safeJSONParse<(Receita & { type: string })[]>(stored, [])
      const despesas = allTransactions.filter((t) => t.type === "despesa")
      const receitasWithType = newReceitas.map((r) => ({ ...r, type: "receita" }))
      const updatedTransactions = [...despesas, ...receitasWithType]
      localStorage.setItem("financial-transactions", JSON.stringify(updatedTransactions))
    } catch (error) {
      console.error("Erro ao salvar receitas:", error)
      toast({
        title: "Erro",
        description: "Erro ao salvar receita",
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
      const stored = localStorage.getItem("all-categories-receita")
      const existing = safeJSONParse<string[]>(stored, [])
      const updated = existing.filter((cat) => cat !== "Nova")
      updated.push(customCategory)
      updated.push("Nova")
      localStorage.setItem("all-categories-receita", JSON.stringify(updated))
      setAllCategories(updated)
    }

    const newReceita: Receita = {
      id: editingReceita?.id || crypto.randomUUID(),
      date: formData.date,
      description: `${categoryToSave} - ${new Date(formData.date).toLocaleDateString("pt-BR")}`,
      amount: amountValue,
      category: categoryToSave,
      paymentMethod: "",
    }

    let updatedReceitas
    if (editingReceita) {
      updatedReceitas = receitas.map((r) => (r.id === editingReceita.id ? newReceita : r))
      toast({ title: "Sucesso", description: "Receita atualizada" })
    } else {
      updatedReceitas = [...receitas, newReceita]
      toast({ title: "Sucesso", description: "Receita adicionada" })
    }

    setReceitas(updatedReceitas)
    saveToStorage(updatedReceitas)
    resetForm()
  }

  const resetForm = () => {
    setIsDialogOpen(false)
    setEditingReceita(null)
    setFormData({
      date: new Date().toISOString().split("T")[0],
      amount: "",
      category: "",
    })
    setCustomCategory("")
    setShowCustomCategory(false)
  }

  const handleEdit = (receita: Receita) => {
    setEditingReceita(receita)
    const isCustomCategory = !allCategories.slice(0, -1).includes(receita.category)

    setFormData({
      date: receita.date,
      amount: receita.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      category: isCustomCategory ? "Nova" : receita.category,
    })

    if (isCustomCategory) {
      setCustomCategory(receita.category)
      setShowCustomCategory(true)
    }

    setIsDialogOpen(true)
  }

  const handleDelete = () => {
    if (!receitaToDelete) return
    const updated = receitas.filter((r) => r.id !== receitaToDelete.id)
    setReceitas(updated)
    saveToStorage(updated)
    setReceitaToDelete(null)
    toast({ title: "Sucesso", description: "Receita removida" })
  }

  const handleNewReceita = () => {
    resetForm()
    setFormData((prev) => ({ ...prev, date: new Date().toISOString().split("T")[0] }))
    setIsDialogOpen(true)
  }

  const getSortedReceitas = () => {
    const sorted = [...receitas].sort((a, b) => {
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
          <h1 className="text-3xl font-bold">Receitas</h1>
          <p className="text-muted-foreground">
            Total: R${" "}
            {receitas.reduce((sum, r) => sum + r.amount, 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="flex gap-2">
          <CategoryManager type="receita" />
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleNewReceita}>
                <Plus className="mr-2 h-4 w-4" />
                Nova Receita
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>{editingReceita ? "Editar Receita" : "Nova Receita"}</DialogTitle>
                <DialogDescription>
                  {editingReceita ? "Edite os dados da receita" : "Adicione uma nova receita"}
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
                  <Button type="submit">{editingReceita ? "Atualizar" : "Salvar"}</Button>
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
              <CardTitle>Lista de Receitas</CardTitle>
              <CardDescription>Todas as receitas registradas no sistema</CardDescription>
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
              {getSortedReceitas().map((receita) => (
                <TableRow key={receita.id}>
                  <TableCell>{new Date(receita.date).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell className="capitalize">{receita.category}</TableCell>
                  <TableCell className="text-right font-medium text-green-600">
                    R$ {receita.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(receita)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setReceitaToDelete(receita)}>
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

      <AlertDialog open={!!receitaToDelete} onOpenChange={(open) => !open && setReceitaToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover esta receita? Esta ação não pode ser desfeita.
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
