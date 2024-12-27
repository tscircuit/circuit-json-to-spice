import { convertSpiceNetlistToString } from "../spice-utils/convertSpiceNetlistToString"

export class SpiceNetlist {
  title?: string

  toSpiceString() {
    return convertSpiceNetlistToString(this)
  }
}
