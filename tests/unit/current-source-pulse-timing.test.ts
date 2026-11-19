import { expect, test } from "bun:test"
import { circuitJsonToSpice } from "lib/circuitJsonToSpice"

test("explicit current pulse timing overrides frequency and duty cycle", () => {
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
      duty_cycle: 0.25,
      pulse_delay: 0,
      rise_time: 0,
      fall_time: 0,
      pulse_width: 10,
      period: 20,
      wave_shape: "square",
    },
  ])

  expect(netlist.toSpiceString()).toContain("PULSE(0.75 1.25 0 0 0 10m 20m)")
})
