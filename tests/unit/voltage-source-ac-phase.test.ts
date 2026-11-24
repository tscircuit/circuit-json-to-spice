import { expect, test } from "bun:test"
import { VoltageSourceCommand } from "lib/spice-commands/VoltageSourceCommand"
import { circuitJsonToSpice } from "lib/circuitJsonToSpice"
import type { AnyCircuitElement } from "circuit-json"

test("VoltageSourceCommand keeps acPhase with a default AC magnitude of 1", () => {
  const source = new VoltageSourceCommand({
    name: "vin",
    positiveNode: "N1",
    negativeNode: "0",
    value: "DC 5",
    acPhase: "45",
  })

  // An AC phase without a magnitude still has to land on the netlist:
  // SPICE AC magnitude defaults to 1 when only a phase is given
  expect(source.toSpiceString()).toBe("Vvin N1 0 DC 5 AC 1 45")
})

test("VoltageSourceCommand keeps emitting explicit AC magnitude and phase", () => {
  const source = new VoltageSourceCommand({
    name: "vin",
    positiveNode: "N1",
    negativeNode: "0",
    value: "DC 5",
    acMagnitude: "2",
    acPhase: "45",
  })

  expect(source.toSpiceString()).toBe("Vvin N1 0 DC 5 AC 2 45")
})

test("VoltageSourceCommand emits a bare AC magnitude without a phase", () => {
  const source = new VoltageSourceCommand({
    name: "vin",
    positiveNode: "N1",
    negativeNode: "0",
    value: "DC 5",
    acMagnitude: "2",
  })

  expect(source.toSpiceString()).toBe("Vvin N1 0 DC 5 AC 2")
})

test("DC voltage source with only ac_phase keeps its AC spec", () => {
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
      source_component_id: "R1",
      name: "p1",
      pin_number: 1,
    } as AnyCircuitElement,
    {
      type: "source_port",
      source_port_id: "R1_p2",
      source_component_id: "R1",
      name: "p2",
      pin_number: 2,
    } as AnyCircuitElement,
    {
      type: "simulation_voltage_source",
      simulation_voltage_source_id: "vin",
      is_dc_source: true,
      positive_source_port_id: "R1_p1",
      negative_source_port_id: "R1_p2",
      voltage: 5,
      ac_phase: 45,
    } as AnyCircuitElement,
  ]

  const spiceString = circuitJsonToSpice(circuitJson).toSpiceString()

  expect(spiceString).toContain("Vvin N1 N2 DC 5 AC 1 45")
})
