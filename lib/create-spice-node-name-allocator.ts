import type { SpiceNodeName } from "./spice-node-map"

export function createSpiceNodeNameAllocator(preferredNames: Iterable<string>) {
  const reservedNames = new Set(
    Array.from(preferredNames, (name) => name.toLowerCase()),
  )
  // ngspice treats node names case-insensitively and aliases gnd to node 0.
  const usedNames = new Set<SpiceNodeName>(["0", "gnd"])

  return (preferredName: SpiceNodeName): SpiceNodeName => {
    const stem = ["0", "gnd"].includes(preferredName.toLowerCase())
      ? `probe_${preferredName}`
      : preferredName
    let name = stem
    let suffix = 2
    while (
      usedNames.has(name.toLowerCase()) ||
      (name !== preferredName && reservedNames.has(name.toLowerCase()))
    ) {
      name = `${stem}_${suffix++}`
    }
    usedNames.add(name.toLowerCase())
    return name
  }
}
