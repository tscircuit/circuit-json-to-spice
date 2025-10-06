import { test, expect } from "bun:test"
import { circuitJsonToSpice } from "lib/circuitJsonToSpice"
import type { AnyCircuitElement } from "circuit-json"
import type { BaseSpiceCommand } from "lib/spice-commands"
import { SpiceComponent } from "lib/spice-classes/SpiceComponent"

test("circuit with simulation transient voltage graph adds .tran command", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "source_component",
      source_component_id: "R1",
      name: "R1",
      ftype: "simple_resistor",
      resistance: 1000,
    } as AnyCircuitElement,
    {
      type: "source_port",
      source_port_id: "R1_p1",
      name: "p1",
      source_component_id: "R1",
    } as AnyCircuitElement,
    {
      type: "source_port",
      source_port_id: "R1_p2",
      name: "p2",
      source_component_id: "R1",
    } as AnyCircuitElement,
    {
      type: "simulation_transient_voltage_graph",
      simulation_transient_voltage_graph_id: "stvg1",
      simulation_experiment_id: "se1",
      voltage_levels: [],
      time_per_step: 1, // ms
      start_time_ms: 10, // ms
      end_time_ms: 100, // ms
      name: "test_graph",
    } as AnyCircuitElement,
  ]

  const netlist = circuitJsonToSpice(circuitJson)
  const spiceString = netlist.toSpiceString()

  expect(spiceString).toContain(".tran 0.001 0.1 0.01")
  expect(spiceString).toMatchInlineSnapshot(`
    "* Circuit JSON to SPICE Netlist
    RR1 N1 N2 1K
    .tran 0.001 0.1 0.01
    .END"
  `)
})

test("circuit with simulation transient voltage graph and 0 start time adds .tran command", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "source_component",
      source_component_id: "R1",
      name: "R1",
      ftype: "simple_resistor",
      resistance: 1000,
    } as AnyCircuitElement,
    {
      type: "source_port",
      source_port_id: "R1_p1",
      name: "p1",
      source_component_id: "R1",
    } as AnyCircuitElement,
    {
      type: "source_port",
      source_port_id: "R1_p2",
      name: "p2",
      source_component_id: "R1",
    } as AnyCircuitElement,
    {
      type: "simulation_transient_voltage_graph",
      simulation_transient_voltage_graph_id: "stvg1",
      simulation_experiment_id: "se1",
      voltage_levels: [],
      time_per_step: 1, // ms
      start_time_ms: 0, // ms
      end_time_ms: 100, // ms
      name: "test_graph",
    } as AnyCircuitElement,
  ]

  const netlist = circuitJsonToSpice(circuitJson)
  const spiceString = netlist.toSpiceString()

  expect(spiceString).toContain(".tran 0.001 0.1")
  expect(spiceString).not.toContain(" 0.01")
  expect(spiceString).toMatchInlineSnapshot(`
    "* Circuit JSON to SPICE Netlist
    RR1 N1 N2 1K
    .tran 0.001 0.1
    .END"
  `)
})
