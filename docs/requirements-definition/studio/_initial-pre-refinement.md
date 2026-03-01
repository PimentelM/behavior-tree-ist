> Historical draft (pre-refinement).  
> This document is kept for context only and is not the source of truth for V1 planning.  
> Use `docs/requirements-definition/studio/formal-specs-for-v1.md` for the active V1 specification.

## Requirements definition of Behavior Tree Studio

Behavior Tree Studio is an application designed to allow users to observe and debug the execution of behavior trees in real time.

This app is part of the behavior-tree-ist behavior tree library and it is built around a main Single Page Application component in react. 

The goal of this component being published as a standalone component is so users can make their own integrations with it in the way that they want, but Behavior Tree Studio provides a default standalone implementation that can integrate with any behavior tree written using the library.

The goal of the studio is to facilitate the connection between the user and a remote behavior tree running in a separate device or process.

For the debugger component to display data it only needs a serialized version of the tree and a list of tick events. The goal of the studio is to provide means of obtaining that information from the source and passing it down to the component in real time.


### Desired capbilities

The studio should have the capbility of listing clients registered in the server and see the trees available in that client. If a client is not online (not sending heartbeats to the server) we should still be able to see the persisted last version of the tree and the events recorded. 

A protocol for communication between the agents and the studio should be stablished. This protocol should support request-response type of commands that the studio-server may send to the client to request for information. The protocol should be optimized for communication between server and client taking in account that we want to minimize cpu time spent by the client to handle the sending of events, which will happen very often. (In a game for example, we can create a tick record containing hundreds of events every frame, 60 times per second, and we don't want to affect frame-rates at all even for very big behavior trees)

The protocol should be transport agnostic and we will support by default raw tcp ip connections and Websocket connections. the core implementations should be abstracted from the transport details and we should provide an easy way for the user to use either a standard known javascript websocket client or TCP socket or use their own implementation (example: when running inside constrained environments such as the frida-gum runtime). Some clients may not have access to nodejs Socket or Websocket so we need to provide an interface that the user can implement so we can interop with their own socket or websocket, that should be done while supporting standard clients//servers canonically.

It should be possible to remotely turn on and off the streaming of events from a client to the server while the client is connected to the server. 
If we turn it on, the agent will continuously send his tick events to the server even if the studio UI is not open and this setting will persist during the lifetime of the agent.
If we turn it off however, the client will not send events even if the UI is open, requiring a manual press of a button to enable the sending of events again, either persistently or during that session.

####  Server 

A list of TickRecords (the object produced by a BehaviorTree every tick) should be persisted in the server, either in-memory or in a SQLite database. Initially we want to do it in-memory using a ring buffer but we can eventually consider adding SQLite support, not planned for the initial version.

The server should also cache the last known serialized version of the tree so the UI can fetch that along with the persisted TickRecords even after the client has disconneced.

The server should also persist the known clients by ID ( each client will send a unique identifier when requesting connection )

From the UI it should be possible to query the server for:

- List of clients
- List of trees of a client
- Last N TickRecords stored for a tree of a client
- Serialized version of a tree by clientId and treeId

### Client ( place where the behavior tree will run )

A set of classes should be created in the core library to support integration with the studio-server.

They should be all free of external dependencies, simple to use, and lift off from the user all the weight of setting up the integration.

There should be a class named TreeRegistry whose instance will be used by the client to register the instances of all the trees in his codebase. When registering a tree it should have a unique name so each tree in the local registry can be identified by this name.

A class called StudioAgent will then receive the instance of tree registry as a dependency and it will perform all the wiring required to make sure that each tick of a tree in the registry will be sent to the server.

Implementation of the wiring details should preferabily be event-driven, for example, BehaviorTree will implement a `onTickRecord((tickRecord)=> void): OffFunction` method that the registry can use. The Registry will implement methods such as `onTreeRegistered(...): OffFunction` and `onTreeRemoved(...)` for the agent to use and so on.


The StudioAgent will be responsible for managing connection, connection retry, sending of data, etc. everything will be done by it. Auxiliary classes can be created to act as internal dependencies of the StudioAgent if proper separation of concerns is required to achieve the agent's goal with good code quality.


As a dependency of StudioAgent, the user will also need to provide an instance of a class that implements the transport interface, this interface should have connection related methods and methods related to sending and receiving messages. It should preferably map well to common interfaces used in weboscket or socket libraries in the Typescript ecosystem.


The StudioAgent should not make use of setInterval or any other timer based function internally, it should be driven by user provided ticks. (Once the StudioAgent instance is created, the user should periodically call .tick({now}) on the instance using his prefered method). Internally the instance will use that tick to perform the necessary operations that would traditionally require a setInterval (e.g: flusing acumulated tick records to the server, or retrying to connect to the server).

The tick will not be needed for the agent to handle or to respond to server messages once it is already connected.

For users that can make use of standard nodejs or browser libraries, ready-to-use transport clients will be available in a separate package published to npm.

Initially clients will only connect to the server, but eventually we will want to support the capbility of having clients listening on a specific ip address and port and have the server be the one attempting to connect to them (we will have connection details saved in the server for that).


All the work done by the StudioAgent inside the client should be as lightweight as possible in terms of cpu usage, in such a way that we should be economic even on validations. Since we don't allow external libraries in the client we will also not be able to define schemas using Zod for example (which is something available to be used in the server and ui).

The StudioAgent should be very stable and properly handle disconnections and other issues that might occur naturally.

Memory footprint should stay relatively low, the client should not have a big RingBuffer locally when compared to what the server would keep.

### Server ( the intermediary nodejs app )

The main goal of the server is to act as a persistent gateway between clients and the UI.

The server should persist all the information received from clients and all the configuration specified by the UI.

All communication between server and client will be message based and we can make request-response primitives o top of that.


Communication between UI and server can be either message based or request response based. The most appropriate method should be used for each specific usecase. (e.g: It should be good to have tRPC or http endpoints available to serve the stored information all the time, so we could even curl it)

The server can make use of external dependencies such as the library Zod, tRPC, 'ws' client, etc.


The server should store:

- Clients (connected clients or persisted ones)
- Trees (last version of the tree initially, but eventually we might come up with a versioning system)
- TickRecords ( when tree versioning is introduced we might want to be able to distinguish between versions of the same tree )
- Configurations of any kind ( Set by the UI )



Initially the server can be fully in-memory but the goal is to eventually allow it to use SQLLite to fully persist information when that becomes desirable.

The server should be fully type-safe and use a onion architecture composed of three main layers


##### App Layer
Handles integration with the external world via request or event handlers. 
If periodic jobs are needed, they are also defined here.

##### Domain Layer
Here is all the raw transport agnostic code lives, all the service logic that is not specific to a certain supporting technology is written here.

The app layer should call the domain layer for most operations that require logic.

The domain will have the ownership of interfaces that will be implemented both by the App Layer and the Infrastructure Layer

In the domain we should be able to define our own domain events and domain errors if necessary so it becomes fully independent from the other layers while keeping ownership of all the business logic.

##### Infrastructure Layer

Here is where we implement interfaces to interact with external things from the domain, for example, it is where we implement repository interfaces to interact with SQLite, or interfaces to interact with some external http API, etc.


### Web UI -- Studio

The studio UI components will be defined as an integral part of the react component present in `packages/react`. The features will be fully integrated in the component and the responsability of the `packages/studio` package is to wire that component with the logic required to connect to the server, handle connection, handle subscription to stream of update events, make requests, etc.

The studio should fully manage websocket connection to the server, subscriptions, event handling, etc.

We will wire the studio package with the component by using props. The main react component should stay in such a way that any user could for instance import the react component on their own admin panel or internal system and do the wiring themselves in the way that they want.

Changes to the component should have that in mind, we should do it in such a way that clients will still have the option to make their own implementation of the studio integrated with their systems but without compromising the interfaces with details that are too specific to our implementation of the studio.

This means that protocol and other lower level concerns should be abstracted away from the component.


----

We should have a prop that will allow the user to display a header on top of the debugger component (still rendered inside the component) that will contain the title 'Behavior Tree Studio', this header should have its theme synced with the theme choosen in the menu.


New controls should be added to the UI to manage the notion of attaching to a client and selecting a tree from a list.

In order to choose which client we want to connect to, preferably we should click on a 'Attach button' and it will open a side drawer window that will allow us to select the client from a list or something like that, so we don't need to always display the dropdown for the list of clients in the toolbar.

It should be possible to control a few settings on the agents from the UI remotely, most notably we should be able to remotely enable or disable tracing of state and profiling. These should be controlled by little buttons on the toolbar that we can click to toggle on or off (while active they should have a visual indicator, like in the little button we use to enable or disable the display window of activity)

These actions should be translated into commands sent to the server and forwarded to the attached client, they should target only the BehaviorTree instance that we selected in the UI. They will be persistent until the client restart or we manually revert them. It should be possible to query the state of such settings from the server and UI.


We should also have a little settings button we can click to open a settings window where we can specify server settings, such as the size of the buffer (in TickRecords) that the server will store per tree.
All server related settings should be in this window//panel and they are persisted by the server and made available for fetching so the UI can always be up to date.

In general we want to keep server and client specific UI in a separated window//panel drawer that we can open by clicking on a button of the toolbar, and tree specific controllers should appear directly in the toolbar, being them things that affect only the UI (such as the activity view toggle button) or things that affect the client (the toggling of state trace or profiling information in the events).


Controls that would only work with the studio mode is wired//enabled should not be rendered outside of the studio mode. ( A user should still be able to pass a serialized tree + list of TickRecords directly to the component and see it rendered )


We should adapt the component to: 

- Allow rendering even when there is no serialized tree or list of tick records.
- Have a visual indicator to show if the client we are attached to is online // offline
- Have a visual indicator to show if we are seeing a live tree that is being updated live or if we are seeing old persisted tick records (that were persisted by the server and servd to us via api call)


All controllers and visual style of the component should stay consistent after we add these new features and controllers.


We should persist some information in the localSession (or locaStorage if needed) in such a way that if we refresh the page we go back to the same client and tree we had selected (given that they are still available in the list that we fetch from the server). 

Only store minimal data in localStorage//localSession and properly handle any issues that could rise from using this stored data (e.g: local settings version changes, or stale data, etc.)

We should properly handle server disconnections or restarts or wipes.


**Important:** We should heavily consider if we should use pooling for the events instead of using websocket connection with a stream of TickRecords (even though we can use it for other things). The main reason for that would be for UI stability and control (the UI would be able to periodically ask the server for all the tick records after tick number N). This pool period could be configured in the UI itself (e.g: 200ms or 500ms).

Careful analisys should be done to decide which method to use to sync the UI in real time. In any case, it should still be possible to set the rate at which the UI will process batches of tick records (to avoid rendering issues with very fast tick rates). The default processing rate should be of 200ms and it should be configurable in the UI settings panel//window.


## Products

As a final result from this endeavor we would like to have:


1- A npm-publishable package at `package/studio` that would allow a user to invoke a npx command to download and run a command line tool that will serve both the studio-server and the UI. User should be able to configure at which port and ip address the server will bind to.

2- User would be able to specify a --demo param to make the CLI also spawn a nodejs process that will simulate a client connecting to the server and running the `heavy-profiler-demo-tree`

3- The CLI should be extremamly responsive and sending a Ctrl + C signal should promptly terminate gracefully the studio-server, kill the UI server, and kill the mock agent if one was spawned with --demo

4- A packages/transport will be created for ready-to-use transport solutions (if necessary)

5- A packages/studio-common will be created for common dependencies between studio-server and studio-ui that cannot go into /core



---

For development, yarn:dev should spawn both the studio-ui server, studio-server server and mock agent, all with hot reload. we can maybe use `concurrently` to do that.

