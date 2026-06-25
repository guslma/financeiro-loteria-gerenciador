
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
import { fetchCategories, createCategory, renameCategory, deleteCategory as deleteCategoryRequest } from "@/lib/api-client"
import type { Category } from "@/lib/api-client"

interface CategoryManagerProps {
  type: "receita" | "despesa"
}

export function CategoryManager({ type }: CategoryManagerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [newCategory, setNewCategory] = useState("")
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [editingValue, setEditingValue] = useState("")
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    loadCategories()
  }, [type])

  const loadCategories = async () => {
    try {
      const data = await fetchCategories(type)
      setCategories(data)
    } catch (error) {
      console.error("Erro ao carregar categorias:", error)
      toast({ title: "Erro", description: "Erro ao carregar categorias", variant: "destructive" })
    }
  }

  const notifyChange = () => {
    window.dispatchEvent(new CustomEvent(`categories-updated-${type}`))
  }

  const addCategory = async () => {
    if (!newCategory.trim()) {
      toast({ title: "Erro", description: "Digite um nome para a categoria", variant: "destructive" })
      return
    }

    try {
      await createCategory(newCategory.trim(), type)
      setNewCategory("")
      await loadCategories()
      notifyChange()
      toast({ title: "Sucesso", description: "Categoria adicionada com sucesso" })
    } catch {
      toast({ title: "Erro", description: "Esta categoria já existe", variant: "destructive" })
    }
  }

  const startEditing = (category: Category) => {
    setEditingCategory(category)
    setEditingValue(category.name)
  }

  const saveEdit = async () => {
    if (!editingValue.trim() || !editingCategory) {
      toast({ title: "Erro", description: "O nome da categoria não pode estar vazio", variant: "destructive" })
      return
    }

    try {
      await renameCategory(editingCategory.id, editingValue.trim())
      setEditingCategory(null)
      setEditingValue("")
      await loadCategories()
      notifyChange()
      toast({ title: "Sucesso", description: "Categoria atualizada com sucesso" })
    } catch {
      toast({ title: "Erro", description: "Já existe uma categoria com este nome", variant: "destructive" })
    }
  }

  const cancelEdit = () => {
    setEditingCategory(null)
    setEditingValue("")
  }

  const confirmDelete = (category: Category) => {
    setCategoryToDelete(category)
  }

  const handleDelete = async () => {
    if (!categoryToDelete || isDeleting) return

    setIsDeleting(true)
    try {
      await deleteCategoryRequest(categoryToDelete.id)
      setCategoryToDelete(null)
      await loadCategories()
      notifyChange()
      toast({ title: "Sucesso", description: "Categoria removida com sucesso" })
    } catch {
      toast({
        title: "Erro",
        description: "Esta categoria está sendo usada em transações existentes",
        variant: "destructive",
      })
      setCategoryToDelete(null)
    } finally {
      setIsDeleting(false)
    }
  }

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
              <Label>Categorias Disponíveis ({categories.length})</Label>
              <div className="mt-2 space-y-2 max-h-80 overflow-y-auto">
                {categories.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">Nenhuma categoria encontrada.</p>
                ) : (
                  <div className="space-y-2">
                    {categories.map((category) => (
                      <div key={category.id} className="flex items-center gap-2 p-2 border rounded-lg">
                        {editingCategory?.id === category.id ? (
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
                              {category.name}
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
              Tem certeza que deseja remover a categoria "{categoryToDelete?.name}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
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
