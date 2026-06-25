CREATE TABLE IF NOT EXISTS "Settings" (
  id SERIAL PRIMARY KEY,
  "storeName" TEXT NOT NULL DEFAULT 'Minha Lotérica'
);

CREATE TABLE IF NOT EXISTS "Category" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name, type)
);

CREATE TABLE IF NOT EXISTS "Transaction" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date TEXT NOT NULL,
  description TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  type TEXT NOT NULL,
  "categoryId" UUID NOT NULL REFERENCES "Category"(id),
  "receiptPhotoPath" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "Transaction_categoryId_idx" ON "Transaction" ("categoryId");
