import { expect, test } from "bun:test"
import { circuitJsonToSpice } from "../../lib"

test("TI solver iteration limits reach the SPICE options directive", () => {
  const spiceOptions = {
    method: "trap" as const,
    reltol: 0.001,
    abstol: "10n",
    vntol: "10u",
    itl1: 1500,
    itl2: 400,
    itl4: 400,
  }

  const netlist = circuitJsonToSpice([
    {
      type: "simulation_experiment",
      simulation_experiment_id: "simulation_experiment_1",
      name: "TI transient profile",
      experiment_type: "spice_transient_analysis",
      end_time_ms: 8,
      time_per_step: 0.00005,
      spice_options: spiceOptions,
    },
  ])

  expect(netlist.toSpiceString()).toMatchSnapshot()
})
