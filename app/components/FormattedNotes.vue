<script setup lang="ts">
import { isAutoImportNote, parseNotes } from '#shared/utils/notes'

// Notes with clickable source links ("Geïmporteerd van OSTA" -> a link).
// Rendered with plain Vue bindings, never v-html, so note text can't inject
// markup. `hideAutoImport` drops the automatic "imported from ..." line for
// pages that show the source separately.
const props = defineProps<{ notes: string | null | undefined; hideAutoImport?: boolean }>()

const lines = computed(() => parseNotes(props.notes).filter((l) => !(props.hideAutoImport && isAutoImportNote(l))))
</script>

<template>
  <p v-if="lines.length" class="notes">
    <template v-for="(line, i) in lines" :key="i">
      <br v-if="i > 0">{{ line.before }}<a
        v-if="line.link"
        :href="line.link.url"
        target="_blank"
        rel="noopener noreferrer"
        class="underline"
      >{{ line.link.text }}</a>
    </template>
  </p>
</template>
