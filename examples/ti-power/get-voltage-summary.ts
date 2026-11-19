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
  return {
    name: graph.name,
    nominalVoltage,
    finalVoltage,
    withinTwoPercent:
      finalVoltage !== undefined &&
      Number.isFinite(finalVoltage) &&
      nominalVoltage !== undefined &&
      Math.abs(finalVoltage - nominalVoltage) <= nominalVoltage * 0.02,
  }
}
