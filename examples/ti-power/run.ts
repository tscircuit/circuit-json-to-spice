import {
  createNgspiceSpiceEngine,
  rewritePspiceCompatibilitySyntax,
} from "@tscircuit/ngspice-spice-engine"
import { join } from "node:path"
import { getVoltageSummary } from "./get-voltage-summary"
import { bundleTiModels } from "./ti-models"

const cases: Record<string, Record<string, number>> = {
  linear: { out: 2.8 },
  buck: { out: 3.3 },
  "power-tree": { v12: 12, v5: 5, v1v2: 1.2, v1v8: 1.8 },
  "desktop-linear": { vout: 2.8 },
  "desktop-linear-startup": { vout: 2.8 },
  "desktop-buck": { out: 3.3 },
  "desktop-buck-loadstep": { out: 3.3 },
  "desktop-buck-ripple": { out: 3.3 },
  "desktop-power-tree": { v12: 12, v5: 5, v1v2: 1.2, v1v8: 1.8 },
  "lmzm-startup": { v12: 12 },
  "desktop-3247-buck-startup": { n11: 3.3 },
  "desktop-3247-buck-loadstep": { n11: 3.3 },
}
const selected = process.argv[2] ?? "all"
const selectedCases =
  selected === "all" ? ["linear", "buck", "power-tree"] : [selected]

if (!process.argv.includes("--child")) {
  const timeoutMs = Number(process.env.TI_POWER_TIMEOUT_MS ?? 600_000)
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("TI_POWER_TIMEOUT_MS must be a positive number")
  }
  for (const name of selectedCases) {
    if (!cases[name]) throw new Error(`Unknown simulation: ${name}`)
    const summaryPath = join(
      import.meta.dir,
      "../../.cache/ti-power",
      `${name}.summary.json`,
    )
    await Bun.write(summaryPath, JSON.stringify({ completed: false }))
    const child = Bun.spawn(
      [process.execPath, import.meta.path, name, "--child"],
      {
        stdout: "inherit",
        stderr: "inherit",
        timeout: timeoutMs,
      },
    )
    const exitCode = await child.exited
    const summary: { completed?: boolean } = await Bun.file(summaryPath).json()
    if (exitCode !== 0 || child.signalCode || !summary.completed) {
      process.exitCode = 1
      if (summary.completed) continue
      const failure = {
        simulation: name,
        completed: false,
        passed: false,
        exitCode,
        signal: child.signalCode,
        message: "Simulation failed or exceeded the configured process limit.",
      }
      await Bun.write(summaryPath, JSON.stringify(failure, null, 2))
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
  await Bun.write(
    `${outputPath}.native.cir`,
    rewritePspiceCompatibilitySyntax(spice),
  )
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
      return getVoltageSummary({ graph, nominalVoltage })
    })
  const passed =
    voltages.length === Object.keys(cases[selected]).length &&
    voltages.every((voltage) => voltage.withinTwoPercent)
  const summary = {
    simulation: selected,
    completed: true,
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
