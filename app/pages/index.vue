<script setup lang="ts">
const { data } = await useFetch('/api/dashboard/overview')
</script>

<template>
  <div class="space-y-8">
    <h1 class="text-xl font-semibold">Overzicht</h1>

    <section v-if="data && data.raceCount === 0" class="rounded-lg p-4" style="border: 1px solid var(--color-border)">
      <p style="color: var(--color-text-muted)">
        Er is nog geen data. <NuxtLink to="/import" class="underline">Importeer</NuxtLink> of
        <NuxtLink to="/results/races/new" class="underline">voeg handmatig een rit toe</NuxtLink>.
      </p>
    </section>

    <section v-if="data" class="rounded-lg p-4" style="border: 1px solid var(--color-border)">
      <div class="grid grid-cols-2 sm:grid-cols-5 gap-4 text-sm">
        <div>
          <div style="color: var(--color-text-muted)">Wedstrijden</div>
          <div class="font-mono text-lg">{{ data.competitionCount }}</div>
        </div>
        <div>
          <div style="color: var(--color-text-muted)">Ritten</div>
          <div class="font-mono text-lg">{{ data.raceCount }}</div>
        </div>
        <div>
          <div style="color: var(--color-text-muted)">PR's</div>
          <div class="font-mono text-lg">{{ data.prCount }}</div>
        </div>
        <div>
          <div style="color: var(--color-text-muted)">Favoriete locatie</div>
          <div class="text-lg">{{ data.favoriteVenue || '-' }}</div>
        </div>
        <div>
          <div style="color: var(--color-text-muted)">Favoriete afstand</div>
          <div class="text-lg">{{ data.favoriteDistance ? `${data.favoriteDistance}m` : '-' }}</div>
        </div>
      </div>
    </section>

    <div class="grid md:grid-cols-2 gap-6">
      <section class="rounded-lg p-4" style="border: 1px solid var(--color-border)">
        <h2 class="text-sm font-medium mb-2" style="color: var(--color-text-muted)">Beste tijden per afstand</h2>
        <table v-if="data?.bestTimes.length" class="w-full text-sm">
          <thead>
            <tr class="text-left" style="color: var(--color-text-muted)">
              <th class="py-1 pr-4">Afstand</th>
              <th class="py-1 pr-4">Beste tijd</th>
              <th class="py-1 pr-4">Datum</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in data.bestTimes" :key="r.distanceM" style="border-top: 1px solid var(--color-border)">
              <td class="py-1 pr-4 font-mono">
                <NuxtLink :to="`/results/races/${r.raceId}`" class="hover:underline">{{ r.distanceM }}m</NuxtLink>
              </td>
              <td class="py-1 pr-4 font-mono">
                {{ fmtMs(r.totalTimeMs) }}
                <span v-if="r.isRecentPr" class="text-xs" style="color: var(--color-accent)">PR</span>
              </td>
              <td class="py-1 pr-4 font-mono">{{ fmtDate(r.competitionDate) }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else style="color: var(--color-text-muted)">Nog geen geldige tijden.</p>
      </section>

      <section class="rounded-lg p-4" style="border: 1px solid var(--color-border)">
        <h2 class="text-sm font-medium mb-2" style="color: var(--color-text-muted)">Laatste wedstrijd</h2>
        <template v-if="data?.latestCompetition">
          <p class="text-sm">
            <NuxtLink :to="`/results/competitions/${data.latestCompetition.competitionId}`" class="font-medium hover:underline">
              {{ data.latestCompetition.name }}
            </NuxtLink>
          </p>
          <p class="text-sm mb-2" style="color: var(--color-text-muted)">
            {{ data.latestCompetition.venue || '-' }} &middot;
            <span class="font-mono">{{ fmtDate(data.latestCompetition.date) }}</span>
          </p>
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left" style="color: var(--color-text-muted)">
                <th class="py-1 pr-4">Rit</th>
                <th class="py-1 pr-4">Eindtijd</th>
                <th class="py-1 pr-4">T.o.v. PR</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in data.latestCompetition.races" :key="r.raceId" style="border-top: 1px solid var(--color-border)">
                <td class="py-1 pr-4 font-mono">
                  <NuxtLink :to="`/results/races/${r.raceId}`" class="hover:underline">{{ r.distanceM }}m</NuxtLink>
                </td>
                <td class="py-1 pr-4 font-mono">{{ fmtMs(r.totalTimeMs) }}</td>
                <td class="py-1 pr-4 font-mono">
                  <span v-if="r.isPr" style="color: var(--color-accent)">PR</span>
                  <span v-else-if="r.deltaVsPreviousPrMs === null">-</span>
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
      <h2 class="text-sm font-medium mb-3" style="color: var(--color-text-muted)">Ontwikkeling per afstand</h2>
      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div v-for="trend in data.trends" :key="trend.distanceM" class="rounded-lg p-3" style="border: 1px solid var(--color-border)">
          <div class="text-sm font-mono mb-1">{{ trend.distanceM }}m</div>
          <TrendSparkline :points="trend.points" />
        </div>
      </div>
    </section>
  </div>
</template>
