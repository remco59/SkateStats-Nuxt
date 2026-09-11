import { z } from 'zod'
import { useDb } from '../../../db/client'
import { users } from '../../../db/schema'
import { requireAdmin } from '../../../utils/access'

const bodySchema = z.object({
  username: z.string().min(1).max(100),
  skaterName: z.string().min(1).max(200),
  password: z.string().min(8),
  isAdmin: z.boolean().optional().default(false),
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readValidatedBody(event, bodySchema.parse)

  const db = useDb()
  const passwordHash = await hashPassword(body.password)
  const now = new Date().toISOString()

  const created = db
    .insert(users)
    .values({
      username: body.username,
      skaterName: body.skaterName,
      passwordHash,
      isAdmin: body.isAdmin,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get()

  const { passwordHash: _passwordHash, ...safe } = created
  return safe
})
