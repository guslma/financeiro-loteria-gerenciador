import type React from "react"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Loader2, ScanLine, Sparkles } from "lucide-react"
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
      <Label>Comprovante (opcional)</Label>

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
        <div className="flex items-center gap-3 rounded-lg border p-3">
          <div className="relative shrink-0">
            <img src={previewUrl} alt="Comprovante" className="h-20 w-20 rounded border object-cover" />
            {isProcessing && (
              <div className="absolute inset-0 flex items-center justify-center rounded bg-background/70">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-sm font-medium">
              {isProcessing ? "Lendo comprovante..." : "Comprovante anexado"}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={openCamera} disabled={isProcessing}>
              <ScanLine />
              Escanear novamente
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2 rounded-lg border border-dashed p-3">
          <Button type="button" variant="outline" className="h-12 w-full text-base" onClick={openCamera}>
            <ScanLine className="!size-5" />
            Escanear comprovante
          </Button>
          <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3" />
            A IA preenche valor, data e categoria pra você
          </p>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Os dados lidos da foto são apenas uma sugestão — confira antes de salvar.
      </p>
    </div>
  )
}
