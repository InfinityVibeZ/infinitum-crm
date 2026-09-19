process.env.TS_NODE_PROJECT = 'tsconfig.test.json';
require('ts-node/register/transpile-only');
require('tsconfig-paths/register');
require('../src/realtime/main.ts');
