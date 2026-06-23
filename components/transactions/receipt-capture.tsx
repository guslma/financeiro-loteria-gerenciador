"use client"

import type React from "react"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"
import { toast } from "@/hooks/use-toast"

interface ReceiptCaptureProps {
  onExtracted: (data: { amountGuess: number | null; dateGuess: string | null; categoryGuess: string | null }) => void
  onFileSelected: (file: File) => void
  existingPhotoUrl?: string | null
}

export function ReceiptCapture({ onExtracted, onFileSelected, existingPhotoUrl }: ReceiptCaptureProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(existingPhotoUrl ?? null)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setPreviewUrl(URL.createObjectURL(file))
    onFileSelected(file)
    setIsProcessing(true)

    try {
      const { extractReceiptData } = await import("@/lib/receipt-ocr")
      const result = await extractReceiptData(file)
      onExtracted(result)
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

  return (
    <div className="space-y-2">
      <Label htmlFor="receipt-photo">Foto do comprovante (opcional)</Label>
      <Input
        id="receipt-photo"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        disabled={isProcessing}
      />
      {isProcessing && (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin" />
          Lendo comprovante...
        </p>
      )}
      {previewUrl && !isProcessing && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt="Comprovante" className="h-24 rounded border object-cover" />
      )}
      <p className="text-xs text-muted-foreground">
        O valor e a data lidos da foto são apenas uma sugestão — confira antes de salvar.
      </p>
    </div>
  )
}
