
import type React from "react"

import { useRef, useState } from "react"
import { Link } from "react-router-dom"
import { Check, FileSpreadsheet, FileUp, Loader2 } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { previewImport, confirmImport } from "@/lib/api-client"
import type { ImportPreview } from "@/lib/api-client"
import { formatDatePtBR } from "@/lib/dates"
import { money } from "@/lib/finance"
import { cn } from "@/lib/utils"

export default function Importar() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [done, setDone] = useState<{ imported: number; duplicates: number; year: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const readFile = async (selected: File) => {
    setFile(selected)
    setPreview(null)
    setDone(null)
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    e.target.value = ""
    if (selected) readFile(selected)
  }

  const handleConfirm = async () => {
    if (!file || !preview) return
    setIsLoading(true)
    try {
      const result = await confirmImport(file)
      setDone({ ...result, year: preview.year })
      setFile(null)
      setPreview(null)
    } catch (error) {
      console.error("Erro ao importar planilha:", error)
      toast({ title: "Erro", description: "Não foi possível importar o arquivo", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  const restart = () => {
    setFile(null)
    setPreview(null)
    setDone(null)
  }

  const step = done ? 3 : preview ? 2 : 1
  const steps = ["Escolher arquivo", "Conferir", "Pronto"]

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 text-[14px] text-slate-900">
      <div>
        <Link to="/" className="font-medium text-blue-700 hover:text-blue-900">
          ← Visão geral
        </Link>
        <h1 className="mt-2 text-[28px] font-bold tracking-tight">Importar planilha</h1>
        <p className="mt-1 text-slate-600">
          Traga o balanço anual que você já tem em Excel (aba "Despesas", uma linha por categoria e uma coluna por mês). Nada
          é gravado antes de você conferir.
        </p>
      </div>

      <ol aria-label="Etapas" className="grid grid-cols-3 gap-2">
        {steps.map((label, i) => {
          const n = i + 1
          const current = n === step
          const finished = n < step
          return (
            <li
              key={label}
              aria-current={current ? "step" : undefined}
              className={cn("flex items-center gap-2.5 rounded-xl border p-3", current ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white")}
            >
              <span
                className={cn(
                  "flex h-7 w-7 flex-none items-center justify-center rounded-full font-bold",
                  current || finished ? "bg-blue-700 text-white" : "bg-slate-200 text-slate-600",
                )}
              >
                {finished ? <Check className="h-4 w-4" /> : n}
              </span>
              <span className={cn("font-semibold", current ? "text-blue-800" : "text-slate-700")}>{label}</span>
            </li>
          )
        })}
      </ol>

      <input ref={inputRef} type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="hidden" aria-hidden="true" tabIndex={-1} />

      {step === 1 && (
        <section className="rounded-[14px] border border-slate-200 bg-white/90 p-6">
          <button
            type="button"
            disabled={isLoading}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              const dropped = e.dataTransfer.files?.[0]
              if (dropped) readFile(dropped)
            }}
            className={cn(
              "flex w-full flex-col items-center gap-2.5 rounded-[14px] border-2 border-dashed px-5 py-12",
              dragging ? "border-blue-700 bg-blue-50" : "border-slate-400 bg-slate-50 hover:border-blue-700 hover:bg-blue-50",
            )}
          >
            {isLoading ? <Loader2 className="h-10 w-10 animate-spin text-blue-700" /> : <FileUp className="h-10 w-10 text-blue-700" />}
            <span className="text-[17px] font-bold">{isLoading ? "Lendo a planilha..." : "Arraste a planilha aqui ou clique para escolher"}</span>
            <span className="text-slate-600">Arquivos .xlsx ou .xls</span>
          </button>
        </section>
      )}

      {step === 2 && preview && (
        <section className="flex flex-col gap-[18px] rounded-[14px] border border-slate-200 bg-white/90 p-5">
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[10px] bg-green-100 text-green-700">
              <FileSpreadsheet className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{file?.name}</span>
              <span className="block text-xs text-slate-500">Lida sem erros</span>
            </span>
            <button type="button" onClick={() => inputRef.current?.click()} className="h-9 rounded-[9px] border border-slate-300 bg-white px-3 font-medium hover:bg-slate-50">
              Trocar arquivo
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-xl bg-slate-50 p-3.5"><div className="text-slate-600">Ano</div><div className="text-[22px] font-bold">{preview.year}</div></div>
            <div className="rounded-xl bg-slate-50 p-3.5"><div className="text-slate-600">Lançamentos</div><div className="text-[22px] font-bold tabular-nums">{preview.total}</div></div>
            <div className="rounded-xl bg-emerald-50 p-3.5"><div className="text-emerald-700">Receitas</div><div className="text-[22px] font-bold tabular-nums text-emerald-700">{preview.receitas}</div></div>
            <div className="rounded-xl bg-rose-50 p-3.5"><div className="text-rose-700">Despesas</div><div className="text-[22px] font-bold tabular-nums text-rose-700">{preview.despesas}</div></div>
          </div>

          <div>
            <h2 className="mb-2 text-[15px] font-bold">{preview.categories.length} categorias encontradas</h2>
            <div className="flex flex-wrap gap-1.5">
              {preview.categories.map((c) => (
                <span key={c} className="rounded-full bg-slate-100 px-2.5 py-1 text-[13px] font-medium capitalize text-slate-700">{c}</span>
              ))}
            </div>
          </div>

          <div>
            <h2 className="mb-2 text-[15px] font-bold">Prévia dos primeiros lançamentos</h2>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[560px] border-collapse tabular-nums">
                <thead>
                  <tr className="bg-slate-50 text-left text-slate-600">
                    <th scope="col" className="px-3 py-2.5 font-semibold">Data</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">Categoria</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">Tipo</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-semibold">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.preview.map((entry, index) => {
                    const isRec = entry.type === "receita"
                    return (
                      <tr key={index} className="border-t border-slate-100">
                        <td className="px-3 py-2 text-slate-600">{formatDatePtBR(entry.date)}</td>
                        <td className="px-3 py-2 capitalize">{entry.category}</td>
                        <td className="px-3 py-2">
                          <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", isRec ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>
                            {isRec ? "Receita" : "Despesa"}
                          </span>
                        </td>
                        <td className={cn("px-3 py-2 text-right font-semibold", isRec ? "text-emerald-700" : "text-rose-700")}>{money(entry.amount)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2.5">
            <button type="button" onClick={restart} className="h-11 rounded-[10px] border border-slate-300 bg-white px-[18px] font-medium hover:bg-slate-50">
              Cancelar
            </button>
            <button type="button" onClick={handleConfirm} disabled={isLoading} className="h-11 rounded-[10px] bg-blue-700 px-5 font-semibold text-white hover:bg-blue-800 disabled:opacity-60">
              {isLoading ? "Importando..." : `Importar ${preview.total} lançamentos`}
            </button>
          </div>
        </section>
      )}

      {step === 3 && done && (
        <section className="flex flex-col items-center gap-2.5 rounded-[14px] border border-slate-200 bg-white/90 px-6 py-10 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-700">
            <Check className="h-7 w-7" />
          </span>
          <h2 className="text-xl font-bold">
            {done.imported} lançamentos de {done.year} importados
          </h2>
          <p className="text-slate-600">
            {done.duplicates > 0 ? `${done.duplicates} já existiam e ficaram de fora. ` : ""}Eles já aparecem na Visão geral.
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-2.5">
            <Link to="/" className="inline-flex h-11 items-center rounded-[10px] bg-blue-700 px-[18px] font-semibold text-white hover:bg-blue-800">
              Ir para a Visão geral
            </Link>
            <button type="button" onClick={restart} className="h-11 rounded-[10px] border border-slate-300 bg-white px-[18px] font-medium hover:bg-slate-50">
              Importar outra
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
