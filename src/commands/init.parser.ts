import { Command } from 'commander';

export function setupInitParserProgram(): Command {
  const program = new Command();
  program
    .name('vivliostyle init')
    .description('create vivliostyle config file')
    .option('--title <title>', 'title')
    .option('--author <author>', 'author')
    .option('-l, --language <language>', 'language')
    .option('-s, --size  <size>', 'paper size')
    .option('-T, --theme <theme>', 'theme');
  return program;
}
