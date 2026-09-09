import type { SpiceNodeName } from "./spice-node-map"

function toSafeNodeName(name: string): SpiceNodeName {
  // Use a conservative identifier alphabet; display labels stay in metadata.
  return name.replace(/[^A-Za-z0-9_]/g, "_") || "probe"
}

export function createSpiceNodeNameAllocator(preferredNames: Iterable<string>) {
  const reservedNames = new Set(
    Array.from(preferredNames, (name) => toSafeNodeName(name).toLowerCase()),
  )
  // ngspice treats node names case-insensitively and aliases gnd to node 0.
  const usedNames = new Set<SpiceNodeName>(["0", "gnd"])

  return (preferredName: SpiceNodeName): SpiceNodeName => {
    const safePreferredName = toSafeNodeName(preferredName)
    const stem = ["0", "gnd"].includes(safePreferredName.toLowerCase())
      ? `probe_${safePreferredName}`
      : safePreferredName
    let name = stem
    let suffix = 2
    while (
      usedNames.has(name.toLowerCase()) ||
      (name !== safePreferredName && reservedNames.has(name.toLowerCase()))
    ) {
      name = `${stem}_${suffix++}`
    }
    usedNames.add(name.toLowerCase())
    return name
  }
}
