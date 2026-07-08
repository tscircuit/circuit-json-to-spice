import { expect, test } from "bun:test"
import { circuitJsonToSpice } from "lib/circuitJsonToSpice"
import type { AnyCircuitElement } from "circuit-json"

// One component (R2) has a missing/invalid value — `null` here, which is what
// partial or hand-authored circuit JSON can realistically contain. The R/C/L
// value formatters call `.toString()` on the raw value, so a null/undefined
// value throws. The per-component loop has no error handling, so the throw
// propagates and the ENTIRE netlist is discarded — the perfectly valid R1 is
// lost too, and the caller gets nothing back.
const circuitWithOneBadValue: AnyCircuitElement[] = [
  {
    type: "source_component",
    source_component_id: "r1",
    name: "R1",
    ftype: "simple_resistor",
    resistance: 1000,
  },
  {
    type: "source_component",
    source_component_id: "r2",
    name: "R2",
    ftype: "simple_resistor",
    resistance: null,
  },
  {
    type: "source_port",
    source_port_id: "r1a",
    source_component_id: "r1",
    pin_number: 1,
  },
  {
    type: "source_port",
    source_port_id: "r1b",
    source_component_id: "r1",
    pin_number: 2,
  },
  {
    type: "source_port",
    source_port_id: "r2a",
    source_component_id: "r2",
    pin_number: 1,
  },
  {
    type: "source_port",
    source_port_id: "r2b",
    source_component_id: "r2",
    pin_number: 2,
  },
] as unknown as AnyCircuitElement[]

test("a component with an invalid value does not discard the rest of the netlist", () => {
  const spice = circuitJsonToSpice(circuitWithOneBadValue).toSpiceString()
  // The valid resistor must survive even though R2's value is invalid.
  expect(spice).toContain("RR1")
})
