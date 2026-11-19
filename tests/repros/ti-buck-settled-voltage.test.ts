import { expect, test } from "bun:test"
import type { CircuitJson } from "circuit-json"
import { convertCircuitJsonToSchematicSimulationSvg } from "circuit-to-svg"
import { getVoltageSummary } from "../../examples/ti-power/get-voltage-summary"
import graph from "../fixtures/ti-buck-loadstep-settled.json"

test("TI buck regulation with a high final switching sample", () => {
  // Actual final 100 us of the 8 ms TPS54320 load-step run, sampled at 50 ns.
  const summary = getVoltageSummary({ graph, nominalVoltage: 3.3 })
  expect(summary).toMatchSnapshot()

  const circuitJson: CircuitJson = [
    {
      type: "simulation_experiment",
      simulation_experiment_id: "snapshot_experiment",
      experiment_type: "spice_transient_analysis",
      name: "TPS54320: final 100 us of the load-step bench",
    },
    { ...graph, type: "simulation_transient_voltage_graph" },
  ]
  if (!summary.withinTwoPercent) {
    circuitJson.push({
      type: "simulation_unknown_experiment_error",
      simulation_unknown_experiment_error_id: "regulation_check",
      error_type: "simulation_unknown_experiment_error",
      message: `Regulation check failed: final sample ${summary.finalVoltage?.toFixed(4)} V, nominal 3.3 V +/-2%.`,
    })
  }
  expect(
    convertCircuitJsonToSchematicSimulationSvg({
      circuitJson,
      simulation_experiment_id: "snapshot_experiment",
      schematicHeightRatio: summary.withinTwoPercent ? 0 : 0.15,
      width: 1000,
      height: 500,
      showErrorsInTextOverlay: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
