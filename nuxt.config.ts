// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss', 'nuxt-auth-utils'],
  css: ['~/assets/css/tokens.css'],
  runtimeConfig: {
    dbPath: process.env.SKATESTATS_DB || './data/skatestats.sqlite',
    ownerName: process.env.SKATESTATS_OWNER_NAME || 'Owner',
    adminUsername: process.env.SKATESTATS_ADMIN_USERNAME || 'admin',
    public: {
      appTitle: process.env.SKATESTATS_TITLE || 'SkateStats',
    },
  },
})
