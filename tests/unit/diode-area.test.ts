import { expect, test } from "bun:test"
import { DiodeCommand } from "lib/spice-commands/DiodeCommand"
import { Simulation } from "eecircuit-engine"

if (!WebAssembly.instantiateStreaming) {
  WebAssembly.instantiateStreaming = async (
    source: Response | PromiseLike<Response>,
    importObject?: WebAssembly.Imports,
  ): Promise<WebAssembly.WebAssemblyInstantiatedSource> => {
    const response = await source
    return WebAssembly.instantiate(await response.arrayBuffer(), importObject)
  }
}

test("DiodeCommand emits the area as an AREA= keyword", () => {
  const diode = new DiodeCommand({
    name: "D1",
    positiveNode: "N1",
    negativeNode: "0",
    model: "DMOD",
    area: "2",
  })

  // ngspice parses the token after the model name as a second model name,
  // so a positional area makes it reject the element with
  // "could not find a valid modelname"
  expect(diode.toSpiceString()).toBe("DD1 N1 0 DMOD AREA=2")
})

test("DiodeCommand omits AREA when no area is provided", () => {
  const diode = new DiodeCommand({
    name: "D1",
    positiveNode: "N1",
    negativeNode: "0",
    model: "DMOD",
  })

  expect(diode.toSpiceString()).toBe("DD1 N1 0 DMOD")
})

test("emitted diode element parses and simulates in ngspice", async () => {
  const diode = new DiodeCommand({
    name: "D1",
    positiveNode: "a",
    negativeNode: "b",
    model: "DMOD",
    area: "2",
  })

  const netlist = [
    "diode area",
    "V1 a 0 1",
    diode.toSpiceString(),
    "R1 b 0 1k",
    ".model DMOD D",
    ".op",
    ".END",
  ].join("\n")

  const sim = new Simulation()
  await sim.start()
  sim.setNetList(netlist)
  const result = await sim.runSim()
  expect(result.numVariables).toBeGreaterThan(0)
  const vb = result.data.find(
    (entry: { name: string }) => entry.name.toLowerCase() === "v(b)",
  )
  expect(vb).toBeDefined()
  // AREA=2 scales the junction current, so the forward drop and the
  // resistor voltage differ from the default-area diode (v(b) ~= 0.37)
  expect(vb?.values?.[0]).toBeCloseTo(0.387, 2)
})
