#!/usr/bin/env node

"use strict";

if (process.argv.length < 3) {
    console.log("Usage: node eslint-canary.js <eslint-folder-path>");
    process.exitCode = 1;
    return;
}

const fs = require("fs");
const childProcess = require("child_process");
const os = require("os");
const path = require("path");

const rimraf = require("rimraf");
const assert = require("chai").assert;
const eslintPath = path.resolve(process.cwd(), process.argv[2]);
const yaml = require("js-yaml");
const projects = yaml.safeLoad(fs.readFileSync("projects.yml", "utf8"));

/**
* Synchronously spawn a child process, and throw if it exits with an error
* @param {string} command The command to spawn
* @param {string[]} args Arguments for the command
* @returns {void}
*/
function spawn(command, args) {
    const result = childProcess.spawnSync(command, args);

    assert.strictEqual(result.status, 0, `The command '${command} ${args.join(" ")}' exited with an exit code of ${result.status}:\n\n${result.output[2].toString()}`);
}

/**
* Determines whether a particular dependency of a project should be installed
* @param {object} projectInfo The project information in the yml file
* @param {string} dependency The name of the dependency
* @returns {boolean} `true` if the dependency should be installed
*/
function shouldInstall(projectInfo, dependency) {
    return dependency.startsWith("eslint-config-") ||
        dependency.startsWith("eslint-plugin-") ||
        projectInfo.dependencies && projectInfo.dependencies.indexOf(dependency) !== -1;
}


require("./validate-projects");

projects.forEach(projectInfo => {
    process.chdir(os.tmpdir());

    if (fs.existsSync(projectInfo.name)) {
        rimraf.sync(projectInfo.name, { disableGlob: true });
    }

    console.log(`Cloning ${projectInfo.repo}`);
    spawn("git", ["clone", projectInfo.repo, "--single-branch", "--depth=1", projectInfo.name]);

    process.chdir(projectInfo.name);

    let npmInstallArgs = [];

    if (fs.existsSync("package.json")) {
        const packageFile = JSON.parse(fs.readFileSync("package.json", "utf8"));
        const dependencyVersions = Object.assign({}, packageFile.dependencies, packageFile.devDependencies);

        npmInstallArgs = Array.from(new Set(Object.keys(dependencyVersions).concat(projectInfo.dependencies || [])))
            .filter(dependency => shouldInstall(projectInfo, dependency))
            .map(dependency => dependencyVersions[dependency] ? `${dependency}@${dependencyVersions[dependency]}` : dependency);
    }

    console.log(`Installing dependencies for ${projectInfo.name}`);
    spawn("npm", ["install", "--ignore-scripts", eslintPath].concat(npmInstallArgs));

    console.log(`Linting ${projectInfo.name}`);

    try {
        childProcess.execFileSync("node_modules/.bin/eslint", projectInfo.args.concat("--format=codeframe"));
        console.log(`Successfully linted ${projectInfo.name} with no errors`);
    } catch (result) {
        console.error(`Linting ${projectInfo.name} resulted in an error:`);
        console.error(result.output[1].toString());
        process.exitCode = 1;
    }
    console.log("\n");
});

if (process.exitCode) {
    console.error("There were some linting errors.");
} else {
    console.log(`Successfully linted ${projects.length} projects.`);
}
