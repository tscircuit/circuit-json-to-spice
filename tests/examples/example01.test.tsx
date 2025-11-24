import { test, expect } from "bun:test"
import { circuitJsonToSpice } from "lib/circuitJsonToSpice"
import example01 from "./assets/example01.json"

test("example01", async () => {
  const circuitJson = example01 as any

  // Convert circuit JSON to SPICE
  const spiceNetlist = circuitJsonToSpice(circuitJson)
  const spiceString = spiceNetlist.toSpiceString()

  expect(spiceString).toMatchInlineSnapshot(`
    "* Circuit JSON to SPICE Netlist
    RR1 N1 N2 1K
    CC1 N1 N3 1U
    .END"
  `)
})
