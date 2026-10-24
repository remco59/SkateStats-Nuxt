<script setup lang="ts">
import { COMMON_DISTANCES } from '#shared/constants'
import { parseTimeInput } from '#shared/utils/time-input'

// Create or edit one target. A target is any mix of: an overall time, hand-set
// splits (opening / average lap / last lap / fade) and a note. "Genereer
// targets" fills the splits from the time using the skater's own history.
interface Initial {
  distanceM: number
  targetTimeMs: number | null
  openingMs: number | null
  avg400Ms: number | null
  last400Ms: number | null
  fade400Ms: number | null
  notes: string | null
}

const props = defineProps<{ initial?: Initial; submitLabel?: string }>()
const emit = defineEmits<{ saved: []; cancel: [] }>()

const editing = !!props.initial
const msToField = (ms: number | null | undefined) => (ms === null || ms === undefined ? '' : fmtMs(ms))

const distanceM = ref(props.initial?.distanceM ?? 1500)
const time = ref(msToField(props.initial?.targetTimeMs))
const opening = ref(msToField(props.initial?.openingMs))
const avg400 = ref(msToField(props.initial?.avg400Ms))
const last400 = ref(msToField(props.initial?.last400Ms))
const fade400 = ref(msToField(props.initial?.fade400Ms))
const notes = ref(props.initial?.notes ?? '')

// The split fields start hidden for a new target (like the old "Genereer" /
// "Handmatig invullen" choice) but are open when editing existing values.
const showSplits = ref(
  [props.initial?.openingMs, props.initial?.avg400Ms, props.initial?.last400Ms, props.initial?.fade400Ms].some(
    (v) => v !== null && v !== undefined,
  ),
)
const hint = ref('')
const error = ref('')
const generating = ref(false)
const saving = ref(false)

async function generate() {
  error.value = ''
  const parsed = parseTimeInput(time.value)
  if (!parsed.ok || parsed.ms === null) {
    error.value = 'Vul eerst een geldige doeltijd in (bijv. 40.50 of 2:12.34).'
    return
  }
  generating.value = true
  try {
    const res = await $fetch('/api/progress/targets/generate', {
      method: 'POST',
      body: { distanceM: distanceM.value, targetTimeMs: parsed.ms },
    })
    opening.value = msToField(res.splits.openingMs)
    avg400.value = msToField(res.splits.avg400Ms)
    last400.value = msToField(res.splits.last400Ms)
    fade400.value = msToField(res.splits.fade400Ms)
    showSplits.value = true
    hint.value = res.sampleSize
      ? `Gebaseerd op je ${res.sampleSize} recente ritten met rondetijden op deze afstand. Pas de velden aan als je wilt bijsturen.`
      : 'Je hebt nog geen ritten met rondetijden op deze afstand, dus dit is een standaard pacing-profiel. Pas de velden aan als je wilt bijsturen.'
  } catch {
    error.value = 'Genereren mislukt.'
  } finally {
    generating.value = false
  }
}

function showManual() {
  showSplits.value = true
  hint.value = 'Vul hieronder handmatig je targetwaardes in.'
}

async function save() {
  error.value = ''
  const t = parseTimeInput(time.value)
  const o = parseTimeInput(opening.value)
  const a = parseTimeInput(avg400.value)
  const l = parseTimeInput(last400.value)
  const f = parseTimeInput(fade400.value, { signed: true })
  if (!t.ok || !o.ok || !a.ok || !l.ok || !f.ok) {
    error.value = 'Een of meer tijden konden niet gelezen worden.'
    return
  }
  saving.value = true
  try {
    await $fetch('/api/progress/targets', {
      method: 'POST',
      body: {
        distanceM: distanceM.value,
        targetTimeMs: t.ms,
        openingMs: o.ms,
        avg400Ms: a.ms,
        last400Ms: l.ms,
        fade400Ms: f.ms,
        notes: notes.value,
      },
    })
    emit('saved')
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    error.value = err.data?.statusMessage || 'Opslaan mislukt.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <form class="space-y-4" @submit.prevent="save">
    <div class="grid sm:grid-cols-2 gap-3">
      <label class="block text-sm space-y-1">
        <span class="text-secondary">Afstand</span>
        <select v-model.number="distanceM" class="field" :disabled="editing">
          <option v-for="d in COMMON_DISTANCES" :key="d" :value="d">{{ d }}m</option>
        </select>
      </label>
      <label class="block text-sm space-y-1">
        <span class="text-secondary">Doeltijd</span>
        <input v-model="time" class="field" inputmode="decimal" placeholder="bijv. 40.50 of 2:12.34">
      </label>
    </div>

    <div class="flex flex-wrap gap-2">
      <button type="button" class="btn btn-secondary btn-sm" :disabled="generating" @click="generate">
        {{ generating ? 'Bezig...' : 'Genereer targets' }}
      </button>
      <button v-if="!showSplits" type="button" class="btn btn-secondary btn-sm" @click="showManual">
        Handmatig invullen
      </button>
    </div>

    <fieldset v-if="showSplits" class="space-y-3 split-fields">
      <legend class="section-heading mb-1">Targetwaardes</legend>
      <p v-if="hint" class="text-meta">{{ hint }}</p>
      <div class="grid grid-cols-2 gap-3">
        <label class="block text-sm space-y-1">
          <span class="text-secondary">Opening</span>
          <input v-model="opening" class="field font-mono" inputmode="decimal" placeholder="bijv. 11.20">
        </label>
        <label class="block text-sm space-y-1">
          <span class="text-secondary">Gem. ronde</span>
          <input v-model="avg400" class="field font-mono" inputmode="decimal" placeholder="bijv. 31.10">
        </label>
        <label class="block text-sm space-y-1">
          <span class="text-secondary">Laatste ronde</span>
          <input v-model="last400" class="field font-mono" inputmode="decimal" placeholder="bijv. 32.00">
        </label>
        <label class="block text-sm space-y-1">
          <span class="text-secondary">Verval</span>
          <input v-model="fade400" class="field font-mono" inputmode="decimal" placeholder="bijv. 1.20 of -0.30">
        </label>
      </div>
    </fieldset>

    <label class="block text-sm space-y-1">
      <span class="text-secondary">Notities</span>
      <textarea v-model="notes" class="field notes-field" rows="2" maxlength="2000" />
    </label>

    <p v-if="error" class="text-sm" style="color: var(--color-danger)" role="alert">{{ error }}</p>

    <div class="flex flex-wrap gap-2">
      <button type="submit" class="btn btn-primary btn-sm" :disabled="saving">
        {{ submitLabel ?? 'Target opslaan' }}
      </button>
      <button v-if="editing" type="button" class="btn btn-secondary btn-sm" @click="emit('cancel')">
        Annuleren
      </button>
    </div>
  </form>
</template>

<style scoped>
.split-fields {
  border: none;
  padding: 0;
  margin: 0;
}

.notes-field {
  min-height: 4.5rem;
  padding-top: 0.5rem;
  padding-bottom: 0.5rem;
  resize: vertical;
}
</style>
