
import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Upload } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { previewImport, confirmImport } from "@/lib/api-client"
import type { ImportPreview } from "@/lib/api-client"
import { formatDatePtBR } from "@/lib/dates"

export default function Importar() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return

    setFile(selected)
    setPreview(null)
    setIsLoading(true)
    try {
      const result = await previewImport(selected)
      setPreview(result)
    } catch (error) {
      console.error("Erro ao ler planilha:", error)
      toast({ title: "Erro", description: "Não foi possível ler o arquivo", variant: "destructive" })
      setFile(null)
    } finally {
      setIsLoading(false)
    }
  }

  const handleConfirm = async () => {
    if (!file) return
    setIsLoading(true)
    try {
      const result = await confirmImport(file)
      const description =
        result.duplicates > 0
          ? `${result.imported} lançamentos importados, ${result.duplicates} já existiam e foram ignorados`
          : `${result.imported} lançamentos importados`
      toast({ title: "Importação concluída", description })
      setFile(null)
      setPreview(null)
    } catch (error) {
      console.error("Erro ao importar planilha:", error)
      toast({ title: "Erro", description: "Não foi possível importar o arquivo", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Importar Planilha</h1>
        <p className="text-muted-foreground mt-2">
          Importe um balanço anual (planilha com aba "Despesas", uma linha por categoria e uma coluna por mês).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Selecionar arquivo</CardTitle>
          <CardDescription>Formatos aceitos: .xlsx, .xls</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            disabled={isLoading}
            className="text-sm"
          />

          {preview && (
            <div className="space-y-4">
              <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
                <div>
                  <p className="text-sm text-muted-foreground">Ano</p>
                  <p className="text-lg font-bold">{preview.year}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-lg font-bold">{preview.total}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Receitas</p>
                  <p className="text-lg font-bold text-green-600">{preview.receitas}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Despesas</p>
                  <p className="text-lg font-bold text-red-600">{preview.despesas}</p>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Categorias encontradas ({preview.categories.length})</p>
                <p className="text-sm text-muted-foreground">{preview.categories.join(", ")}</p>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Prévia (primeiros {preview.preview.length} lançamentos)</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.preview.map((entry, index) => (
                      <TableRow key={index}>
                        <TableCell>{formatDatePtBR(entry.date)}</TableCell>
                        <TableCell className="capitalize">{entry.category}</TableCell>
                        <TableCell
                          className={`text-right font-medium ${
                            entry.type === "receita" ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          R$ {entry.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <Button onClick={handleConfirm} disabled={isLoading}>
                <Upload className="mr-2 h-4 w-4" />
                {isLoading ? "Importando..." : "Confirmar Importação"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
