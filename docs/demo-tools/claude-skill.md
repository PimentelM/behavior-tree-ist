## Claude Skill using Behavior Tree

We should create a claude skill that will act like tools such as 'auto claude', 'zeroshot', or the 'ralph-wiggum' plugin for claude.

The goal is that the user will ask for a certain feature, ticket or github issue to be implemented and the AI will:


0- Switch to an worktree and create a temporary folder on .claude/ that will contain the necessary folder structure and files for the skill to operate properly.


1- Run an agent that will do an initial exploration of the issue and raise points of uncertainty or questions. If any, the user will be prompted for clarification (We can optionally disable this clarification part). If this step is executed, an enriched request (more detailed with ambiguities clarified) will be forwared to step 2, if not the original request will go straight to step 2.


2- An agent will be spawned with the prompt and it will be instructed to create a thorough plan to implement the feature. This agent is allowed to spawn as many sub agents as it need to aind in the plan creation. The plan can be multi stepped (broke down in tasks).

Depending on the complexity of the task we should make multiple plan files, one for each step. 

Basically we should produce a temporary database of knowledge in the form of temporary markdown files, and markdown files repesenting a general plan and sub files with each step of the plan.

This is the most important part of all and the agent should not save on tokens, each agent and sub agent should be instructed to spawn as many sub agents as needed to reach this goal.

3- Here we enter the loop. We pick the next task that is not done, and ask for a worker to work on it giving him enough context or pointing to the place where he can get more context.

Once the worker finishes, we run static validations (lint, typecheck, tests), if not passing we go back to working mode asking the agent to fix what we found.

If passed, then we run a thorough reviewer agent that is also, as every other agent used in this skill, allowed to spawn as many sub agents as needed to validate that the task is done without bugs, issues, or other problemas. If not passing we go back again to work mode asking for the specific fixes.

We repeat this iteration until the task is done.

4- We then take the next task available and repeat 3 until all tasks are finished, then we return.


### Main differentiator


We can use the behavior tree library to coordinate certain aspects of this whole execution loop. Behavior tree libraries are by design something that run in a loop/tick. We can have a typescript script that will run on a while loop ticking the tree each 1 second.


We should research and find a way to properly integrate typescript code with the agents, this is, a way to interop between the agent from where we will be running the skill, the typescript script coordinating the behavior tree, and sub processes that we spawn of claude using the non-interactive mode (-p).

Prompts or code should be created to do this wiring so context can be delivered to the places it need to reach.



