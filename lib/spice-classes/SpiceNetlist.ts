import { convertSpiceNetlistToString } from "../spice-utils/convertSpiceNetlistToString"
import type { SpiceComponent } from "./SpiceComponent"

export class SpiceNetlist {
  title: string
  components: SpiceComponent[]
  nodes: Set<string>

  constructor(title = "Circuit Netlist") {
    this.title = title
    this.components = []
    this.nodes = new Set()
  }

  addComponent(component: SpiceComponent) {
    this.components.push(component)
    // Add nodes to the set
    for (const node of component.nodes) {
      this.nodes.add(node)
    }
  }

  toSpiceString() {
    return convertSpiceNetlistToString(this)
  }
}
