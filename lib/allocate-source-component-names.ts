import type { SourceComponentBase } from "circuit-json"
import { sanitizeIdentifier } from "./processors/helpers"

// Match the prefixes emitted by the source-component processors. Diodes and
// LEDs share a SPICE namespace; e.g. a resistor and capacitor named "1" do not.
const spicePrefixes = new Map([
  ["simple_resistor", "R"],
  ["simple_capacitor", "C"],
  ["simple_inductor", "L"],
  ["simple_diode", "D"],
  ["simple_led", "D"],
  ["simple_mosfet", "M"],
  ["simple_transistor", "Q"],
  ["simple_switch", "S"],
])

/**
 * Flatten module-local reference names without producing duplicate devices.
 * Keep Circuit JSON IDs and input objects intact: ports and simulation records
 * still refer to their original source_component_id, not the allocated name.
 */
export function allocateSourceComponentNames<T extends SourceComponentBase>(
  components: T[],
  options: {
    reservedVoltageSourceNames?: Iterable<string>
    reservedNodeNames?: Iterable<string>
  } = {},
): T[] {
  const preferredNames = components.map((component) => {
    const prefix = spicePrefixes.get(component.ftype ?? "")
    if (!prefix) return undefined
    const name =
      component.ftype === "simple_switch"
        ? sanitizeIdentifier(
            component.name ?? component.source_component_id,
            "SW",
          )
        : component.name
    return { prefix, name }
  })
  const key = (prefix: string, name: string) => `${prefix}${name}`.toLowerCase()
  // Reserve explicit names before allocating suffixes so an R1 collision cannot
  // take the name of a later, otherwise unique R1_2 component.
  const reserved = new Set(
    preferredNames.flatMap((entry) =>
      entry ? [key(entry.prefix, entry.name)] : [],
    ),
  )
  const used = new Set<string>()
  const controlSourceNames = new Set(
    [...(options.reservedVoltageSourceNames ?? [])].map((name) =>
      name.toLowerCase(),
    ),
  )
  const controlNodeNames = new Set(
    [...(options.reservedNodeNames ?? [])].map((name) => name.toLowerCase()),
  )

  return components.map((component, index) => {
    const preferred = preferredNames[index]
    if (!preferred) return component
    const isSwitch = component.ftype === "simple_switch"
    const conflicts = (name: string) =>
      used.has(key(preferred.prefix, name)) ||
      (isSwitch &&
        (controlSourceNames.has(`vctrl_${name}`.toLowerCase()) ||
          controlNodeNames.has(`nctrl_${name}`.toLowerCase())))
    let name = preferred.name
    if (conflicts(name)) {
      let suffix = 2
      do {
        name = `${preferred.name}_${suffix++}`
      } while (conflicts(name) || reserved.has(key(preferred.prefix, name)))
    }
    used.add(key(preferred.prefix, name))
    if (isSwitch) {
      controlSourceNames.add(`vctrl_${name}`.toLowerCase())
      controlNodeNames.add(`nctrl_${name}`.toLowerCase())
    }
    return name === component.name ? component : { ...component, name }
  })
}
