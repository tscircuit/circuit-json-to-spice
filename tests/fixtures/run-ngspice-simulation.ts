import { createNgspiceSpiceEngine } from "@tscircuit/ngspice-spice-engine"

try {
  const engine = await createNgspiceSpiceEngine()
  const result = await engine.simulate(await Bun.stdin.text())
  console.log(JSON.stringify(result))
} catch (error) {
  console.log(
    JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
    }),
  )
}
process.exit(0)
