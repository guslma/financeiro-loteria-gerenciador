-- Código de barras (só dígitos) e beneficiário lidos do comprovante pela IA.
-- Servem pra sugerir a categoria de comprovantes novos a partir do histórico.
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS payee TEXT;
