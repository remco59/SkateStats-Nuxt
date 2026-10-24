<script setup lang="ts">
// "Are you sure?" for destructive actions. With `requireText` the confirm
// button stays disabled until that exact text is typed (the old app made you
// retype the username before deleting an account).
const props = withDefaults(
  defineProps<{
    title: string
    message?: string
    confirmLabel?: string
    requireText?: string
    busy?: boolean
  }>(),
  { message: '', confirmLabel: 'Verwijderen', requireText: '', busy: false },
)
const emit = defineEmits<{ confirm: [] }>()

const modal = ref<InstanceType<typeof import('./Modal.vue').default>>()
const typed = ref('')
const inputId = useId()

const canConfirm = computed(() => !props.requireText || typed.value === props.requireText)

function open() {
  typed.value = ''
  modal.value?.open()
}

function close() {
  modal.value?.close()
}

defineExpose({ open, close })
</script>

<template>
  <Modal ref="modal" :title="title">
    <p v-if="message" class="text-secondary mb-4">{{ message }}</p>
    <slot />
    <div v-if="requireText" class="mb-4 space-y-1">
      <label :for="inputId" class="text-secondary">
        Typ <strong class="font-mono">{{ requireText }}</strong> om te bevestigen
      </label>
      <input :id="inputId" v-model="typed" class="field" autocomplete="off" @keydown.enter.prevent="canConfirm && emit('confirm')">
    </div>
    <div class="flex flex-wrap gap-2 justify-end">
      <button type="button" class="btn btn-secondary btn-sm" @click="close">Annuleren</button>
      <button
        type="button"
        class="btn btn-danger btn-sm"
        :disabled="!canConfirm || busy"
        @click="emit('confirm')"
      >
        {{ confirmLabel }}
      </button>
    </div>
  </Modal>
</template>
