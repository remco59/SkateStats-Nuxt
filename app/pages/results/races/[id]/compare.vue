<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const id = route.params.id as string

const compareRaceId = ref(route.query.compareRaceId ? String(route.query.compareRaceId) : '')

const { data, error, refresh } = await useFetch(`/api/results/races/${id}/compare`, {
  query: { compareRaceId },
})

function selectCompare() {
  router.push({ query: { compareRaceId: compareRaceId.value || undefined } })
  refresh()
}
</script>

<template>
  <div v-if="data" class="space-y-6 max-w-3xl">
    <h1 class="page-title">
      Vergelijk {{ data.baseRace.distanceM }}m &middot; {{ data.baseRace.competitionName }}
    </h1>

    <section class="space-y-2">
      <label for="compareRaceSelect" class="text-secondary">
        Selecteer vergelijkingsrit
      </label>
      <select
        id="compareRaceSelect"
        v-model="compareRaceId"
        class="field w-full"
        @change="selectCompare"
      >
        <option value="">Kies een rit op dezelfde afstand</option>
        <option v-for="c in data.candidates" :key="c.id" :value="c.id">
          {{ c.competitionName }} ({{ c.competitionDate }}) -- {{ fmtMs(c.totalTimeMs) }}
        </option>
      </select>
      <p v-if="!data.candidates.length" class="text-secondary">
        Geen andere ritten op deze afstand om mee te vergelijken.
      </p>
    </section>

    <template v-if="data.comparison">
      <section>
        <h2 class="card-title mb-2">Samenvatting</h2>
        <div class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th/>
                <th class="num">Basis</th>
                <th class="num">Vergelijking</th>
                <th class="num">Delta</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in data.comparison.summary" :key="row.label">
                <td class="text-secondary">{{ row.label }}</td>
                <td class="num font-mono">{{ fmtMs(row.baseMs) }}</td>
                <td class="num font-mono">{{ fmtMs(row.compareMs) }}</td>
                <td class="num font-mono">
                  <span v-if="row.deltaMs === null" class="delta-neutral">-</span>
                  <span v-else :class="row.deltaMs <= 0 ? 'delta-better' : 'delta-worse'">
                    {{ row.deltaMs > 0 ? '+' : '' }}{{ fmtMs(row.deltaMs) }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 class="card-title mb-2">Cumulatief tijdsverschil</h2>
        <CompareChart :values="data.comparison.splits.map((s) => s.cumulativeDeltaMs)" />
      </section>

      <section>
        <h2 class="card-title mb-2">Splitvergelijking</h2>
        <div class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Afstand</th>
                <th class="num">Basis</th>
                <th class="num">Vergelijking</th>
                <th class="num">Delta</th>
                <th class="num">Cumulatief</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in data.comparison.splits"
                :key="row.index"
                :style="{
                  background:
                    row.index === data.comparison.onderdelen.sterkste?.index
                      ? 'color-mix(in srgb, var(--color-success) 8%, transparent)'
                      : row.index === data.comparison.onderdelen.zwakste?.index
                        ? 'color-mix(in srgb, var(--color-danger) 8%, transparent)'
                        : undefined,
                }"
              >
                <td class="text-meta">{{ row.index }}</td>
                <td class="text-meta">{{ row.distanceM }}m</td>
                <td class="num font-mono">{{ row.baseSplit?.toFixed(2) ?? '-' }}</td>
                <td class="num font-mono">{{ row.compareSplit?.toFixed(2) ?? '-' }}</td>
                <td class="num font-mono">
                  <span v-if="row.splitDeltaMs === null" class="delta-neutral">-</span>
                  <span v-else :class="row.splitDeltaMs <= 0 ? 'delta-better' : 'delta-worse'">
                    {{ row.splitDeltaMs > 0 ? '+' : '' }}{{ fmtMs(row.splitDeltaMs) }}
                  </span>
                </td>
                <td class="num font-mono">{{ fmtMs(row.cumulativeDeltaMs) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="grid sm:grid-cols-2 gap-4 text-sm">
        <div>
          <h3 class="card-title mb-1">Pacing basisrit</h3>
          <p class="text-secondary">{{ data.comparison.pacing.basisLabels.join(', ') || '-' }}</p>
        </div>
        <div>
          <h3 class="card-title mb-1">Pacing vergelijkingsrit</h3>
          <p class="text-secondary">{{ data.comparison.pacing.vergelijkingLabels.join(', ') || '-' }}</p>
        </div>
      </section>
    </template>
  </div>
  <p v-else-if="error" style="color: var(--color-danger)">Rit niet gevonden.</p>
</template>
