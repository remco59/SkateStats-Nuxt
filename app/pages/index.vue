<script setup lang="ts">
const { data } = await useFetch('/api/dashboard/overview')

// Loaded client-side after the page renders, like the old app's async OSTA
// banner -- avoids blocking the dashboard's first paint on an outbound
// OSTA fetch per linked profile.
const { data: ostaDetection } = useFetch('/api/dashboard/osta-detection', { server: false })
const dismissed = ref(false)

function trendContext(points: { totalTimeMs: number }[]) {
  if (points.length < 2) return null
  const current = points[points.length - 1]!.totalTimeMs
  const best = Math.min(...points.map((p) => p.totalTimeMs))
  return { current, best }
}
</script>

<template>
  <div class="space-y-8">
    <h1 class="text-2xl font-heading font-semibold">Overzicht</h1>

    <section
      v-if="ostaDetection?.hasNew && !dismissed"
      class="notice notice-accent flex-wrap"
    >
      <p>
        Nieuwe OSTA-data gevonden: {{ ostaDetection.newCompetitionsCount }} wedstrijden,
        {{ ostaDetection.newRacesCount }} ritten.
      </p>
      <div class="flex gap-2 shrink-0">
        <NuxtLink :to="`/import/preview?batchId=${ostaDetection.batchId}`" class="btn btn-primary btn-sm">
          Bekijken
        </NuxtLink>
        <button type="button" class="btn btn-secondary btn-sm" @click="dismissed = true">
          Later
        </button>
      </div>
    </section>

    <section v-if="data && data.raceCount === 0" class="empty-state">
      Er is nog geen data. <NuxtLink to="/import" class="underline">Importeer</NuxtLink> of
      <NuxtLink to="/results/races/new" class="underline">voeg handmatig een rit toe</NuxtLink>.
    </section>

    <section
      v-if="data && (data.notifications.recentPrs.length || data.notifications.recentSbs.length || data.notifications.streakCount > 1)"
      class="notice flex-wrap"
    >
      <div class="flex flex-wrap items-center gap-2">
        <span class="section-heading">Nieuw</span>
        <span v-if="data.notifications.streakCount > 1" class="tag" style="color: var(--color-accent)">
          🔥 {{ data.notifications.streakCount }} op rij
        </span>
        <NuxtLink
          v-for="r in data.notifications.recentPrs"
          :key="`pr-${r.raceId}`"
          :to="`/results/races/${r.raceId}`"
          class="tag hover:!text-[var(--color-accent)]"
        >
          PR {{ r.distanceM }}m &middot; {{ fmtMs(r.totalTimeMs) }}
        </NuxtLink>
        <NuxtLink
          v-for="r in data.notifications.recentSbs"
          :key="`sb-${r.raceId}`"
          :to="`/results/races/${r.raceId}`"
          class="tag hover:!text-[var(--color-accent)]"
        >
          SB {{ r.distanceM }}m &middot; {{ fmtMs(r.totalTimeMs) }}
        </NuxtLink>
      </div>
    </section>

    <section v-if="data" class="card">
      <div class="grid grid-cols-2 sm:grid-cols-5 gap-5">
        <div>
          <div class="stat-label">Wedstrijden</div>
          <div class="stat-value">{{ data.competitionCount }}</div>
        </div>
        <div>
          <div class="stat-label">Ritten</div>
          <div class="stat-value">{{ data.raceCount }}</div>
        </div>
        <div>
          <div class="stat-label">PR's</div>
          <div class="stat-value" style="color: var(--color-accent)">{{ data.prCount }}</div>
        </div>
        <div>
          <div class="stat-label">Favoriete locatie</div>
          <div class="stat-value-sm">{{ data.favoriteVenue || '-' }}</div>
        </div>
        <div>
          <div class="stat-label">Favoriete afstand</div>
          <div class="stat-value-sm">{{ data.favoriteDistance ? `${data.favoriteDistance}m` : '-' }}</div>
        </div>
      </div>
    </section>

    <div class="grid md:grid-cols-2 gap-5">
      <section class="card">
        <h2 class="section-heading mb-3">Beste tijden per afstand</h2>
        <table v-if="data?.bestTimes.length" class="table">
          <thead>
            <tr>
              <th>Afstand</th>
              <th>Beste tijd</th>
              <th>Datum</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in data.bestTimes" :key="r.distanceM" class="table-row-link">
              <td class="font-mono">
                <NuxtLink :to="`/results/races/${r.raceId}`" class="stretched-link">{{ r.distanceM }}m</NuxtLink>
              </td>
              <td class="font-mono stat-value-sm">
                {{ fmtMs(r.totalTimeMs) }}
                <span v-if="r.isRecentPr" class="text-xs" style="color: var(--color-accent)">PR</span>
              </td>
              <td class="font-mono" style="color: var(--color-text-muted)">{{ fmtDate(r.competitionDate) }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else style="color: var(--color-text-muted)">Nog geen geldige tijden.</p>
      </section>

      <section class="card">
        <h2 class="section-heading mb-3">Laatste wedstrijd</h2>
        <template v-if="data?.latestCompetition">
          <p class="mb-3">
            <NuxtLink
              :to="`/results/competitions/${data.latestCompetition.competitionId}`"
              class="font-medium hover:underline"
            >
              {{ data.latestCompetition.name }}
            </NuxtLink>
            <span style="color: var(--color-text-muted)">
              &middot; {{ data.latestCompetition.venue || '-' }} &middot;
              <span class="font-mono">{{ fmtDate(data.latestCompetition.date) }}</span>
            </span>
          </p>
          <table class="table">
            <thead>
              <tr>
                <th>Rit</th>
                <th>Eindtijd</th>
                <th>T.o.v. PR</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in data.latestCompetition.races" :key="r.raceId" class="table-row-link">
                <td class="font-mono">
                  <NuxtLink :to="`/results/races/${r.raceId}`" class="stretched-link">{{ r.distanceM }}m</NuxtLink>
                </td>
                <td class="font-mono stat-value-sm">{{ fmtMs(r.totalTimeMs) }}</td>
                <td class="font-mono">
                  <span v-if="r.isPr" style="color: var(--color-accent)">PR</span>
                  <span v-else-if="r.deltaVsPreviousPrMs === null" style="color: var(--color-text-muted)">-</span>
                  <span v-else :style="{ color: r.deltaVsPreviousPrMs <= 0 ? 'var(--color-success)' : 'var(--color-danger)' }">
                    {{ r.deltaVsPreviousPrMs > 0 ? '+' : '' }}{{ fmtMs(r.deltaVsPreviousPrMs) }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </template>
        <p v-else style="color: var(--color-text-muted)">Nog geen ritten.</p>
      </section>
    </div>

    <section v-if="data?.trends.length">
      <h2 class="section-heading mb-3">Ontwikkeling per afstand</h2>
      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div v-for="trend in data.trends" :key="trend.distanceM" class="card">
          <div class="flex items-baseline justify-between mb-2">
            <div class="font-mono text-sm font-medium">{{ trend.distanceM }}m</div>
            <div v-if="trendContext(trend.points)" class="text-xs font-mono" style="color: var(--color-text-muted)">
              nu {{ fmtMs(trendContext(trend.points)!.current) }} &middot;
              best <span style="color: var(--color-accent)">{{ fmtMs(trendContext(trend.points)!.best) }}</span>
            </div>
          </div>
          <TrendSparkline :points="trend.points" />
        </div>
      </div>
    </section>
  </div>
</template>
