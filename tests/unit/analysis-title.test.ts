import assert from "node:assert/strict"
import { test } from "node:test"
import { SpiceNetlist } from "../../lib/spice-classes/SpiceNetlist.ts"
import { SpiceComponent } from "../../lib/spice-classes/SpiceComponent.ts"
import { ResistorCommand } from "../../lib/spice-commands/ResistorCommand.ts"

for (const [title, analysis] of [
  [".tran step response", ".tran 1n 1u"],
  [".OP amplifier bias", ".op"],
  [".Ac frequency response", ".ac dec 10 1 1meg"],
  ["  .dC sweep experiment", ".dc V1 0 5 0.1"],
  ["RC circuit", ".tran 1n 1u"],
  [".transient response", ".tran 1n 1u"],
  ["", ".tran 1n 1u"],
  ["\t .OP\t bias", "  .op  "],
] as const) {
  test(`title ${JSON.stringify(title)} does not replace the analysis directive`, () => {
    const netlist = new SpiceNetlist(title)
    netlist.analysisCommand = analysis
    netlist.addComponent(
      new SpiceComponent(
        "load",
        new ResistorCommand({
          name: "load",
          positiveNode: "in",
          negativeNode: "0",
          value: "1k",
        }),
        ["in", "0"],
      ),
    )
    assert.equal(
      netlist.toSpiceString(),
      [title, "Rload in 0 1k", analysis, ".END"].join("\n"),
    )
  })
}

for (const [title, analysis, existing] of [
  [".tran step response", ".tran 1n 1u", ".TRAN 2n 2u"],
  [".OP amplifier bias", ".op", "  .OP  "],
  ["AC test", ".ac dec 10 1 1meg", ".Ac lin 2 1 10"],
  ["DC test", ".dc V1 0 5 0.1", ".DC V1 0 1 0.1"],
] as const) {
  test(`existing ${existing} body directive still wins`, () => {
    const netlist = new SpiceNetlist(title)
    netlist.analysisCommand = analysis
    netlist.addComponent(
      new SpiceComponent("analysis", { toSpiceString: () => existing }, []),
    )
    assert.equal(netlist.toSpiceString(), [title, existing, ".END"].join("\n"))
  })
}

test("a directive-like title alone does not enable an analysis", () => {
  const netlist = new SpiceNetlist(".op experiment")
  assert.equal(netlist.toSpiceString(), ".op experiment\n.END")
})

test("the legacy tranCommand setter also retains a real analysis after the title", () => {
  const netlist = new SpiceNetlist(".TRAN pulse response")
  netlist.tranCommand = ".tran 1n 1u"
  assert.equal(netlist.tranCommand, ".tran 1n 1u")
  assert.equal(
    netlist.toSpiceString(),
    ".TRAN pulse response\n.tran 1n 1u\n.END",
  )
})

test("a component with a different analysis does not suppress the requested analysis", () => {
  const netlist = new SpiceNetlist(".tran step response")
  netlist.analysisCommand = ".tran 1n 1u"
  netlist.addComponent(
    new SpiceComponent("operating_point", { toSpiceString: () => ".op" }, []),
  )
  assert.equal(
    netlist.toSpiceString(),
    ".tran step response\n.op\n.tran 1n 1u\n.END",
  )
})
