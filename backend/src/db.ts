import { Pool } from "pg"
import { logger } from "./lib/logger"

export const pool = new Pool({ connectionString: process.env.DATABASE_URL })

// Quando o Postgres reinicia, ele derruba as conexões ociosas do pool e o pg
// emite "error". Sem um listener, o Node encerra o app; com ele, a conexão é
// descartada e a próxima consulta abre uma nova.
pool.on("error", (error) => {
  logger.warn({ error }, "Conexão ociosa com o banco foi encerrada")
})
