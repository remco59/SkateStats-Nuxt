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

function onPdfFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  pdfFile.value = input.files?.[0] ?? null
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
  <div class="space-y-8 max-w-xl">
    <h1 class="text-xl font-semibold">Importeren</h1>

    <section class="space-y-3">
      <h2 class="text-sm font-medium" style="color: var(--color-text-muted)">OSTA</h2>
      <input
        v-model="searchName"
        placeholder="Naam op OSTA (bv. Achternaam, Voornaam)"
        aria-label="Naam op OSTA"
        class="w-full rounded-md px-3 py-2 text-sm"
        style="border: 1px solid var(--color-border)"
      >
      <input
        v-model="season"
        placeholder="Seizoen (startjaar, bv. 2024)"
        aria-label="Seizoen"
        class="w-full rounded-md px-3 py-2 text-sm"
        style="border: 1px solid var(--color-border)"
      >
      <button
        class="rounded-md px-3 py-1.5 text-sm"
        style="background: var(--color-accent); color: var(--color-accent-contrast)"
        :disabled="submitting"
        @click="submitOstaSearch"
      >
        Zoeken
      </button>
      <p v-if="error" class="text-sm" style="color: var(--color-danger)">{{ error }}</p>
    </section>

    <section class="space-y-3">
      <h2 class="text-sm font-medium" style="color: var(--color-text-muted)">SpeedSkatingResults</h2>
      <div class="grid grid-cols-2 gap-2">
        <input
          v-model="ssrGivenName"
          placeholder="Voornaam"
          aria-label="Voornaam"
          class="rounded-md px-3 py-2 text-sm"
          style="border: 1px solid var(--color-border)"
        >
        <input
          v-model="ssrFamilyName"
          placeholder="Achternaam"
          aria-label="Achternaam"
          class="rounded-md px-3 py-2 text-sm"
          style="border: 1px solid var(--color-border)"
        >
      </div>
      <input
        v-model="ssrSeason"
        placeholder="Seizoen (startjaar, bv. 2024)"
        aria-label="Seizoen"
        class="w-full rounded-md px-3 py-2 text-sm"
        style="border: 1px solid var(--color-border)"
      >
      <button
        class="rounded-md px-3 py-1.5 text-sm"
        style="background: var(--color-accent); color: var(--color-accent-contrast)"
        :disabled="ssrSubmitting"
        @click="submitSsrSearch"
      >
        Zoeken
      </button>
      <p v-if="ssrError" class="text-sm" style="color: var(--color-danger)">{{ ssrError }}</p>
    </section>

    <section class="space-y-3">
      <h2 class="text-sm font-medium" style="color: var(--color-text-muted)">PDF uitslag</h2>
      <input
        v-model="pdfSkaterName"
        placeholder="Naam zoals op de uitslag (bv. Achternaam, Voornaam)"
        aria-label="Naam zoals op de uitslag"
        class="w-full rounded-md px-3 py-2 text-sm"
        style="border: 1px solid var(--color-border)"
      >
      <input
        type="file"
        accept="application/pdf"
        aria-label="PDF-bestand"
        class="w-full text-sm"
        @change="onPdfFileChange"
      >
      <button
        class="rounded-md px-3 py-1.5 text-sm"
        style="background: var(--color-accent); color: var(--color-accent-contrast)"
        :disabled="pdfSubmitting"
        @click="submitPdfUpload"
      >
        Uploaden
      </button>
      <p v-if="pdfError" class="text-sm" style="color: var(--color-danger)">{{ pdfError }}</p>
    </section>

    <p v-if="blacklistError" class="text-sm" style="color: var(--color-danger)">Kon blacklist niet laden.</p>
    <p v-if="blacklistActionError" class="text-sm" style="color: var(--color-danger)">{{ blacklistActionError }}</p>

    <section v-if="blacklistData?.competitionItems.length" class="space-y-2">
      <h2 class="text-sm font-medium" style="color: var(--color-text-muted)">
        Genegeerde wedstrijden ({{ blacklistData.competitionItems.length }})
      </h2>
      <ul class="text-sm space-y-1">
        <li v-for="item in blacklistData.competitionItems" :key="item.id" class="flex items-center justify-between">
          <span>{{ item.competitionName }} ({{ fmtDate(item.competitionDate) }})</span>
          <button class="underline" @click="removeCompetitionBlacklist(item.id)">Verwijderen</button>
        </li>
      </ul>
    </section>

    <section v-if="blacklistData?.raceItems.length" class="space-y-2">
      <h2 class="text-sm font-medium" style="color: var(--color-text-muted)">
        Genegeerde ritten ({{ blacklistData.raceItems.length }})
      </h2>
      <ul class="text-sm space-y-1">
        <li v-for="item in blacklistData.raceItems" :key="item.id" class="flex items-center justify-between">
          <span class="font-mono text-xs">{{ item.raceIdentitySignature }}</span>
          <button class="underline" @click="removeRaceBlacklist(item.id)">Verwijderen</button>
        </li>
      </ul>
    </section>
  </div>
</template>
