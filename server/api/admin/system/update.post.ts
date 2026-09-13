export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const config = useRuntimeConfig()
  if (!config.updaterSecret) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Updater is niet geconfigureerd (UPDATER_SECRET ontbreekt).',
    })
  }

  let response: Response
  try {
    // The updater sidecar runs `git pull` + `docker compose up --build`
    // itself and only responds once that finishes, so this can take a
    // while -- give it much longer than a typical request timeout.
    response = await fetch(`${config.updaterUrl}/update`, {
      method: 'POST',
      headers: { 'x-updater-secret': config.updaterSecret },
      signal: AbortSignal.timeout(5 * 60 * 1000),
    })
  } catch (error) {
    throw createError({
      statusCode: 502,
      statusMessage: 'Updater niet bereikbaar.',
      data: error instanceof Error ? error.message : String(error),
    })
  }

  const body = await response.json()
  if (!response.ok) {
    throw createError({ statusCode: 502, statusMessage: 'Bijwerken mislukt.', data: body })
  }
  return body
})
