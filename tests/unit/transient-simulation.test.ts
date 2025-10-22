import { test, expect } from "bun:test"
import { circuitJsonToSpice } from "lib/circuitJsonToSpice"
import type { AnyCircuitElement } from "circuit-json"
import type { BaseSpiceCommand } from "lib/spice-commands"
import { SpiceComponent } from "lib/spice-classes/SpiceComponent"

test("circuit with simulation experiment adds .tran command", () => {
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
      type: "simulation_experiment",
      simulation_experiment_id: "se1",
      name: "Test Transient Analysis",
      experiment_type: "spice_transient_analysis",
      time_per_step: 1, // ms
      start_time_ms: 10, // ms
      end_time_ms: 100, // ms
    } as AnyCircuitElement,
  ]

  const netlist = circuitJsonToSpice(circuitJson)
  const spiceString = netlist.toSpiceString()

  expect(spiceString).toContain(".tran 0.001 0.1 0.01 UIC")
  expect(spiceString).toMatchInlineSnapshot(`
    "* Circuit JSON to SPICE Netlist
    RR1 N1 N2 1K
    .tran 0.001 0.1 0.01 UIC
    .END"
  `)
})

test("does not add .tran if a component already provides one", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "simulation_experiment",
      simulation_experiment_id: "se1",
      name: "Test Transient Analysis",
      experiment_type: "spice_transient_analysis" as const,
      time_per_step: 1, // ms
      start_time_ms: 10, // ms
      end_time_ms: 100, // ms
    } as AnyCircuitElement,
  ]
  const netlist = circuitJsonToSpice(circuitJson)

  // Add a fake component that inserts a .tran command
  class CustomTranCommand implements BaseSpiceCommand {
    toSpiceString() {
      return ".tran 1us 10us"
    }
  }
  netlist.addComponent(
    new SpiceComponent("custom_tran", new CustomTranCommand(), []),
  )

  const spiceString = netlist.toSpiceString()

  expect(spiceString).toContain(".tran 1us 10us")
  expect(spiceString).not.toContain(".tran 0.001 0.1 0.01")
  expect(spiceString).toMatchInlineSnapshot(`
    "* Circuit JSON to SPICE Netlist
    .tran 1us 10us
    .END"
  `)
})

test("circuit with incomplete simulation experiment does not add .tran command", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "simulation_experiment",
      simulation_experiment_id: "se1",
      name: "Test Transient Analysis",
      experiment_type: "spice_transient_analysis" as const,
      start_time_ms: 10, // ms
      end_time_ms: 100, // ms
      // time_per_step is missing
    } as AnyCircuitElement,
  ]

  const netlist = circuitJsonToSpice(circuitJson)
  const spiceString = netlist.toSpiceString()

  expect(spiceString).not.toContain(".tran")
  expect(spiceString).toMatchInlineSnapshot(`
    "* Circuit JSON to SPICE Netlist
    .END"
  `)
})

test("circuit with simulation experiment and 0 start time adds .tran command", () => {
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
      type: "simulation_experiment",
      simulation_experiment_id: "se1",
      name: "Test Transient Analysis",
      experiment_type: "spice_transient_analysis",
      time_per_step: 1, // ms
      start_time_ms: 0, // ms
      end_time_ms: 100, // ms
    } as AnyCircuitElement,
  ]

  const netlist = circuitJsonToSpice(circuitJson)
  const spiceString = netlist.toSpiceString()

  expect(spiceString).toContain(".tran 0.001 0.1 UIC")
  expect(spiceString).not.toContain(" 0.01")
  expect(spiceString).toMatchInlineSnapshot(`
    "* Circuit JSON to SPICE Netlist
    RR1 N1 N2 1K
    .tran 0.001 0.1 UIC
    .END"
  `)
})
