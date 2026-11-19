import type { CircuitJson } from "circuit-json"

type TransientVoltageGraph = Extract<
  CircuitJson[number],
  { type: "simulation_transient_voltage_graph" }
>

export const getVoltageSummary = ({
  graph,
  nominalVoltage,
}: {
  graph: Pick<
    TransientVoltageGraph,
    "name" | "voltage_levels" | "time_per_step"
  >
  nominalVoltage: number | undefined
}) => {
  const finalVoltage = graph.voltage_levels.at(-1)
  const settledSampleCount =
    graph.time_per_step > 0 && Number.isFinite(graph.time_per_step)
      ? Math.min(
          graph.voltage_levels.length,
          Math.floor(0.1 / graph.time_per_step) + 1,
        )
      : 0
  const settledVoltages = graph.voltage_levels.slice(-settledSampleCount)
  const settledMeanVoltage =
    settledSampleCount > 0
      ? settledVoltages.reduce((sum, voltage) => sum + voltage, 0) /
        settledSampleCount
      : undefined
  const settledPeakToPeakVoltage =
    settledSampleCount > 0
      ? settledVoltages.reduce(
          (highest, voltage) => Math.max(highest, voltage),
          -Infinity,
        ) -
        settledVoltages.reduce(
          (lowest, voltage) => Math.min(lowest, voltage),
          Infinity,
        )
      : undefined
  return {
    name: graph.name,
    nominalVoltage,
    finalVoltage,
    settledMeanVoltage,
    settledPeakToPeakVoltage,
    withinTwoPercent:
      settledMeanVoltage !== undefined &&
      Number.isFinite(settledMeanVoltage) &&
      nominalVoltage !== undefined &&
      Math.abs(settledMeanVoltage - nominalVoltage) <= nominalVoltage * 0.02,
  }
}
