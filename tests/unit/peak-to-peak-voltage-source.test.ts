import { expect, test } from "bun:test"
import type { AnyCircuitElement, SimulationVoltageSource } from "circuit-json"
import { circuitJsonToSpice } from "lib/circuitJsonToSpice"

const getCircuitWithAcVoltageSource = (
  voltageSource: Omit<
    Extract<SimulationVoltageSource, { is_dc_source: false }>,
    | "type"
    | "simulation_voltage_source_id"
    | "is_dc_source"
    | "terminal1_source_port_id"
    | "terminal2_source_port_id"
  >,
): AnyCircuitElement[] => [
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
  {
    type: "simulation_voltage_source",
    simulation_voltage_source_id: "source",
    is_dc_source: false,
    terminal1_source_port_id: "source_pos",
    terminal2_source_port_id: "source_neg",
    ...voltageSource,
  } as AnyCircuitElement,
]

test("sine source derives peak amplitude from peak-to-peak voltage", () => {
  const netlist = circuitJsonToSpice(
    getCircuitWithAcVoltageSource({
      peak_to_peak_voltage: 10,
      frequency: 60,
      wave_shape: "sinewave",
    }),
  )

  expect(netlist.toSpiceString()).toContain("Vsource N1 0 SIN(0 5 60 0 0 0)")
})

test("square source uses peak-to-peak voltage as its high level", () => {
  const netlist = circuitJsonToSpice(
    getCircuitWithAcVoltageSource({
      peak_to_peak_voltage: 10,
      frequency: 1000,
      wave_shape: "square",
    }),
  )

  expect(netlist.toSpiceString()).toContain(
    "Vsource N1 0 PULSE(0 10 0 1n 1n 500u 1m)",
  )
})

test("explicit voltage takes precedence over peak-to-peak voltage", () => {
  const netlist = circuitJsonToSpice(
    getCircuitWithAcVoltageSource({
      voltage: 3,
      peak_to_peak_voltage: 10,
      frequency: 60,
      wave_shape: "sinewave",
    }),
  )

  expect(netlist.toSpiceString()).toContain("Vsource N1 0 SIN(0 3 60 0 0 0)")
})
