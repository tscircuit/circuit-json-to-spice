import { test, expect } from "bun:test"
import { circuitJsonToSpice } from "lib/circuitJsonToSpice"
import type { AnyCircuitElement } from "circuit-json"

test("empty circuit JSON", () => {
  const circuitJson: AnyCircuitElement[] = []
  const netlist = circuitJsonToSpice(circuitJson)

  expect(netlist.components).toHaveLength(0)
  expect(netlist.toSpiceString()).toMatchInlineSnapshot(`
    "* Circuit JSON to SPICE Netlist
    .END"
  `)
})

test("single resistor circuit JSON", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "source_component",
      source_component_id: "R1",
      name: "R1",
      ftype: "simple_resistor",
      resistance: 1000,
    } as any,
    {
      type: "source_port",
      source_port_id: "R1_pin1",
      source_component_id: "R1",
      name: "pin1",
      pin_number: 1,
    } as any,
    {
      type: "source_port",
      source_port_id: "R1_pin2",
      source_component_id: "R1",
      name: "pin2",
      pin_number: 2,
    } as any,
  ]

  const netlist = circuitJsonToSpice(circuitJson)

  expect(netlist.components).toHaveLength(1)
  expect(netlist.toSpiceString()).toMatchInlineSnapshot(`
    "* Circuit JSON to SPICE Netlist
    RR1 0 0 1K
    .END"
  `)
})

test("RC circuit with trace", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "source_component",
      source_component_id: "R1",
      name: "R1",
      ftype: "simple_resistor",
      resistance: 1000,
    } as any,
    {
      type: "source_component",
      source_component_id: "C1",
      name: "C1",
      ftype: "simple_capacitor",
      capacitance: 1e-6,
    } as any,
    {
      type: "source_port",
      source_port_id: "R1_pin1",
      source_component_id: "R1",
      name: "pin1",
    } as any,
    {
      type: "source_port",
      source_port_id: "R1_pin2",
      source_component_id: "R1",
      name: "pin2",
    } as any,
    {
      type: "source_port",
      source_port_id: "C1_pin1",
      source_component_id: "C1",
      name: "pin1",
    } as any,
    {
      type: "source_port",
      source_port_id: "C1_pin2",
      source_component_id: "C1",
      name: "pin2",
    } as any,
    {
      type: "source_trace",
      source_trace_id: "trace1",
      connected_source_port_ids: ["R1_pin2", "C1_pin1"],
      connected_source_net_ids: [],
    } as any,
  ]

  const netlist = circuitJsonToSpice(circuitJson)

  expect(netlist.components).toHaveLength(2)
  expect(netlist.toSpiceString()).toMatchInlineSnapshot(`
    "* Circuit JSON to SPICE Netlist
    RR1 0 N1 1K
    CC1 N1 0 1U
    .END"
  `)
})

test("circuit with simulation voltage source", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "source_component",
      source_component_id: "R1",
      name: "R1",
      ftype: "simple_resistor",
      resistance: 1000,
    } as any,
    {
      type: "source_port",
      source_port_id: "R1_pin1",
      source_component_id: "R1",
      name: "pin1",
    } as any,
    {
      type: "source_port",
      source_port_id: "R1_pin2",
      source_component_id: "R1",
      name: "pin2",
    } as any,
    {
      type: "simulation_voltage_source",
      simulation_voltage_source_id: "V1",
      positive_source_port_id: "R1_pin1",
      negative_source_port_id: "R1_pin2",
      voltage: 5,
    } as any,
  ]

  const netlist = circuitJsonToSpice(circuitJson)

  expect(netlist.components).toHaveLength(2)
  expect(netlist.toSpiceString()).toMatchInlineSnapshot(`
    "* Circuit JSON to SPICE Netlist
    RR1 0 0 1K
    VV1 0 0 DC 5
    .END"
  `)
})
