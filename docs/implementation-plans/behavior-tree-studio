## Implementation plan of Behavior Tree Studio

Behavior Tree Studio is an application designed to allow users to observe and debug the execution of behavior trees in real time.

This app is part of the behavior-tree-ist behavior tree library and it is built around a main Single Page Application component in react. 

The goal of this component being published as a standalone component is so users can make their own integrations with it in the way that they want, but Behavior Tree Studio provides a default standalone implementation that can integrate with any behavior tree written using the library.


The goal of the studio is to facilitate the connection between the user and a remote behavior tree running in a separate device.

For the debugger component to display data it only needs a serialized version of the tree and a list of tick events. The goal of the studio is to provide means of obtaining that information from the source and passing it down to the component in real time.


### Desired capbilities

The studio should have the ability to both listen on a certain port (at interface 0.0.0.0) for agents to connect and should also allow the user to specify an IP address and port to connect to. Both modes have to be fully supported.

A protocol for communication between the agents and the studio should be stablished. This protocol should support request-response type of commands that the studio may issue to request for a serialized version of the tree or for a list of tree names that the client will register locally.

The protocol should be transport agnostic and we will support by default raw tcp ip connections and Websocket connections. the core implementations should be abstracted from the transport details and we should provide an easy way for the user to use either. Some clients may not have access to nodejs Socket or Websocket so we need to provide an interface that the user can implement so we can interop with their own socket or websocket, that should be done while supporting standard clients//servers canonically.

Since support for different kinds of transport should be available, the studio will have both a frontend component and a server component meant to run locally. When using the studio the user will run a command to spawn the server and the link of the UI will be provided. The server should be a simple nodejs application written in plain Typescript.


### Client ( place where the behavior tree will run )

A class should be created in the /core library that the client can use to register the trees he want to appear in a list. This should be called TreeRegistry (or BehaviorTreeRegistry).

When creating instances of BehaviorTree the user will have the option to register this tree in the registry and specify a name and optionally a description.

The registry should be part of a sub export of the library (like /tsx /builder) that will contain things related to integrating the client with the studio.

A class should be made to manage the communication protocol and handling commands.

A class should be made to, in the most performatic way, acumulate and batch TickRecords to be sent over the wire. We should minimize cpu time spent in this part the most we can. A suggestion is to use something similar to tabular json, but we can even strip headers and make an interface or contract between server and client in such a way that we can send arrays of fields and they will be properly decoded in the respective object formats.
Given that the client is able to define arbitrary json for node states, we should be mindful about how decide to serialize our data. We might decide to use NDJSON or simply use pure json in case we observe great risks or complications in trying other formats.
We should optimize towards minimizing cpu time spent on the client and not for network, since the intended usage of the studio is to be used in local area network.

Interfaces should be made for the client in case he wants to use a custom socket or websocket implementation in such a way that he can wrap his own client or server to be plugged in the library. the library should support standard nodejs and browser transports.

The user can choose between listening on a port or trying to periodically connect to a server (in a cpu lightweight way).

The core library should remain free of external dependencies, for custom transports we might want to put them in a separated package on the monorepo.


### Server ( the intermediary nodejs app )


The main role of this server is to act as an intermediary between client and UI since Web UI cannot connect to or listen on TCP ports directly.

It will also act as a buffer that will acumulate tick events up to a certain amount and allow the UI to refresh without losing already buffered state.

The server should do little processing, it will only receive data to store, offer that data via http endpoints (or tRPC if we judge worth it), and manage connections in general.

Ideally the implementation should be fully type safe and we should have some degree of validation for requests using Zod

Authentication is initially not required since this tool is meant to be used locally. It should be designed in such a way that it will not pose a security risk if bad actors can connect to it, if that is not possible we should add a very simple and cheap authentication mechanism.


### Web UI -- Studio


Will allow the user to select transport, and mode of operation. in listen mode it will be able to select a connected client and attach to it.


When attached to a client, we should be able to list the trees that the client have and select which one we want to visualize and subscribe to the events.


We should be able to send commands to enable or disable traceState and profiling for each tree individually or for all treees.


The studio UI should be written inside the debugger component, the app exposed in the studio package will just properly wire to the component, but the UI should be part of the component and optional ( users could use the component only by feeding the serialized tree + events, completely ignoring the fact that the studio UI can be enabled)


The studio specific UI will appear right on top of the main debugger view and the controls and displays should all fit this "header".


Styling will be consistent between the studio UI and the debugger view.


Refreshing the page will lead back to the same state it was before given that the UI will fetch the data representing UI state from the server.


A heartbeat mechanism should exist between Web UI and server in such a way that the server will ask the client to stop sending data and revert back the state of the trees (config wise, like traceState and profiling) to their original values if the UI stops sending heartbeat.



---


### Considerations

In order to avoid a huge amount of frequent updates to the UI for trees that operate at a high tick rate, we should do some very small batching before a payload is sent from the server to the UI (This can be done anywhere really, we can even allow server to send in real time and throttle render update on the UI)

Something like 200ms between UI updates from new ticks is ideal. we can allow this value to be configurable.