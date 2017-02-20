# eslint-canary [![Build Status](https://travis-ci.org/eslint/eslint-canary.svg?branch=master)](https://travis-ci.org/not-an-aardvark/eslint-canary)

(WIP) Regression build for [ESLint](https://github.com/eslint/eslint)

`eslint-canary` clones a hardcoded list of projects known to use ESLint, and runs ESLint on all of them to ensure that no errors are reported. This is intended to catch regressions in ESLint that are missed by ESLint's unit tests.

## Usage

```
$ npm install eslint-canary -g
$ eslint-canary path/to/package/folder/containing/eslint
```

## Adding your project

To add your project to the regression build, make a PR to `projects.yml`.

## Development

```bash
$ git clone https://github.com/not-an-aardvark/eslint-canary
$ cd eslint-canary
$ npm install
$ npm test
```
