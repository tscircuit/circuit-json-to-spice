import { test, expect } from "bun:test"
import { circuitJsonToSpice } from "lib/circuitJsonToSpice"
import type { AnyCircuitElement } from "circuit-json"
import singleResistorCircuit from "./assets/single-resistor-circuit.json"
import rcCircuitWithTrace from "./assets/RC-circuit-with-trace.json"
import circuitWithSimulationVoltageSource from "./assets/circuit-with-simulation-voltage-source.json"

test("empty circuit JSON", () => {
  const circuitJson: AnyCircuitElement[] = []
  const netlist = circuitJsonToSpice(circuitJson)

  expect(netlist.components).toHaveLength(0)
  expect(netlist.toSpiceString()).toMatchInlineSnapshot(`
    "* Circuit JSON to SPICE Netlist
    .END"
  `)
})

test("single resistor circuit", async () => {
  const circuitJson = singleResistorCircuit as any
  const netlist = circuitJsonToSpice(circuitJson)

  expect(netlist.components).toHaveLength(1)
  expect(netlist.toSpiceString()).toMatchInlineSnapshot(`
    "* Circuit JSON to SPICE Netlist
    RR1 N1 0 1K
    .END"
  `)
})

test("RC circuit with trace", async () => {
  const circuitJson = rcCircuitWithTrace as any
  const netlist = circuitJsonToSpice(circuitJson)

  expect(netlist.components).toHaveLength(2)
  expect(netlist.toSpiceString()).toMatchInlineSnapshot(`
    "* Circuit JSON to SPICE Netlist
    RR1 0 N1 1K
    CC1 N1 0 1U
    .END"
  `)
})

test("circuit with simulation voltage source", async () => {
  const circuitJson = circuitWithSimulationVoltageSource as any
  const netlist = circuitJsonToSpice(circuitJson)

  expect(netlist.components).toHaveLength(2)
  expect(netlist.toSpiceString()).toMatchInlineSnapshot(`
    "* Circuit JSON to SPICE Netlist
    RR1 N1 0 1K
    Vsimulation_voltage_source_0 N1 0 DC 5
    .END"
  `)
})

test("simple switch uses simulation switch control", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "source_component",
      source_component_id: "RLOAD",
      name: "R1",
      ftype: "simple_resistor",
      resistance: 1000,
    } as AnyCircuitElement,
    {
      type: "source_component",
      source_component_id: "SW1",
      name: "SW1",
      ftype: "simple_switch",
    },
    {
      type: "source_net",
      source_net_id: "net_gnd",
      name: "GND",
      member_source_group_ids: [],
    } as AnyCircuitElement,
    {
      type: "source_net",
      source_net_id: "net_vin",
      name: "VIN",
      member_source_group_ids: [],
    } as AnyCircuitElement,
    {
      type: "source_net",
      source_net_id: "net_vout",
      name: "VOUT",
      member_source_group_ids: [],
    } as AnyCircuitElement,
    {
      type: "source_port",
      source_port_id: "RLOAD_pin1",
      source_component_id: "RLOAD",
      name: "pin1",
      pin_number: 1,
    } as AnyCircuitElement,
    {
      type: "source_port",
      source_port_id: "RLOAD_pin2",
      source_component_id: "RLOAD",
      name: "pin2",
      pin_number: 2,
    } as AnyCircuitElement,
    {
      type: "source_port",
      source_port_id: "SW1_pin1",
      source_component_id: "SW1",
      name: "pin1",
      pin_number: 1,
    } as AnyCircuitElement,
    {
      type: "source_port",
      source_port_id: "SW1_pin2",
      source_component_id: "SW1",
      name: "pin2",
      pin_number: 2,
    } as AnyCircuitElement,
    {
      type: "source_trace",
      source_trace_id: "trace_vout",
      connected_source_port_ids: ["RLOAD_pin1", "SW1_pin2"],
      connected_source_net_ids: ["net_vout"],
    } as AnyCircuitElement,
    {
      type: "source_trace",
      source_trace_id: "trace_gnd",
      connected_source_port_ids: ["RLOAD_pin2"],
      connected_source_net_ids: ["net_gnd"],
    } as AnyCircuitElement,
    {
      type: "source_trace",
      source_trace_id: "trace_vin",
      connected_source_port_ids: ["SW1_pin1"],
      connected_source_net_ids: ["net_vin"],
    } as AnyCircuitElement,
    {
      type: "simulation_switch",
      simulation_switch_id: "switch_SW1",
      source_component_id: "SW1",
      switching_frequency: 1000,
      starts_closed: false,
    } as unknown as AnyCircuitElement,
  ]

  const netlist = circuitJsonToSpice(circuitJson)

  expect(netlist.toSpiceString()).toMatchInlineSnapshot(`
    "* Circuit JSON to SPICE Netlist
    .MODEL SW_SW1 SW(Ron=0.1 Roff=1e9 Vt=2.5 Vh=0.1)
    RR1 N1 0 1K
    VCTRL_SW1 NCTRL_SW1 0 PULSE(0 5 0 1n 1n 0.0005 0.001)
    SSW1 N2 N1 NCTRL_SW1 0 SW_SW1
    .END"
  `)
})
