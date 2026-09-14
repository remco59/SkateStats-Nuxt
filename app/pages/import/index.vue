<script setup lang="ts">
const router = useRouter()

const searchName = ref('')
const season = ref(String(new Date().getFullYear()))
const error = ref('')
const submitting = ref(false)

async function submitOstaSearch() {
  error.value = ''
  submitting.value = true
  try {
    const res = await $fetch('/api/import/osta/search', {
      method: 'POST',
      body: { searchName: searchName.value, season: season.value },
    })
    if (res.status === 'multiple_matches') {
      router.push({ path: '/import/osta/select', query: { searchName: searchName.value, season: season.value } })
    } else {
      router.push(`/import/preview?batchId=${res.batchId}`)
    }
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    error.value = err.data?.statusMessage || 'Importeren mislukt.'
  } finally {
    submitting.value = false
  }
}

const ssrGivenName = ref('')
const ssrFamilyName = ref('')
const ssrSeason = ref(String(new Date().getFullYear()))
const ssrError = ref('')
const ssrSubmitting = ref(false)

async function submitSsrSearch() {
  ssrError.value = ''
  ssrSubmitting.value = true
  try {
    const res = await $fetch('/api/import/ssr/search', {
      method: 'POST',
      body: { givenName: ssrGivenName.value, familyName: ssrFamilyName.value, season: ssrSeason.value },
    })
    router.push(`/import/preview?batchId=${res.batchId}`)
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    ssrError.value = err.data?.statusMessage || 'Importeren mislukt.'
  } finally {
    ssrSubmitting.value = false
  }
}

const pdfSkaterName = ref('')
const pdfFile = ref<File | null>(null)
const pdfError = ref('')
const pdfSubmitting = ref(false)
const pdfDragging = ref(false)
const pdfInput = ref<HTMLInputElement>()

function onPdfFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  pdfFile.value = input.files?.[0] ?? null
}

function onPdfDrop(e: DragEvent) {
  pdfDragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) pdfFile.value = file
}

async function submitPdfUpload() {
  pdfError.value = ''
  if (!pdfFile.value) {
    pdfError.value = 'Kies eerst een PDF-bestand.'
    return
  }
  pdfSubmitting.value = true
  try {
    const body = new FormData()
    body.append('file', pdfFile.value)
    body.append('skaterName', pdfSkaterName.value)
    const res = await $fetch('/api/import/pdf/upload', { method: 'POST', body })
    router.push(`/import/preview?batchId=${res.batchId}`)
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    pdfError.value = err.data?.statusMessage || 'Importeren mislukt.'
  } finally {
    pdfSubmitting.value = false
  }
}

const { data: blacklistData, error: blacklistError, refresh: refreshBlacklist } = await useFetch('/api/import/blacklist')
const blacklistActionError = ref('')

async function removeCompetitionBlacklist(id: number) {
  blacklistActionError.value = ''
  try {
    await $fetch(`/api/import/blacklist/competition/${id}`, { method: 'DELETE' })
    await refreshBlacklist()
  } catch {
    blacklistActionError.value = 'Verwijderen mislukt.'
  }
}
async function removeRaceBlacklist(id: number) {
  blacklistActionError.value = ''
  try {
    await $fetch(`/api/import/blacklist/race/${id}`, { method: 'DELETE' })
    await refreshBlacklist()
  } catch {
    blacklistActionError.value = 'Verwijderen mislukt.'
  }
}
</script>

<template>
  <div class="space-y-8">
    <h1 class="page-title">Importeren</h1>

    <div class="grid md:grid-cols-3 gap-5 items-start">
      <section class="card space-y-3">
        <div>
          <h2 class="card-title">OSTA</h2>
          <p class="text-xs" style="color: var(--color-text-muted)">Zoek en importeer wedstrijden van osta.nl.</p>
        </div>
        <input v-model="searchName" placeholder="Naam op OSTA (bv. Achternaam, Voornaam)" aria-label="Naam op OSTA" class="field">
        <input v-model="season" placeholder="Seizoen (startjaar, bv. 2024)" aria-label="Seizoen" class="field">
        <button type="button" class="btn btn-primary w-full" :disabled="submitting" @click="submitOstaSearch">
          {{ submitting ? 'Bezig...' : 'Zoeken' }}
        </button>
        <p v-if="error" class="text-sm" style="color: var(--color-danger)">{{ error }}</p>
      </section>

      <section class="card space-y-3">
        <div>
          <h2 class="card-title">SpeedSkatingResults</h2>
          <p class="text-xs" style="color: var(--color-text-muted)">Zoek en importeer wedstrijden van speedskatingresults.com.</p>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <input v-model="ssrGivenName" placeholder="Voornaam" aria-label="Voornaam" class="field">
          <input v-model="ssrFamilyName" placeholder="Achternaam" aria-label="Achternaam" class="field">
        </div>
        <input v-model="ssrSeason" placeholder="Seizoen (startjaar, bv. 2024)" aria-label="Seizoen" class="field">
        <button type="button" class="btn btn-primary w-full" :disabled="ssrSubmitting" @click="submitSsrSearch">
          {{ ssrSubmitting ? 'Bezig...' : 'Zoeken' }}
        </button>
        <p v-if="ssrError" class="text-sm" style="color: var(--color-danger)">{{ ssrError }}</p>
      </section>

      <section class="card space-y-3">
        <div>
          <h2 class="card-title">PDF-uitslag</h2>
          <p class="text-xs" style="color: var(--color-text-muted)">Upload een PDF-uitslag om ritten te importeren.</p>
        </div>
        <input v-model="pdfSkaterName" placeholder="Naam zoals op de uitslag (bv. Achternaam, Voornaam)" aria-label="Naam zoals op de uitslag" class="field">
        <div
          class="rounded-md px-3 py-5 text-center text-sm cursor-pointer transition-colors"
          :style="{
            border: `1px dashed ${pdfDragging ? 'var(--color-accent)' : 'var(--color-border-strong)'}`,
            background: pdfDragging ? 'color-mix(in srgb, var(--color-accent) 8%, transparent)' : 'var(--color-surface-2)',
          }"
          @click="pdfInput?.click()"
          @dragover.prevent="pdfDragging = true"
          @dragleave.prevent="pdfDragging = false"
          @drop.prevent="onPdfDrop"
        >
          <input
            ref="pdfInput"
            type="file"
            accept="application/pdf"
            aria-label="PDF-bestand"
            class="sr-only"
            @change="onPdfFileChange"
          >
          <p v-if="pdfFile" class="font-mono truncate">{{ pdfFile.name }}</p>
          <p v-else style="color: var(--color-text-muted)">Sleep een PDF hierheen of klik om te kiezen</p>
        </div>
        <button type="button" class="btn btn-primary w-full" :disabled="pdfSubmitting" @click="submitPdfUpload">
          {{ pdfSubmitting ? 'Bezig...' : 'Uploaden' }}
        </button>
        <p v-if="pdfError" class="text-sm" style="color: var(--color-danger)">{{ pdfError }}</p>
      </section>
    </div>

    <p v-if="blacklistError" class="text-sm" style="color: var(--color-danger)">Kon blacklist niet laden.</p>
    <p v-if="blacklistActionError" class="text-sm" style="color: var(--color-danger)">{{ blacklistActionError }}</p>

    <section v-if="blacklistData?.competitionItems.length || blacklistData?.raceItems.length" class="space-y-4">
      <h2 class="section-heading">Genegeerd bij import</h2>

      <div v-if="blacklistData.competitionItems.length" class="space-y-1">
        <p class="text-xs" style="color: var(--color-text-faint)">
          Wedstrijden ({{ blacklistData.competitionItems.length }})
        </p>
        <ul class="text-sm space-y-1">
          <li v-for="item in blacklistData.competitionItems" :key="item.id" class="flex items-center justify-between gap-2">
            <span style="color: var(--color-text-muted)">{{ item.competitionName }} ({{ fmtDate(item.competitionDate) }})</span>
            <button type="button" class="btn-link text-xs" @click="removeCompetitionBlacklist(item.id)">Verwijderen</button>
          </li>
        </ul>
      </div>

      <div v-if="blacklistData.raceItems.length" class="space-y-1">
        <p class="text-xs" style="color: var(--color-text-faint)">
          Ritten ({{ blacklistData.raceItems.length }})
        </p>
        <ul class="text-sm space-y-1">
          <li v-for="item in blacklistData.raceItems" :key="item.id" class="flex items-center justify-between gap-2">
            <span class="font-mono text-xs" style="color: var(--color-text-muted)">{{ item.raceIdentitySignature }}</span>
            <button type="button" class="btn-link text-xs" @click="removeRaceBlacklist(item.id)">Verwijderen</button>
          </li>
        </ul>
      </div>
    </section>
  </div>
</template>
