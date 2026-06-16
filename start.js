import { pathToFileURL } from 'url';
import { register } from 'node:module';
register('tsx', pathToFileURL('./'));
import('./src/index.ts');
