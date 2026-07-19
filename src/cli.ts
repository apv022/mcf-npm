#!/usr/bin/env node
import { createRequire } from 'node:module';
import { Command } from 'commander';
import { compile } from './compiler.js';
import { ValidationError } from './model.js';
import { parseCourse } from './parser.js';

const require = createRequire(import.meta.url);
const packageJson = require('../../package.json') as { version: string };
const program = new Command()
  .name('mcf')
  .description('Compile MCF 1.0 courses into static offline readers')
  .version(packageJson.version);
function fail(error: unknown): never {
  if (error instanceof ValidationError) console.error(error.message);
  else console.error(`Error: ${(error as Error).message}`);
  process.exit(1);
}
program
  .command('validate')
  .argument('<course>', 'MCF course directory')
  .action(async (course) => {
    try {
      const parsed = await parseCourse(course);
      console.log(`Valid MCF 1.0 course: ${parsed.title} (${parsed.id})`);
    } catch (error) {
      fail(error);
    }
  });
program
  .command('compile')
  .argument('<course>', 'MCF course directory')
  .option('-o, --output <directory>', 'course library output', 'courses')
  .action(async (course, options) => {
    try {
      const result = await compile(course, options.output);
      console.log(`Compiled ${result.course.title} to ${result.directory}`);
    } catch (error) {
      fail(error);
    }
  });
await program.parseAsync();
