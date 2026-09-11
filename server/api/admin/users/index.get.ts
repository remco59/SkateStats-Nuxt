import { useDb } from '../../../db/client'
import { users } from '../../../db/schema'
import { requireAdmin } from '../../../utils/access'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const db = useDb()
  const rows = db.select().from(users).all()
  return rows.map(({ passwordHash: _passwordHash, ...safe }) => safe)
})
