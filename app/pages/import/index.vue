<script setup lang="ts">
const route = useRoute()
const router = useRouter()

// What the forms start with (like the old import page): the account's skater
// name, the linked OSTA profile, the current season.
const { data: defaults } = await useFetch('/api/import/defaults')

const searchName = ref(defaults.value?.osta.searchName ?? '')
const ostaPid = ref(defaults.value?.osta.pid ?? '')
const season = ref(defaults.value?.osta.season ?? String(new Date().getFullYear()))
const error = ref('')
const submitting = ref(false)

async function submitOstaSearch() {
  error.value = ''
  submitting.value = true
  try {
    const res = await $fetch('/api/import/osta/search', {
      method: 'POST',
      body: { searchName: searchName.value, season: season.value, pid: ostaPid.value },
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

const ssrGivenName = ref(defaults.value?.ssr.givenName ?? '')
const ssrFamilyName = ref(defaults.value?.ssr.familyName ?? '')
const ssrSkaterId = ref('')
const ssrSeason = ref(defaults.value?.ssr.season ?? String(new Date().getFullYear()))
const ssrError = ref('')
const ssrSubmitting = ref(false)

async function submitSsrSearch() {
  ssrError.value = ''
  ssrSubmitting.value = true
  try {
    const res = await $fetch('/api/import/ssr/search', {
      method: 'POST',
      body: {
        skaterId: ssrSkaterId.value,
        givenName: ssrGivenName.value,
        familyName: ssrFamilyName.value,
        season: ssrSeason.value,
      },
    })
    router.push(`/import/preview?batchId=${res.batchId}`)
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string; message?: string } }
    ssrError.value = err.data?.statusMessage || 'Importeren mislukt.'
  } finally {
    ssrSubmitting.value = false
  }
}

const pdfSkaterName = ref(defaults.value?.skaterName ?? '')
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

// ---- Banner after a preview was imported / cancelled ----------------------
const num = (v: unknown) => Number(Array.isArray(v) ? v[0] : v) || 0
const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
const banner = computed(() => {
  const q = route.query
  if (q.notice === 'cancelled') return { tone: 'success', text: 'Import geannuleerd.' }
  if (q.notice === 'nothing') return { tone: 'warning', text: 'Geen nieuwe data geïmporteerd.' }
  if (q.notice === 'imported') {
    return {
      tone: 'success',
      text: `${count(num(q.competitions), 'wedstrijd', 'wedstrijden')} aangemaakt, ${count(num(q.races), 'rit', 'ritten')} geïmporteerd en ${count(num(q.updated), 'bestaande rit', 'bestaande ritten')} bijgewerkt.`,
    }
  }
  return null
})

// ---- Blacklist ("Genegeerd bij import") -----------------------------------
const { data: blacklistData, error: blacklistError, refresh: refreshBlacklist } = await useFetch('/api/import/blacklist')
const blacklistMessage = ref<{ tone: 'success' | 'warning'; text: string } | null>(null)
const selectedCompetitions = ref<number[]>([])
const selectedRaces = ref<number[]>([])

const blacklistTotal = computed(
  () => (blacklistData.value?.competitionItems.length ?? 0) + (blacklistData.value?.raceItems.length ?? 0),
)
const selectedCount = computed(() => selectedCompetitions.value.length + selectedRaces.value.length)
const allSelected = computed(() => blacklistTotal.value > 0 && selectedCount.value === blacklistTotal.value)

function toggleAllBlacklist() {
  if (allSelected.value) {
    selectedCompetitions.value = []
    selectedRaces.value = []
  } else {
    selectedCompetitions.value = (blacklistData.value?.competitionItems ?? []).map((i) => i.id)
    selectedRaces.value = (blacklistData.value?.raceItems ?? []).map((i) => i.id)
  }
}

async function removeSelectedFromBlacklist() {
  blacklistMessage.value = null
  if (!selectedCount.value) {
    blacklistMessage.value = { tone: 'warning', text: 'Selecteer minimaal één item om van de blacklist te halen.' }
    return
  }
  try {
    const res = await $fetch('/api/import/blacklist/remove', {
      method: 'POST',
      body: { competitionIds: selectedCompetitions.value, raceIds: selectedRaces.value },
    })
    blacklistMessage.value = {
      tone: 'success',
      text: res.removed === 1 ? '1 item van de blacklist gehaald.' : `${res.removed} items van de blacklist gehaald.`,
    }
    selectedCompetitions.value = []
    selectedRaces.value = []
    await refreshBlacklist()
  } catch {
    blacklistMessage.value = { tone: 'warning', text: 'Verwijderen mislukt.' }
  }
}
</script>

<template>
  <div class="space-y-8">
    <h1 class="page-title">Importeren</h1>

    <p v-if="banner" class="notice" :class="banner.tone === 'success' ? 'notice-accent' : ''" role="status">
      {{ banner.text }}
    </p>

    <section class="card">
      <p class="text-secondary text-sm">
        De import zoekt alle ritten voor <strong>{{ defaults?.skaterName }}</strong> en toont eerst een preview. Daar kies je per
        wedstrijd welke ritten je wilt importeren. Je kunt resultaten ophalen uit OSTA, SpeedSkatingResults en PDF-uitslagen.
      </p>
    </section>

    <div class="grid md:grid-cols-3 gap-5 items-start">
      <section class="card space-y-3">
        <div>
          <h2 class="card-title">OSTA</h2>
          <p class="text-xs" style="color: var(--color-text-muted)">Zoek en importeer wedstrijden van osta.nl.</p>
        </div>
        <input v-model="searchName" placeholder="Naam op OSTA (bv. Achternaam, Voornaam)" aria-label="Naam op OSTA" class="field">
        <input v-model="ostaPid" placeholder="PID (optioneel)" aria-label="OSTA PID" class="field font-mono">
        <p class="text-xs" style="color: var(--color-text-faint)">Met een PID wordt het zoeken op naam overgeslagen.</p>
        <input v-model="season" placeholder="Seizoen (startjaar, bv. 2024, of ALL)" aria-label="Seizoen" class="field">
        <p class="text-xs" style="color: var(--color-text-faint)">Startjaar van het seizoen, of <strong>ALL</strong> voor alle seizoenen.</p>
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
        <input v-model="ssrSkaterId" placeholder="Skater ID (optioneel)" aria-label="Skater ID" class="field font-mono">
        <p class="text-xs" style="color: var(--color-text-faint)">Met een Skater ID wordt het zoeken op naam overgeslagen.</p>
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
        <p class="text-xs" style="color: var(--color-text-faint)">Alleen ritten voor deze naam worden geïmporteerd.</p>
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

    <section class="card space-y-3" aria-labelledby="blacklist-title">
      <div>
        <h2 id="blacklist-title" class="card-title">Genegeerd bij import ({{ blacklistTotal }})</h2>
        <p class="text-xs" style="color: var(--color-text-muted)">
          Items in deze lijst worden in de import-preview direct als genegeerd gemarkeerd.
        </p>
      </div>

      <p v-if="blacklistError" class="text-sm" style="color: var(--color-danger)">Kon blacklist niet laden.</p>
      <p
        v-if="blacklistMessage"
        class="text-sm"
        :style="{ color: blacklistMessage.tone === 'success' ? 'var(--color-success)' : 'var(--color-danger)' }"
        role="status"
      >
        {{ blacklistMessage.text }}
      </p>

      <template v-if="blacklistTotal">
        <div class="flex flex-wrap gap-2">
          <button type="button" class="btn btn-secondary btn-sm" @click="toggleAllBlacklist">
            {{ allSelected ? 'Deselecteer alles' : 'Selecteer alles' }}
          </button>
          <button type="button" class="btn btn-secondary btn-sm" @click="removeSelectedFromBlacklist">
            Haal geselecteerde van blacklist
          </button>
        </div>

        <div class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th class="w-8"><span class="sr-only">Selecteer</span></th>
                <th>Wedstrijd / rit</th>
                <th class="num">Datum</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in blacklistData!.competitionItems" :key="`c${item.id}`">
                <td>
                  <input v-model="selectedCompetitions" type="checkbox" :value="item.id" :aria-label="`Selecteer ${item.competitionName}`">
                </td>
                <td>{{ item.competitionName }}</td>
                <td class="num font-mono text-meta">{{ fmtDate(item.competitionDate) }}</td>
              </tr>
              <tr v-for="item in blacklistData!.raceItems" :key="`r${item.id}`">
                <td>
                  <input v-model="selectedRaces" type="checkbox" :value="item.id" :aria-label="`Selecteer rit ${item.label}`">
                </td>
                <td>
                  <span class="font-mono text-sm">{{ item.label }}</span>
                  <span class="text-meta"> &middot; {{ item.competitionName }}</span>
                </td>
                <td class="num font-mono text-meta">{{ fmtDate(item.competitionDate) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
      <p v-else class="text-secondary text-sm">Geen blacklist-items.</p>
    </section>
  </div>
</template>
