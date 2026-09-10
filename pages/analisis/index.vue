<script setup lang="ts">
import ComboChart from "@/components/ui/charts/combo-chart/ComboChart.vue";
const revenue = [
	{ m: "Q1", revenue: 42000, margin: 18 },
	{ m: "Q2", revenue: 51000, margin: 21 },
	{ m: "Q3", revenue: 47000, margin: 19 },
	{ m: "Q4", revenue: 68000, margin: 26 },
];
</script>

<template>
	<ComboChart
		:data="[
			{ m: 'Jan', a: 120, b: 90, t: 200 },
			{ m: 'Feb', a: 150, b: 110, t: 240 },
			{ m: 'Mar', a: 130, b: 100, t: 220 },
		]"
		x-field="m"
		:bar-field="['a', 'b']"
		line-field="t"
		height="300"
	/>
</template>
