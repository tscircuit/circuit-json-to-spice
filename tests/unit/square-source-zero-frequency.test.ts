import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { circuitJsonToSpice } from "lib/circuitJsonToSpice"

const baseCircuit: AnyCircuitElement[] = [
  {
    type: "source_component",
    source_component_id: "comp_r1",
    name: "R1",
    ftype: "simple_resistor",
    resistance: 1000,
  } as any,
  {
    type: "source_port",
    source_port_id: "r1_p1",
    source_component_id: "comp_r1",
    name: "pin1",
    pin_number: 1,
  } as any,
  {
    type: "source_port",
    source_port_id: "r1_p2",
    source_component_id: "comp_r1",
    name: "pin2",
    pin_number: 2,
  } as any,
  {
    type: "source_net",
    source_net_id: "net_gnd",
    name: "GND",
    member_source_group_ids: [],
  },
  {
    type: "source_trace",
    source_trace_id: "trace_gnd",
    connected_source_port_ids: ["r1_p2"],
    connected_source_net_ids: ["net_gnd"],
  },
]

test("square voltage source with zero or omitted frequency emits DC instead of PULSE(... Infinity)", () => {
  const spice = circuitJsonToSpice([
    ...baseCircuit,
    {
      type: "simulation_voltage_source",
      simulation_voltage_source_id: "v_sq_zero",
      is_dc_source: false,
      terminal1_source_port_id: "r1_p1",
      terminal2_source_port_id: "r1_p2",
      wave_shape: "square",
      voltage: 5,
      frequency: 0,
    },
  ]).toSpiceString()

  expect(spice).not.toContain("Infinity")
  expect(spice).toContain("Vv_sq_zero N1 0 DC 5")
})

test("square voltage source with explicit positive period still emits PULSE when frequency is omitted", () => {
  const spice = circuitJsonToSpice([
    ...baseCircuit,
    {
      type: "simulation_voltage_source",
      simulation_voltage_source_id: "v_sq_period",
      is_dc_source: false,
      terminal1_source_port_id: "r1_p1",
      terminal2_source_port_id: "r1_p2",
      wave_shape: "square",
      voltage: 5,
      period: 10,
      duty_cycle: 0.5,
    },
  ]).toSpiceString()

  expect(spice).toContain("Vv_sq_period N1 0 PULSE(0 5 0 1n 1n 5m 10m)")
})

test("square current source with zero or omitted frequency emits DC instead of PULSE(... Infinity)", () => {
  const spice = circuitJsonToSpice([
    ...baseCircuit,
    {
      type: "simulation_current_source",
      simulation_current_source_id: "i_sq_zero",
      is_dc_source: false,
      terminal1_source_port_id: "r1_p1",
      terminal2_source_port_id: "r1_p2",
      wave_shape: "square",
      current: 0.25,
      peak_to_peak_current: 0.5,
      frequency: 0,
    },
  ]).toSpiceString()

  expect(spice).not.toContain("Infinity")
  expect(spice).toContain("Ii_sq_zero N1 0 DC 0.25")
})
