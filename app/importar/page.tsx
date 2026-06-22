"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "@/hooks/use-toast"
import { previewImport, confirmImport } from "@/lib/api-client"
import type { ImportPreview } from "@/lib/api-client"

export default function ImportarPage() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] ?? null)
    setPreview(null)
  }

  const handlePreview = async () => {
    if (!file) return
    setIsLoading(true)
    try {
      const result = await previewImport(file)
      setPreview(result)
      if (result.total === 0) {
        toast({
          title: "Nenhuma transação encontrada",
          description: "Confira se a planilha tem as colunas Data, Categoria e Entrada/Saída.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Erro ao ler planilha:", error)
      toast({ title: "Erro", description: "Não foi possível ler o arquivo", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  const handleConfirm = async () => {
    if (!file) return
    setIsLoading(true)
    try {
      const result = await confirmImport(file)
      toast({ title: "Importação concluída", description: `${result.imported} transações importadas` })
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
        <h1 className="text-3xl font-bold">Importar Planilha</h1>
        <p className="text-muted-foreground mt-2">
          Importe receitas e despesas de uma planilha .xlsx ou .xls (uma linha por lançamento, com colunas de Data,
          Categoria, Entrada/Saída).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Selecionar arquivo</CardTitle>
          <CardDescription>Cada arquivo é processado uma vez — não envie o mesmo arquivo duas vezes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="spreadsheet">Arquivo (.xlsx ou .xls)</Label>
            <Input id="spreadsheet" type="file" accept=".xlsx,.xls" onChange={handleFileChange} disabled={isLoading} />
          </div>
          <Button onClick={handlePreview} disabled={!file || isLoading}>
            {isLoading ? "Lendo..." : "Pré-visualizar"}
          </Button>
        </CardContent>
      </Card>

      {preview && (
        <Card>
          <CardHeader>
            <CardTitle>Prévia</CardTitle>
            <CardDescription>
              {preview.total} transações encontradas ({preview.receitas} receitas, {preview.despesas} despesas)
              {preview.skipped > 0 && ` — ${preview.skipped} linhas ignoradas (sem data/categoria/valor reconhecíveis)`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {preview.categories.map((category) => (
                <Badge key={category} variant="secondary">
                  {category}
                </Badge>
              ))}
            </div>

            {preview.preview.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.preview.map((t, index) => (
                    <TableRow key={index}>
                      <TableCell>{new Date(t.date).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell className="capitalize">{t.type}</TableCell>
                      <TableCell>{t.category}</TableCell>
                      <TableCell>{t.description}</TableCell>
                      <TableCell className="text-right">
                        R$ {t.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {preview.total > 0 && (
              <Button onClick={handleConfirm} disabled={isLoading}>
                {isLoading ? "Importando..." : `Confirmar importação de ${preview.total} transações`}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
