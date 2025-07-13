import { Simulation } from "eecircuit-engine"
import { readFileSync } from "fs"

const spice = readFileSync(0, "utf8")

;(async () => {
  const sim = new Simulation()
  await sim.start()
  sim.setNetList(spice)
  const result = await sim.runSim()
  console.log(JSON.stringify(result))
})()
