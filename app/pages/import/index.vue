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

const { data: blacklistData, refresh: refreshBlacklist } = await useFetch('/api/import/blacklist')

async function removeCompetitionBlacklist(id: number) {
  await $fetch(`/api/import/blacklist/competition/${id}`, { method: 'DELETE' })
  await refreshBlacklist()
}
async function removeRaceBlacklist(id: number) {
  await $fetch(`/api/import/blacklist/race/${id}`, { method: 'DELETE' })
  await refreshBlacklist()
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
        class="w-full rounded-md px-3 py-2 text-sm"
        style="border: 1px solid var(--color-border)"
      >
      <input
        v-model="season"
        placeholder="Seizoen (startjaar, bv. 2024)"
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
