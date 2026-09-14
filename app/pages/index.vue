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
  const previous = points[points.length - 2]!.totalTimeMs
  const best = Math.min(...points.map((p) => p.totalTimeMs))
  return { current, best, deltaMs: current - previous }
}
</script>

<template>
  <div class="space-y-8">
    <h1 class="page-title">Overzicht</h1>

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
        <span v-if="data.notifications.streakCount > 1" class="tag tag-streak">
          🔥 {{ data.notifications.streakCount }} PR's op rij
        </span>
        <NuxtLink
          v-for="r in data.notifications.recentPrs"
          :key="`pr-${r.raceId}`"
          :to="`/results/races/${r.raceId}`"
          class="tag"
        >
          PR {{ r.distanceM }}m &middot; {{ fmtMs(r.totalTimeMs) }}
        </NuxtLink>
        <NuxtLink
          v-for="r in data.notifications.recentSbs"
          :key="`sb-${r.raceId}`"
          :to="`/results/races/${r.raceId}`"
          class="tag"
        >
          SB {{ r.distanceM }}m &middot; {{ fmtMs(r.totalTimeMs) }}
        </NuxtLink>
      </div>
    </section>

    <section v-if="data" class="card card-lane-accent">
      <div class="grid grid-cols-3 gap-x-4 gap-y-6">
        <div>
          <div class="stat-label">Wedstrijden</div>
          <div class="stat-value-lg">{{ data.competitionCount }}</div>
        </div>
        <div>
          <div class="stat-label">Ritten</div>
          <div class="stat-value-lg">{{ data.raceCount }}</div>
        </div>
        <div>
          <div class="stat-label">PR's</div>
          <div class="stat-value-lg" style="color: var(--color-accent)">{{ data.prCount }}</div>
        </div>
      </div>
      <div class="flex flex-wrap gap-x-8 gap-y-3 mt-5 pt-4" style="border-top: 1px solid var(--highlight-soft)">
        <div>
          <div class="stat-label">Favoriete locatie</div>
          <div class="text-secondary font-medium mt-0.5">{{ data.favoriteVenue || '-' }}</div>
        </div>
        <div>
          <div class="stat-label">Favoriete afstand</div>
          <div class="text-secondary font-mono mt-0.5">{{ data.favoriteDistance ? `${data.favoriteDistance}m` : '-' }}</div>
        </div>
      </div>
    </section>

    <div class="grid md:grid-cols-2 gap-5">
      <section class="card">
        <h2 class="card-title mb-3">Beste tijden per afstand</h2>
        <div v-if="data?.bestTimes.length" class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th>Afstand</th>
                <th class="num">Beste tijd</th>
                <th class="num">Datum</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in data.bestTimes" :key="r.distanceM" class="table-row-link">
                <td class="font-mono">
                  <NuxtLink :to="`/results/races/${r.raceId}`" class="stretched-link">{{ r.distanceM }}m</NuxtLink>
                </td>
                <td class="num">
                  <span class="stat-value-sm">{{ fmtMs(r.totalTimeMs) }}</span>
                  <span v-if="r.isRecentPr" class="badge badge-pr ml-1">PR</span>
                </td>
                <td class="num text-meta">{{ fmtDate(r.competitionDate) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="text-secondary">Nog geen geldige tijden.</p>
      </section>

      <section class="card">
        <h2 class="card-title mb-3">Laatste wedstrijd</h2>
        <template v-if="data?.latestCompetition">
          <p class="mb-3">
            <NuxtLink
              :to="`/results/competitions/${data.latestCompetition.competitionId}`"
              class="font-medium hover:underline"
            >
              {{ data.latestCompetition.name }}
            </NuxtLink>
            <span class="text-meta">
              &middot; {{ data.latestCompetition.venue || '-' }} &middot;
              <span class="font-mono">{{ fmtDate(data.latestCompetition.date) }}</span>
            </span>
          </p>
          <div class="overflow-x-auto">
            <table class="table">
              <thead>
                <tr>
                  <th>Rit</th>
                  <th class="num">Eindtijd</th>
                  <th class="num">T.o.v. PR</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in data.latestCompetition.races" :key="r.raceId" class="table-row-link">
                  <td class="font-mono">
                    <NuxtLink :to="`/results/races/${r.raceId}`" class="stretched-link">{{ r.distanceM }}m</NuxtLink>
                  </td>
                  <td class="num">
                    <span class="stat-value-sm">{{ fmtMs(r.totalTimeMs) }}</span>
                    <span v-if="r.isPr" class="badge badge-pr ml-1">PR</span>
                  </td>
                  <td class="num">
                    <span v-if="r.isPr" class="delta-neutral">PR</span>
                    <span v-else-if="r.deltaVsPreviousPrMs === null" class="delta-neutral">-</span>
                    <span v-else :class="r.deltaVsPreviousPrMs <= 0 ? 'delta-better' : 'delta-worse'">
                      {{ r.deltaVsPreviousPrMs > 0 ? '+' : '' }}{{ fmtMs(r.deltaVsPreviousPrMs) }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
        <p v-else class="text-secondary">Nog geen ritten.</p>
      </section>
    </div>

    <section v-if="data?.trends.length">
      <h2 class="section-heading mb-3">Ontwikkeling per afstand</h2>
      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div v-for="trend in data.trends" :key="trend.distanceM" class="card">
          <div class="flex items-baseline justify-between mb-2">
            <div class="font-mono text-sm font-medium">{{ trend.distanceM }}m</div>
            <div v-if="trendContext(trend.points)" class="text-xs font-mono flex items-center gap-1.5">
              <span
                v-if="Math.abs(trendContext(trend.points)!.deltaMs) >= 10"
                :class="trendContext(trend.points)!.deltaMs <= 0 ? 'delta-better' : 'delta-worse'"
              >
                {{ trendContext(trend.points)!.deltaMs <= 0 ? '↓' : '↑' }}
                {{ (Math.abs(trendContext(trend.points)!.deltaMs) / 1000).toFixed(1) }}s
              </span>
              <span class="text-meta">best {{ fmtMs(trendContext(trend.points)!.best) }}</span>
            </div>
          </div>
          <TrendSparkline :points="trend.points" :distance-m="trend.distanceM" />
        </div>
      </div>
    </section>
  </div>
</template>
