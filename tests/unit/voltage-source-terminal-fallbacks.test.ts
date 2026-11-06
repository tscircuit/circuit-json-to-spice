import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { circuitJsonToSpice } from "lib/circuitJsonToSpice"

const baseCircuit: AnyCircuitElement[] = [
  {
    type: "source_net",
    source_net_id: "net_out",
    name: "OUT",
    member_source_group_ids: [],
  } as AnyCircuitElement,
  {
    type: "source_net",
    source_net_id: "net_gnd",
    name: "GND",
    member_source_group_ids: [],
  } as AnyCircuitElement,
  {
    type: "source_port",
    source_port_id: "source_pos",
    name: "pos",
    source_component_id: "source",
  } as AnyCircuitElement,
  {
    type: "source_port",
    source_port_id: "source_neg",
    name: "neg",
    source_component_id: "source",
  } as AnyCircuitElement,
  {
    type: "source_trace",
    source_trace_id: "trace_out",
    connected_source_port_ids: ["source_pos"],
    connected_source_net_ids: ["net_out"],
  } as AnyCircuitElement,
  {
    type: "source_trace",
    source_trace_id: "trace_gnd",
    connected_source_port_ids: ["source_neg"],
    connected_source_net_ids: ["net_gnd"],
  } as AnyCircuitElement,
]

test("AC voltage source falls back to positive and negative source port/net IDs", () => {
  const netlist = circuitJsonToSpice([
    ...baseCircuit,
    {
      type: "simulation_voltage_source",
      simulation_voltage_source_id: "ac_src",
      is_dc_source: false,
      positive_source_port_id: "source_pos",
      negative_source_port_id: "source_neg",
      voltage: 5,
      frequency: 1000,
      wave_shape: "sinewave",
    } as unknown as AnyCircuitElement,
  ])

  expect(netlist.toSpiceString()).toContain("Vac_src N1 0 SIN(0 5 1000 0 0 0)")
})

test("DC voltage source falls back to terminal1 and terminal2 source net IDs", () => {
  const netlist = circuitJsonToSpice([
    ...baseCircuit,
    {
      type: "simulation_voltage_source",
      simulation_voltage_source_id: "dc_src",
      is_dc_source: true,
      terminal1_source_net_id: "net_out",
      terminal2_source_net_id: "net_gnd",
      voltage: 3.3,
    } as unknown as AnyCircuitElement,
  ])

  expect(netlist.toSpiceString()).toContain("Vdc_src N1 0 DC 3.3")
})
