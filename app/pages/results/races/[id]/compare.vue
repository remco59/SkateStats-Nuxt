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
    <h1 class="text-xl font-semibold">
      Vergelijk {{ data.baseRace.distanceM }}m &middot; {{ data.baseRace.competitionName }}
    </h1>

    <section class="space-y-2">
      <label for="compareRaceSelect" class="text-sm" style="color: var(--color-text-muted)">
        Selecteer vergelijkingsrit
      </label>
      <select
        id="compareRaceSelect"
        v-model="compareRaceId"
        class="w-full rounded-md px-3 py-2 text-sm"
        style="border: 1px solid var(--color-border); background: var(--color-surface); box-shadow: var(--shadow-card)"
        @change="selectCompare"
      >
        <option value="">Kies een rit op dezelfde afstand</option>
        <option v-for="c in data.candidates" :key="c.id" :value="c.id">
          {{ c.competitionName }} ({{ c.competitionDate }}) -- {{ fmtMs(c.totalTimeMs) }}
        </option>
      </select>
      <p v-if="!data.candidates.length" class="text-sm" style="color: var(--color-text-muted)">
        Geen andere ritten op deze afstand om mee te vergelijken.
      </p>
    </section>

    <template v-if="data.comparison">
      <section>
        <h2 class="text-sm font-medium mb-2" style="color: var(--color-text-muted)">Samenvatting</h2>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left" style="color: var(--color-text-muted)">
                <th class="py-1 pr-4"/>
                <th class="py-1 pr-4">Basis</th>
                <th class="py-1 pr-4">Vergelijking</th>
                <th class="py-1 pr-4">Delta</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in data.comparison.summary" :key="row.label" style="border-top: 1px solid var(--color-border)">
                <td class="py-1 pr-4">{{ row.label }}</td>
                <td class="py-1 pr-4 font-mono">{{ fmtMs(row.baseMs) }}</td>
                <td class="py-1 pr-4 font-mono">{{ fmtMs(row.compareMs) }}</td>
                <td class="py-1 pr-4 font-mono">
                  <span v-if="row.deltaMs === null">-</span>
                  <span v-else :style="{ color: row.deltaMs <= 0 ? 'var(--color-success)' : 'var(--color-danger)' }">
                    {{ row.deltaMs > 0 ? '+' : '' }}{{ fmtMs(row.deltaMs) }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 class="text-sm font-medium mb-2" style="color: var(--color-text-muted)">Cumulatief tijdsverschil</h2>
        <CompareChart :values="data.comparison.splits.map((s) => s.cumulativeDeltaMs)" />
      </section>

      <section>
        <h2 class="text-sm font-medium mb-2" style="color: var(--color-text-muted)">Splitvergelijking</h2>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left" style="color: var(--color-text-muted)">
                <th class="py-1 pr-4">#</th>
                <th class="py-1 pr-4">Afstand</th>
                <th class="py-1 pr-4">Basis</th>
                <th class="py-1 pr-4">Vergelijking</th>
                <th class="py-1 pr-4">Delta</th>
                <th class="py-1 pr-4">Cumulatief</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in data.comparison.splits"
                :key="row.index"
                style="border-top: 1px solid var(--color-border)"
                :style="{
                  background:
                    row.index === data.comparison.onderdelen.sterkste?.index
                      ? 'color-mix(in srgb, var(--color-success) 10%, transparent)'
                      : row.index === data.comparison.onderdelen.zwakste?.index
                        ? 'color-mix(in srgb, var(--color-danger) 10%, transparent)'
                        : undefined,
                }"
              >
                <td class="py-1 pr-4">{{ row.index }}</td>
                <td class="py-1 pr-4">{{ row.distanceM }}m</td>
                <td class="py-1 pr-4 font-mono">{{ row.baseSplit?.toFixed(2) ?? '-' }}</td>
                <td class="py-1 pr-4 font-mono">{{ row.compareSplit?.toFixed(2) ?? '-' }}</td>
                <td class="py-1 pr-4 font-mono">
                  <span v-if="row.splitDeltaMs === null">-</span>
                  <span v-else :style="{ color: row.splitDeltaMs <= 0 ? 'var(--color-success)' : 'var(--color-danger)' }">
                    {{ row.splitDeltaMs > 0 ? '+' : '' }}{{ fmtMs(row.splitDeltaMs) }}
                  </span>
                </td>
                <td class="py-1 pr-4 font-mono">{{ fmtMs(row.cumulativeDeltaMs) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="grid sm:grid-cols-2 gap-4 text-sm">
        <div>
          <h3 class="font-medium mb-1" style="color: var(--color-text-muted)">Pacing basisrit</h3>
          <p>{{ data.comparison.pacing.basisLabels.join(', ') || '-' }}</p>
        </div>
        <div>
          <h3 class="font-medium mb-1" style="color: var(--color-text-muted)">Pacing vergelijkingsrit</h3>
          <p>{{ data.comparison.pacing.vergelijkingLabels.join(', ') || '-' }}</p>
        </div>
      </section>
    </template>
  </div>
  <p v-else-if="error" style="color: var(--color-danger)">Rit niet gevonden.</p>
</template>
