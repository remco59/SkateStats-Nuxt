<script setup lang="ts">
import { displayToIso, isoToDisplay } from '#shared/utils/date-input'

// A date field you can type in as dd/mm/jjjj (the old app's field) with a
// calendar button for the browser's picker. v-model is the ISO "YYYY-MM-DD"
// the API wants, or '' when empty / not a real date. `class` and `style` go to
// the wrapper (so the parent can size it); every other attribute -- id,
// aria-label, required -- goes to the text input.
defineOptions({ inheritAttrs: false })
const attrs = useAttrs()
const inputAttrs = computed(() => {
  const { class: _class, style: _style, ...rest } = attrs
  return rest
})

const model = defineModel<string>({ default: '' })
const props = defineProps<{ placeholder?: string }>()

const text = ref(isoToDisplay(model.value))
const invalid = ref(false)
const picker = ref<HTMLInputElement>()

// The parent changed the value (loaded data, reset button): show it.
watch(model, (iso) => {
  if (displayToIso(text.value) !== iso) {
    text.value = isoToDisplay(iso)
    invalid.value = false
  }
})

function onInput() {
  const iso = displayToIso(text.value)
  model.value = iso
  // Don't nag while still typing; only flag text that already looks complete.
  invalid.value = text.value.trim() !== '' && iso === '' && text.value.trim().length >= 8
}

function onBlur() {
  const iso = displayToIso(text.value)
  if (iso) {
    text.value = isoToDisplay(iso)
    invalid.value = false
  } else {
    invalid.value = text.value.trim() !== ''
  }
}

function openPicker() {
  const el = picker.value
  if (!el) return
  el.value = model.value
  if (typeof el.showPicker === 'function') el.showPicker()
  else el.click()
}

function onPicked() {
  if (picker.value?.value) {
    model.value = picker.value.value
    text.value = isoToDisplay(picker.value.value)
    invalid.value = false
  }
}
</script>

<template>
  <div class="date-input" :class="attrs.class" :style="attrs.style as string">
    <input
      v-bind="inputAttrs"
      v-model="text"
      class="field date-text"
      inputmode="numeric"
      autocomplete="off"
      :placeholder="props.placeholder ?? 'dd/mm/jjjj'"
      :aria-invalid="invalid || undefined"
      @input="onInput"
      @blur="onBlur"
    >
    <input ref="picker" type="date" class="date-picker" tabindex="-1" aria-hidden="true" @change="onPicked">
    <button type="button" class="date-trigger" aria-label="Open kalender" @click="openPicker">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3.5" y="5" width="17" height="15" rx="2.5" stroke="currentColor" stroke-width="1.6" />
        <path d="M3.5 10h17M8 3v4M16 3v4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
      </svg>
    </button>
    <p v-if="invalid" class="date-hint" role="alert">Geen geldige datum. Gebruik dd/mm/jjjj.</p>
  </div>
</template>

<style scoped>
.date-input {
  position: relative;
  width: 100%;
}

.date-text {
  padding-right: 2.5rem;
}

.date-text[aria-invalid='true'] {
  border-color: var(--color-danger);
}

/* Kept in the layout (so showPicker() anchors under the field) but invisible. */
.date-picker {
  position: absolute;
  left: 0;
  bottom: 0;
  width: 100%;
  height: 0;
  opacity: 0;
  pointer-events: none;
}

.date-trigger {
  position: absolute;
  top: 0;
  right: 0;
  width: 2.5rem;
  height: var(--control-height);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-faint);
  background: transparent;
  border: none;
  cursor: pointer;
}

.date-trigger:hover {
  color: var(--color-accent);
}

.date-hint {
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: var(--color-danger);
}
</style>
