import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { circuitJsonToSpice } from "lib/circuitJsonToSpice"
import { CircuitJsonToSpiceError } from "lib/errors"

const operatingPointCircuit: AnyCircuitElement[] = [
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
    name: "GND",
    pin_number: 2,
  } as AnyCircuitElement,
  {
    type: "simulation_voltage_probe",
    simulation_voltage_probe_id: "probe1",
    signal_input_source_port_id: "R1_p1",
    name: "VOUT",
  } as AnyCircuitElement,
  {
    type: "simulation_experiment",
    simulation_experiment_id: "se1",
    name: "Bias point",
    experiment_type: "spice_dc_operating_point",
  } as AnyCircuitElement,
]

test("operating-point experiment emits probe metadata, OP output, and .op", () => {
  const spiceString = circuitJsonToSpice(operatingPointCircuit).toSpiceString()

  expect(spiceString).toMatchInlineSnapshot(`
    "* Circuit JSON to SPICE Netlist
    RR1 VOUT N1 1K
    * tscircuit_probe {\"simulation_voltage_probe_id\":\"probe1\",\"name\":\"VOUT\",\"spice_vector\":\"V(VOUT)\",\"source_node_name\":\"VOUT\"}
    .PRINT OP V(VOUT)
    .SAVE V(VOUT)
    .op
    .END"
  `)
  expect(spiceString).not.toContain(".tran")
  expect(spiceString).not.toContain("UIC")
})

test("unmodeled chips report missing_model unless explicitly marked as a boundary", () => {
  const chip = {
    type: "source_component",
    source_component_id: "U1",
    name: "U1",
    ftype: "simple_chip",
    is_simulation_boundary: false,
  } as AnyCircuitElement

  try {
    circuitJsonToSpice([...operatingPointCircuit, chip])
    throw new Error("Expected conversion to fail")
  } catch (error) {
    expect(error).toBeInstanceOf(CircuitJsonToSpiceError)
    expect((error as CircuitJsonToSpiceError).code).toBe("missing_model")
    expect((error as Error).message).toContain("U1")
  }

  const boundaryChip = {
    ...chip,
    is_simulation_boundary: true,
  } as unknown as AnyCircuitElement
  expect(() =>
    circuitJsonToSpice([...operatingPointCircuit, boundaryChip]),
  ).not.toThrow()
})

test("unsupported analyses report unsupported_analysis", () => {
  const circuit = operatingPointCircuit.map((element) =>
    element.type === "simulation_experiment"
      ? ({
          ...element,
          experiment_type: "spice_ac_analysis",
        } as AnyCircuitElement)
      : element,
  )

  try {
    circuitJsonToSpice(circuit)
    throw new Error("Expected conversion to fail")
  } catch (error) {
    expect(error).toBeInstanceOf(CircuitJsonToSpiceError)
    expect((error as CircuitJsonToSpiceError).code).toBe("unsupported_analysis")
  }
})
