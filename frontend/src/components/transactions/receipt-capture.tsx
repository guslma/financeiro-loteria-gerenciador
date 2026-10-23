import type React from "react"

import { useRef, useState } from "react"
import { Check, Loader2, ScanLine, Sparkles } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { extractReceipt, getReceiptUrl } from "@/lib/api-client"
import type { ReceiptExtraction } from "@/lib/api-client"

interface ReceiptCaptureProps {
  onExtracted: (data: ReceiptExtraction) => void
  onFileSelected: (file: File) => void
  existingPhotoUrl?: string | null
}

export function ReceiptCapture({ onExtracted, onFileSelected, existingPhotoUrl }: ReceiptCaptureProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    existingPhotoUrl ? getReceiptUrl(existingPhotoUrl) : null,
  )
  const [isProcessing, setIsProcessing] = useState(false)
  // Input escondido acionado pelo botão: no celular abre a câmera direto
  // (capture); no computador abre o seletor de arquivos.
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // Limpa o input pra permitir escolher a mesma foto de novo depois.
    e.target.value = ""
    if (!file) return

    setPreviewUrl(URL.createObjectURL(file))
    onFileSelected(file)
    setIsProcessing(true)

    try {
      const result = await extractReceipt(file)
      onExtracted(result)

      if (result.amountGuess === null && result.dateGuess === null && result.categoryGuess === null) {
        toast({
          title: "Aviso",
          description: "Não conseguimos identificar os dados da foto automaticamente, preencha manualmente",
        })
      }
    } catch (error) {
      console.error("Erro ao ler comprovante:", error)
      toast({
        title: "Aviso",
        description: "Não foi possível ler a foto automaticamente, preencha os dados manualmente",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const openCamera = () => cameraInputRef.current?.click()

  return (
    <div className="space-y-2">
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />

      {previewUrl ? (
        <div className="flex items-center gap-3.5 rounded-[14px] border border-blue-200 bg-blue-50 p-3">
          <div className="relative shrink-0">
            <img src={previewUrl} alt="Comprovante" className="h-[88px] w-[72px] rounded-lg border border-slate-300 bg-white object-cover" />
            {isProcessing && (
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-white/70">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 font-semibold text-blue-800">
              {isProcessing ? (
                "Lendo comprovante..."
              ) : (
                <>
                  <Check className="h-4 w-4" /> Comprovante anexado
                </>
              )}
            </p>
            <p className="mb-2 mt-1 text-[13px] text-slate-700">
              Os dados lidos da foto são uma sugestão. Confira antes de salvar.
            </p>
            <button
              type="button"
              onClick={openCamera}
              disabled={isProcessing}
              className="inline-flex h-[34px] items-center gap-1.5 rounded-[9px] border border-blue-300 bg-white px-3 font-medium text-blue-800 hover:bg-blue-50 disabled:opacity-60"
            >
              <ScanLine className="h-4 w-4" />
              Escanear de novo
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={openCamera}
          className="flex w-full items-center gap-3.5 rounded-[14px] border-2 border-dashed border-slate-400 bg-slate-50 p-3.5 text-left hover:border-blue-700 hover:bg-blue-50"
        >
          <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-blue-100 text-blue-700">
            <ScanLine className="h-[22px] w-[22px]" />
          </span>
          <span>
            <span className="block font-semibold">Escanear comprovante</span>
            <span className="flex items-center gap-1 text-[13px] text-slate-600">
              <Sparkles className="h-3 w-3" />
              Opcional. A IA preenche valor, data e categoria.
            </span>
          </span>
        </button>
      )}
    </div>
  )
}
