import { defineCommand, runMain } from 'citty'
import { demoCommand } from './commands/demo.js'

const main = defineCommand({
  meta: {
    name: 'bt-studio',
    description: 'Behavior Tree Studio CLI',
  },
  subCommands: {
    demo: demoCommand,
  },
})

runMain(main)
