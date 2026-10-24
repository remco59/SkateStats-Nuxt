<script setup lang="ts">
const { data: account, refresh } = await useFetch('/api/account')

const { data: ostaProfiles, refresh: refreshOstaProfiles } = await useFetch('/api/account/osta-profiles')
const newOstaPid = ref('')
const newOstaSearchName = ref('')
const newOstaSeason = ref(String(new Date().getFullYear()))
const ostaError = ref('')

async function addOstaProfile() {
  ostaError.value = ''
  try {
    await $fetch('/api/account/osta-profiles', {
      method: 'POST',
      body: { pid: newOstaPid.value, searchName: newOstaSearchName.value, season: newOstaSeason.value },
    })
    newOstaPid.value = ''
    newOstaSearchName.value = ''
    await refreshOstaProfiles()
  } catch {
    ostaError.value = 'Toevoegen mislukt.'
  }
}

async function updateOstaMonitorMode(id: number, monitorMode: string) {
  await $fetch(`/api/account/osta-profiles/${id}`, { method: 'PATCH', body: { monitorMode } })
  await refreshOstaProfiles()
}

async function removeOstaProfile(id: number) {
  await $fetch(`/api/account/osta-profiles/${id}`, { method: 'DELETE' })
  await refreshOstaProfiles()
}

const importFile = ref<HTMLInputElement | null>(null)
const importMessage = ref('')
const importError = ref('')
const importing = ref(false)

async function importBackup() {
  importMessage.value = ''
  importError.value = ''
  const file = importFile.value?.files?.[0]
  if (!file) {
    importError.value = 'Kies eerst een backupbestand.'
    return
  }
  importing.value = true
  try {
    const form = new FormData()
    form.append('file', file)
    const result = await $fetch('/api/account/import', { method: 'POST', body: form })
    importMessage.value = `Hersteld: ${result.competitions} wedstrijden, ${result.races} ritten, ${result.goals} targets.`
    if (importFile.value) importFile.value.value = ''
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    importError.value = err.data?.statusMessage || 'Herstellen mislukt.'
  } finally {
    importing.value = false
  }
}
</script>

<template>
  <div class="space-y-8 max-w-xl">
    <h1 class="text-xl font-semibold">Account instellingen</h1>

    <AccountProfileForm
      v-if="account"
      :username="account.username"
      :skater-name="account.skaterName"
      @saved="refresh()"
    />

    <AccountPasswordForm />

    <section class="space-y-3">
      <h2 class="text-sm font-medium" style="color: var(--color-text-muted)">OSTA monitor</h2>
      <p class="text-xs" style="color: var(--color-text-muted)">
        Gekoppelde profielen worden op het dashboard gecontroleerd op nieuwe wedstrijden.
      </p>
      <ul v-if="ostaProfiles?.length" class="space-y-2">
        <li
          v-for="p in ostaProfiles"
          :key="p.id"
          class="flex items-center justify-between gap-2 text-sm rounded-md p-2"
          style="border: 1px solid var(--color-border); background: var(--color-surface); box-shadow: var(--shadow-card)"
        >
          <span>{{ p.searchName }} (pid {{ p.pid }}, seizoen {{ p.season }})</span>
          <div class="flex items-center gap-2 shrink-0">
            <select
              :value="p.monitorMode"
              class="rounded-md px-2 py-1 text-xs"
              style="border: 1px solid var(--color-border); background: var(--color-surface); box-shadow: var(--shadow-card)"
              @change="updateOstaMonitorMode(p.id, ($event.target as HTMLSelectElement).value)"
            >
              <option value="notify">Melden</option>
              <option value="off">Uit</option>
            </select>
            <button class="underline text-xs" @click="removeOstaProfile(p.id)">Verwijderen</button>
          </div>
        </li>
      </ul>
      <div class="grid grid-cols-3 gap-2">
        <input
          v-model="newOstaPid"
          placeholder="OSTA pid"
          class="rounded-md px-3 py-2 text-sm"
          style="border: 1px solid var(--color-border); background: var(--color-surface); box-shadow: var(--shadow-card)"
        >
        <input
          v-model="newOstaSearchName"
          placeholder="Naam op OSTA"
          class="rounded-md px-3 py-2 text-sm"
          style="border: 1px solid var(--color-border); background: var(--color-surface); box-shadow: var(--shadow-card)"
        >
        <input
          v-model="newOstaSeason"
          placeholder="Seizoen"
          class="rounded-md px-3 py-2 text-sm"
          style="border: 1px solid var(--color-border); background: var(--color-surface); box-shadow: var(--shadow-card)"
        >
      </div>
      <button
        class="rounded-md px-3 py-1.5 text-sm"
        style="border: 1px solid var(--color-border); background: var(--color-surface); box-shadow: var(--shadow-card)"
        @click="addOstaProfile"
      >
        Profiel koppelen
      </button>
      <p v-if="ostaError" class="text-sm" style="color: var(--color-danger)">{{ ostaError }}</p>
    </section>

    <section class="space-y-3">
      <h2 class="text-sm font-medium" style="color: var(--color-text-muted)">Backup</h2>
      <p class="text-xs" style="color: var(--color-text-muted)">
        Exporteer al je data als JSON, of herstel een eerder gemaakte backup (ook backups uit de oude app werken).
        Herstellen vervangt al je huidige wedstrijden, ritten en targets.
      </p>
      <a
        href="/api/account/export"
        class="inline-block rounded-md px-3 py-1.5 text-sm"
        style="border: 1px solid var(--color-border); background: var(--color-surface); box-shadow: var(--shadow-card)"
      >
        Exporteren
      </a>
      <div class="flex items-center gap-2 pt-2">
        <input
          ref="importFile"
          type="file"
          accept="application/json"
          class="text-sm"
        >
        <button
          class="rounded-md px-3 py-1.5 text-sm"
          style="border: 1px solid var(--color-border); background: var(--color-surface); box-shadow: var(--shadow-card)"
          :disabled="importing"
          @click="importBackup"
        >
          Herstellen
        </button>
      </div>
      <p v-if="importMessage" class="text-sm" style="color: var(--color-success)">{{ importMessage }}</p>
      <p v-if="importError" class="text-sm" style="color: var(--color-danger)">{{ importError }}</p>
    </section>

    <AccountDeleteForm v-if="account" :username="account.username" />
  </div>
</template>
