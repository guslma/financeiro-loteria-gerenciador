"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { Badge } from "@/components/ui/badge"
import { Settings, Plus, X, Edit2, Check } from "lucide-react"
import { toast } from "@/hooks/use-toast"

interface CategoryManagerProps {
  type: "receita" | "despesa"
  onCategoriesChange?: () => void
}

const defaultCategories = {
  receita: ["Comissão Contas", "Comissão Bolão", "Comissão Jogos"],
  despesa: ["Salários", "Suprimentos", "Manutenção", "Contas Fixas", "Impostos"],
}

export function CategoryManager({ type, onCategoriesChange }: CategoryManagerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [allCategories, setAllCategories] = useState<string[]>([])
  const [newCategory, setNewCategory] = useState("")
  const [editingCategory, setEditingCategory] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState("")
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const storageKey = `all-categories-${type}`

  useEffect(() => {
    loadCategories()
  }, [type])

  const loadCategories = () => {
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const categories = JSON.parse(stored)
        const validCategories = categories.filter((cat: string) => cat && cat.trim() !== "")

        // Garantir que "Nova" está sempre no final
        const filtered = validCategories.filter((cat: string) => cat !== "Nova")
        setAllCategories([...filtered, "Nova"])
      } else {
        // Primeira vez, usar categorias padrão
        const defaults = defaultCategories[type]
        setAllCategories([...defaults, "Nova"])
        localStorage.setItem(storageKey, JSON.stringify([...defaults, "Nova"]))
      }
    } catch (error) {
      console.error("Erro ao carregar categorias:", error)
      const defaults = defaultCategories[type]
      setAllCategories([...defaults, "Nova"])
    }
  }

  const saveCategories = (categories: string[]) => {
    try {
      const filtered = categories.filter((cat) => cat && cat.trim() !== "" && cat !== "Nova")
      const final = [...filtered, "Nova"]

      localStorage.setItem(storageKey, JSON.stringify(final))
      setAllCategories(final)

      // Disparar evento customizado para outros componentes escutarem
      window.dispatchEvent(new CustomEvent(`categories-updated-${type}`))
    } catch (error) {
      console.error("Erro ao salvar categorias:", error)
      toast({
        title: "Erro",
        description: "Erro ao salvar categorias",
        variant: "destructive",
      })
    }
  }

  const addCategory = () => {
    if (!newCategory.trim()) {
      toast({
        title: "Erro",
        description: "Digite um nome para a categoria",
        variant: "destructive",
      })
      return
    }

    const categoryName = newCategory.trim()

    if (allCategories.includes(categoryName)) {
      toast({
        title: "Erro",
        description: "Esta categoria já existe",
        variant: "destructive",
      })
      return
    }

    const updated = allCategories.filter((cat) => cat !== "Nova")
    updated.push(categoryName)
    saveCategories(updated)
    setNewCategory("")

    toast({
      title: "Sucesso",
      description: "Categoria adicionada com sucesso",
    })
  }

  const startEditing = (category: string) => {
    if (category === "Nova") return
    setEditingCategory(category)
    setEditingValue(category)
  }

  const saveEdit = () => {
    if (!editingValue.trim()) {
      toast({
        title: "Erro",
        description: "O nome da categoria não pode estar vazio",
        variant: "destructive",
      })
      return
    }

    const newName = editingValue.trim()

    if (newName !== editingCategory && allCategories.includes(newName)) {
      toast({
        title: "Erro",
        description: "Já existe uma categoria com este nome",
        variant: "destructive",
      })
      return
    }

    const updated = allCategories
      .filter((cat) => cat !== "Nova")
      .map((cat) => (cat === editingCategory ? newName : cat))

    // Atualizar transações
    updateTransactionsCategory(editingCategory!, newName)

    saveCategories(updated)
    setEditingCategory(null)
    setEditingValue("")

    toast({
      title: "Sucesso",
      description: "Categoria atualizada com sucesso",
    })
  }

  const cancelEdit = () => {
    setEditingCategory(null)
    setEditingValue("")
  }

  const confirmDelete = (category: string) => {
    if (category === "Nova") return
    setCategoryToDelete(category)
  }

  const deleteCategory = async () => {
    if (!categoryToDelete || isDeleting) return

    setIsDeleting(true)

    try {
      // Verificar se está sendo usada
      const stored = localStorage.getItem("financial-transactions")
      if (stored) {
        const transactions = JSON.parse(stored)
        const isUsed = transactions.some((t: any) => t.type === type && t.category === categoryToDelete)

        if (isUsed) {
          toast({
            title: "Erro",
            description: "Esta categoria está sendo usada em transações existentes",
            variant: "destructive",
          })
          setCategoryToDelete(null)
          setIsDeleting(false)
          return
        }
      }

      // Remover categoria
      const updated = allCategories.filter((cat) => cat !== categoryToDelete && cat !== "Nova")

      // Salvar sem "Nova" primeiro, depois adicionar
      localStorage.setItem(storageKey, JSON.stringify([...updated, "Nova"]))

      // Atualizar estado local
      setAllCategories([...updated, "Nova"])

      // Disparar evento
      window.dispatchEvent(new CustomEvent(`categories-updated-${type}`))

      setCategoryToDelete(null)
      setIsDeleting(false)

      toast({
        title: "Sucesso",
        description: "Categoria removida com sucesso",
      })
    } catch (error) {
      console.error("Erro ao deletar categoria:", error)
      toast({
        title: "Erro",
        description: "Erro ao remover categoria",
        variant: "destructive",
      })
      setCategoryToDelete(null)
      setIsDeleting(false)
    }
  }

  const updateTransactionsCategory = (oldCategory: string, newCategory: string) => {
    try {
      const stored = localStorage.getItem("financial-transactions")
      if (stored) {
        const transactions = JSON.parse(stored)
        const updated = transactions.map((t: any) => {
          if (t.type === type && t.category === oldCategory) {
            return {
              ...t,
              category: newCategory,
              description: t.description.replace(oldCategory, newCategory),
            }
          }
          return t
        })
        localStorage.setItem("financial-transactions", JSON.stringify(updated))
      }
    } catch (error) {
      console.error("Erro ao atualizar transações:", error)
    }
  }

  const categoriesToShow = allCategories.filter((cat) => cat !== "Nova")

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Gerenciar Categorias
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Gerenciar Categorias de {type === "receita" ? "Receitas" : "Despesas"}</DialogTitle>
            <DialogDescription>Adicione, edite ou remova categorias personalizadas.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Adicionar nova categoria */}
            <div className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="newCategory">Nova Categoria</Label>
                <Input
                  id="newCategory"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && addCategory()}
                  placeholder="Digite o nome da categoria"
                  disabled={!!editingCategory}
                />
              </div>
              <div className="flex items-end">
                <Button onClick={addCategory} disabled={!!editingCategory}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Lista de categorias */}
            <div>
              <Label>Categorias Disponíveis ({categoriesToShow.length})</Label>
              <div className="mt-2 space-y-2 max-h-80 overflow-y-auto">
                {categoriesToShow.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">Nenhuma categoria encontrada.</p>
                ) : (
                  <div className="space-y-2">
                    {categoriesToShow.map((category) => (
                      <div key={category} className="flex items-center gap-2 p-2 border rounded-lg">
                        {editingCategory === category ? (
                          <>
                            <Input
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onKeyPress={(e) => {
                                if (e.key === "Enter") saveEdit()
                                if (e.key === "Escape") cancelEdit()
                              }}
                              className="flex-1"
                              autoFocus
                            />
                            <Button size="sm" onClick={saveEdit} variant="outline">
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button size="sm" onClick={cancelEdit} variant="outline">
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Badge variant="secondary" className="flex-1 justify-start">
                              {category}
                            </Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => startEditing(category)}
                              disabled={!!editingCategory}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => confirmDelete(category)}
                              disabled={!!editingCategory || isDeleting}
                              className="hover:bg-destructive hover:text-destructive-foreground"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)} disabled={!!editingCategory}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação */}
      <AlertDialog open={!!categoryToDelete && !isDeleting} onOpenChange={() => setCategoryToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover a categoria "{categoryToDelete}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteCategory}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Removendo..." : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
