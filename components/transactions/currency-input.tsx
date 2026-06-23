"use client"

import type React from "react"

import { Input } from "@/components/ui/input"
import { forwardRef } from "react"

interface CurrencyInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  id?: string
}

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onChange, placeholder = "0,00", className, id }, ref) => {
    const formatCurrency = (inputValue: string) => {
      // Remove tudo que não é número
      const numbers = inputValue.replace(/\D/g, "")

      if (numbers === "") return ""

      // Converte para número e divide por 100 para ter os centavos
      const amount = Number.parseInt(numbers) / 100

      // Formata com vírgula decimal
      return amount.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value
      const formattedValue = formatCurrency(inputValue)
      onChange(formattedValue)
    }

    const getRawValue = () => {
      // Converte o valor formatado de volta para número
      return value.replace(/\./g, "").replace(",", ".")
    }

    return (
      <Input
        ref={ref}
        id={id}
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className={className}
      />
    )
  },
)

CurrencyInput.displayName = "CurrencyInput"

// Função utilitária para converter valor formatado para número
export const parseCurrencyValue = (formattedValue: string): number => {
  if (!formattedValue) return 0
  return Number.parseFloat(formattedValue.replace(/\./g, "").replace(",", "."))
}
