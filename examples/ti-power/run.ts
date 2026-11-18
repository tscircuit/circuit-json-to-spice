import { createNgspiceSpiceEngine } from "@tscircuit/ngspice-spice-engine"
import { join } from "node:path"
import { bundleTiModels } from "./ti-models"

const cases: Record<string, Record<string, number>> = {
  linear: { out: 2.8 },
  buck: { out: 3.3 },
  "power-tree": { v12: 12, v5: 5, v1v2: 1.2, v1v8: 1.8 },
}
const selected = process.argv[2] ?? "all"
const selectedCases = selected === "all" ? Object.keys(cases) : [selected]

if (!process.argv.includes("--child")) {
  for (const name of selectedCases) {
    if (!cases[name]) throw new Error(`Unknown simulation: ${name}`)
    const child = Bun.spawn(
      [process.execPath, import.meta.path, name, "--child"],
      {
        stdout: "inherit",
        stderr: "inherit",
        timeout: 600_000,
      },
    )
    const exitCode = await child.exited
    if (exitCode) {
      process.exitCode = 1
      const failure = {
        simulation: name,
        passed: false,
        exitCode,
        signal: child.signalCode,
        message: "Simulation failed or exceeded the ten-minute process limit.",
      }
      await Bun.write(
        join(import.meta.dir, "../../.cache/ti-power", `${name}.summary.json`),
        JSON.stringify(failure, null, 2),
      )
      console.error(JSON.stringify(failure, null, 2))
    }
  }
} else {
  const started = performance.now()
  const spice = await bundleTiModels(
    await Bun.file(join(import.meta.dir, `${selected}.cir`)).text(),
  )
  const outputPath = join(import.meta.dir, "../../.cache/ti-power", selected)
  await Bun.write(`${outputPath}.cir`, spice)
  const engine = await createNgspiceSpiceEngine()
  const { simulationResultCircuitJson } = await engine.simulate(spice)
  await Bun.write(
    `${outputPath}.circuit.json`,
    JSON.stringify(simulationResultCircuitJson),
  )
  const voltages = simulationResultCircuitJson
    .filter((graph) => graph.type === "simulation_transient_voltage_graph")
    .map((graph) => {
      const nominalVoltage = cases[selected][graph.name?.toLowerCase() ?? ""]
      const finalVoltage = graph.voltage_levels.at(-1)
      return {
        name: graph.name,
        nominalVoltage,
        finalVoltage,
        withinTwoPercent:
          finalVoltage !== undefined &&
          Number.isFinite(finalVoltage) &&
          nominalVoltage !== undefined &&
          Math.abs(finalVoltage - nominalVoltage) <= nominalVoltage * 0.02,
      }
    })
  const passed =
    voltages.length === Object.keys(cases[selected]).length &&
    voltages.every((voltage) => voltage.withinTwoPercent)
  const summary = {
    simulation: selected,
    seconds: (performance.now() - started) / 1000,
    passed,
    voltages,
  }
  await Bun.write(
    `${outputPath}.summary.json`,
    JSON.stringify(summary, null, 2),
  )
  console.log(JSON.stringify(summary, null, 2))
  process.exit(passed ? 0 : 1)
}
