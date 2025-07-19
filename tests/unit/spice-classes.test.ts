import { test, expect } from "bun:test"
import { SpiceNetlist } from "lib/spice-classes/SpiceNetlist"
import { SpiceComponent } from "lib/spice-classes/SpiceComponent"
import { ResistorCommand } from "lib/spice-commands/ResistorCommand"
import { CapacitorCommand } from "lib/spice-commands/CapacitorCommand"

test("SpiceNetlist basic functionality", () => {
  const netlist = new SpiceNetlist("Test Netlist")

  expect(netlist.title).toBe("Test Netlist")
  expect(netlist.components).toHaveLength(0)
  expect(netlist.nodes.size).toBe(0)
})

test("SpiceNetlist with components", () => {
  const netlist = new SpiceNetlist("Test Circuit")

  const resistorCmd = new ResistorCommand({
    name: "R1",
    positiveNode: "N1",
    negativeNode: "N2",
    value: "1K",
  })

  const resistorComponent = new SpiceComponent("R1", resistorCmd, ["N1", "N2"])
  netlist.addComponent(resistorComponent)

  expect(netlist.components).toHaveLength(1)
  expect(netlist.nodes.has("N1")).toBe(true)
  expect(netlist.nodes.has("N2")).toBe(true)
  expect(netlist.nodes.size).toBe(2)
})

test("ResistorCommand SPICE string generation", () => {
  const resistor = new ResistorCommand({
    name: "R1",
    positiveNode: "N1",
    negativeNode: "N2",
    value: "1K",
  })

  expect(resistor.toSpiceString()).toBe("RR1 N1 N2 1K")
})

test("CapacitorCommand SPICE string generation", () => {
  const capacitor = new CapacitorCommand({
    name: "C1",
    positiveNode: "N1",
    negativeNode: "N2",
    value: "100nF",
  })

  expect(capacitor.toSpiceString()).toBe("CC1 N1 N2 100nF")
})

test("SpiceNetlist toSpiceString", () => {
  const netlist = new SpiceNetlist("RC Circuit")

  const resistorCmd = new ResistorCommand({
    name: "R1",
    positiveNode: "N1",
    negativeNode: "N2",
    value: "1K",
  })

  const capacitorCmd = new CapacitorCommand({
    name: "C1",
    positiveNode: "N2",
    negativeNode: "0",
    value: "100nF",
  })

  netlist.addComponent(new SpiceComponent("R1", resistorCmd, ["N1", "N2"]))
  netlist.addComponent(new SpiceComponent("C1", capacitorCmd, ["N2", "0"]))

  const spiceString = netlist.toSpiceString()

  expect(spiceString).toMatchInlineSnapshot(`
    "RC Circuit
    RR1 N1 N2 1K
    CC1 N2 0 100nF
    .END"
  `)
})
