import { z } from 'zod'
import { useDb } from '../../../db/client'
import { requireAdmin } from '../../../utils/access'
import { accountErrorToHttp, checkNewPassword, createUserAccount } from '../../../utils/accounts'

const bodySchema = z.object({
  username: z.string().max(100),
  skaterName: z.string().max(200),
  password: z.string(),
  confirmPassword: z.string(),
  isAdmin: z.boolean().optional().default(false),
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readValidatedBody(event, bodySchema.parse)

  const db = useDb()
  try {
    checkNewPassword(body.password, body.confirmPassword)
    const created = createUserAccount(db, {
      username: body.username,
      skaterName: body.skaterName,
      passwordHash: await hashPassword(body.password),
      isAdmin: body.isAdmin,
    })
    const { passwordHash: _passwordHash, ...safe } = created
    return safe
  } catch (err) {
    accountErrorToHttp(err)
  }
})
