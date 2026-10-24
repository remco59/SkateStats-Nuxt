<script setup lang="ts">
// `data-theme` (dark | light | system) and `data-motion` drive the CSS in
// tokens.css. They are rendered on <html> server-side so there is no flash of
// the wrong theme; `system` is resolved by the browser itself via
// `color-scheme: light dark`, no JS involved.
const { theme, motion } = useAppearance()

useHead({
  htmlAttrs: {
    'data-theme': theme,
    'data-motion': motion,
  },
})
</script>

<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>
