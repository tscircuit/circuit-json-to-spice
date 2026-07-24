import type { SourceNet, SourcePort } from "circuit-json"

export type SourcePortOrNetId =
  | SourcePort["source_port_id"]
  | SourceNet["source_net_id"]

export type ConnectivityNetId = string
export type SpiceNodeName = string

export type SourcePortOrNetIdToSpiceNodeNameMap = Map<
  SourcePortOrNetId,
  SpiceNodeName
>
