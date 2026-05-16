export const commandRegistry = [
  { usage: 'lm init', description: 'Initialize platform and project paths' },
  { usage: 'lm build server', description: 'Pull and build the server project' },
  { usage: 'lm build web', description: 'Pull and build the web project' },
  { usage: 'lm build admin', description: 'Pull and build the admin project' },
  { usage: 'lm build', description: 'Build server, web, and admin in order' },
  { usage: 'lm help', description: 'Show usage help' },
];

export function buildHelpText(commands = commandRegistry) {
  return commands
    .map((command) => `${command.usage} - ${command.description}`)
    .join('\n');
}
