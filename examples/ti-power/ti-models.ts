import { join } from "node:path"
import { circuitJsonToSpice } from "lib/circuitJsonToSpice"
import { parseSpiceNetlist } from "spicets"

const tiModels: Record<
  string,
  { archive: string; member: string; sha256: string }
> = {
  TPS7A20: {
    archive: "sbvm961",
    member: "tps7a20-adj_trans.lib",
    sha256: "154acfdd2199ac44259908b90b07d15bc7e535a45c8c51d1413894c900718b69",
  },
  TPS54320: {
    archive: "slvm451",
    member: "TPS54320_PSPICE_TRANS/TPS54320_TRANS.lib",
    sha256: "b979024ddd6f8d158c5d5454985f74e4f8c97c75e6b9aedff1703bd0418a9268",
  },
  LMZM33602: {
    archive: "snvmbf8",
    member: "LMZM33602_PSPICE_TRANS/LMZM33602_TRANS.LIB",
    sha256: "5ae9dab0d0436314e3baf0434dc7094cf8e08f92e36c4d457cf2775b7ec8906d",
  },
  TPS82130: {
    archive: "slvmbg8",
    member: "TPS82130_PSPICE_TRANS/TPS82130_TRANS.LIB",
    sha256: "a4de8a550f1922343b188d899f61f0daa1539c3682781d7c5121f01cece0f9fa",
  },
  TPS82084: {
    archive: "slvmb39",
    member: "TPS82084_PSPICE_TRANS/TPS82084_TRANS.LIB",
    sha256: "be95a6b91f965682009124e923591d79179627407b07b5fd1dac4250f4ed9fc7",
  },
  TPS82085: {
    archive: "slvmat3",
    member: "TPS82085_PSPICE_TRANS/TPS82085_TRANS.LIB",
    sha256: "4cff06799539e8432cc2944e559c3a80be8b14150c746a0f593a1971b1ec156f",
  },
}

export const bundleTiModels = async (spice: string): Promise<string> => {
  let bundledSource = spice
  for (const include of spice.matchAll(/^\.include (\w+)$/gm)) {
    const part = include[1]
    const model = tiModels[part]
    if (!model) throw new Error(`Unknown TI model: ${part}`)
    const archivePath = join(
      import.meta.dir,
      "../../../.cache/ti-power",
      `${part}.zip`,
    )
    if (!(await Bun.file(archivePath).exists())) {
      const response = await fetch(
        `https://www.ti.com/lit/zip/${model.archive}`,
      )
      if (!response.ok)
        throw new Error(`Could not download ${part}: HTTP ${response.status}`)
      await Bun.write(archivePath, response)
    }
    const extraction = Bun.spawn(["unzip", "-p", archivePath, model.member])
    const libraryBytes = new Uint8Array(
      await new Response(extraction.stdout).arrayBuffer(),
    )
    if (await extraction.exited) throw new Error(`Could not extract ${part}`)
    const sha256 = new Bun.CryptoHasher("sha256")
      .update(libraryBytes)
      .digest("hex")
    if (sha256 !== model.sha256)
      throw new Error(`The downloaded ${part} model has changed`)
    const subcircuit_source = new TextDecoder().decode(libraryBytes)
    const entry = parseSpiceNetlist(subcircuit_source).subckts[0]
    if (!entry) throw new Error(`No subcircuit in ${part}`)

    // Exercise the exporter's model bundling while retaining the test bench's
    // explicit physical pin order and external component values.
    const netlist = circuitJsonToSpice([
      {
        type: "simulation_spice_subcircuit",
        simulation_spice_subcircuit_id: part,
        source_component_id: part,
        spice_pin_to_source_port_map: {},
        subcircuit_source,
      },
    ])
    const definition = [...netlist.models.entries()][0]
    if (!definition) throw new Error(`Could not export ${part}`)
    bundledSource = bundledSource.replace(include[0], () => definition[1])
    bundledSource = bundledSource.replace(
      new RegExp(`^(X[^\\r\\n]*\\s)${entry.name}(?=\\s|$)`, "gm"),
      (_, instance) => `${instance}${definition[0]}`,
    )
  }
  return bundledSource
}
