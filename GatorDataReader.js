// Top-level re-export so `import ... from 'mascp-jstools/GatorDataReader'`
// resolves as a literal file under plain (non-"exports"-aware) module
// resolution — e.g. webpack 4, which never consults package.json's "exports"
// field — not just via the "./GatorDataReader" entry in that field for
// webpack 5/Node ESM consumers.
export { default } from './js/lib/GatorDataReader.js';
