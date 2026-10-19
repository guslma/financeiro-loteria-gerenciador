import type { NextFunction, Request, RequestHandler, Response } from "express"

// O Express 4 não captura erros de handlers async: uma Promise rejeitada
// (ex.: banco fora do ar) vira unhandled rejection e derruba o processo.
// Este wrapper encaminha o erro para o error handler do index.ts (500).
export function asyncHandler(handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next)
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Usado com router.param("id", ...): IDs que não são UUID nunca existem no
// banco, então respondemos 404 em vez de deixar o Postgres rejeitar a query.
export function requireUuidParam(_req: Request, res: Response, next: NextFunction, value: string) {
  if (!UUID_RE.test(value)) {
    return res.status(404).json({ error: "Registro não encontrado" })
  }
  next()
}
