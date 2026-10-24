<script setup lang="ts">
// Thin wrapper around the native <dialog>: focus trapping, Escape to close
// and the backdrop come from the browser. Open/close it from the parent via
// a template ref (`modal.value?.open()`).
defineProps<{ title: string }>()
const emit = defineEmits<{ close: [] }>()

const dialog = ref<HTMLDialogElement>()
const titleId = useId()

function open() {
  dialog.value?.showModal()
}

function close() {
  dialog.value?.close()
}

defineExpose({ open, close })

// A click on the ::backdrop is reported as a click on the <dialog> itself.
function onClick(event: MouseEvent) {
  if (event.target === dialog.value) close()
}
</script>

<template>
  <dialog ref="dialog" class="modal" :aria-labelledby="titleId" @click="onClick" @close="emit('close')">
    <div class="modal-content">
      <h2 :id="titleId" class="card-title modal-title">{{ title }}</h2>
      <slot />
    </div>
  </dialog>
</template>

<style scoped>
.modal {
  width: min(36rem, calc(100vw - 2rem));
  max-height: calc(100vh - 2rem);
  padding: 0;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  color: var(--color-text);
  box-shadow: 0 24px 60px -20px rgba(0, 0, 0, 0.55);
}

.modal::backdrop {
  background: var(--scrim);
}

.modal-content {
  padding: var(--space-5);
}

.modal-title {
  font-size: 1.1rem;
  margin-bottom: var(--space-4);
}
</style>
