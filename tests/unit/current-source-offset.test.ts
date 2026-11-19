import { expect, test } from "bun:test"
import { circuitJsonToSpice } from "lib/circuitJsonToSpice"

test("sine current sources retain their DC offset", () => {
  const netlist = circuitJsonToSpice([
    {
      type: "source_net",
      source_net_id: "out",
      name: "OUT",
      member_source_group_ids: [],
    },
    {
      type: "source_net",
      source_net_id: "ground",
      name: "GND",
      member_source_group_ids: [],
    },
    {
      type: "simulation_current_source",
      simulation_current_source_id: "load",
      is_dc_source: false,
      terminal1_source_net_id: "out",
      terminal2_source_net_id: "ground",
      current: 0.75,
      peak_to_peak_current: 0.5,
      frequency: 1000,
      wave_shape: "sinewave",
    },
  ])

  expect(netlist.toSpiceString()).toContain("SIN(0.75 0.25 1000 0 0 0)")
})
