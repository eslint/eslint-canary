#!/usr/bin/env node

"use strict";

if (process.argv.length < 3) {
    console.log("Usage: node eslint-canary.js <eslint-folder-path>");
    process.exitCode = 1;
    return;
}

const fs = require("fs");
const path = require("path");
const spawnSync = require("cross-spawn").sync;

const assert = require("chai").assert;
const eslintPath = path.resolve(process.cwd(), process.argv[2]);
const eslintBinPath = "node_modules/.bin/eslint";
const yaml = require("js-yaml");
const projects = yaml.safeLoad(fs.readFileSync(path.join(__dirname, "projects.yml"), "utf8"));
const PROJECT_DIRECTORY = path.join(__dirname, ".downloaded-projects");

/**
 * Set up a temp folder where projects should be cloned.
 * @returns {void}
 */
function createTempFolder() {
    const PROJECT_DIRECTORY_ESLINTRC_PATH = path.join(PROJECT_DIRECTORY, ".eslintrc.yml");

    if (!fs.existsSync(PROJECT_DIRECTORY)) {
        fs.mkdirSync(PROJECT_DIRECTORY);
    }

    if (!fs.existsSync(PROJECT_DIRECTORY_ESLINTRC_PATH)) {

        /*
         * Add a config file with root: true to the downloaded projects directory.
         * This prevents the .eslintrc file from the eslint-canary module from interfering due to config cascading.
         */
        fs.writeFileSync(PROJECT_DIRECTORY_ESLINTRC_PATH, "root: true");
    }
}

/**
 * Synchronously spawn a child process, and throw if it exits with an error
 * @param {string} command The command to spawn
 * @param {string[]} args Arguments for the command
 * @returns {void}
 */
function spawn(command, args) {
    const result = spawnSync(command, args);

    assert.strictEqual(result.status, 0, `The command '${command} ${args.join(" ")}' exited with an exit code of ${result.status}:\n\n${result.output[2].toString()}`);
}

/**
 * Determines whether a particular dependency of a project should be installed
 * @param {Object} projectInfo The project information in the yml file
 * @param {string} dependency The name of the dependency
 * @returns {boolean} `true` if the dependency should be installed
 */
function shouldInstall(projectInfo, dependency) {
    return dependency.includes("eslint") && dependency !== "eslint" ||
        projectInfo.dependencies && projectInfo.dependencies.indexOf(dependency) !== -1;
}

require("./validate-projects");

createTempFolder();

projects.forEach(projectInfo => {
    process.chdir(PROJECT_DIRECTORY);

    if (fs.existsSync(projectInfo.name)) {
        console.log(`${projectInfo.name} already downloaded, fetching latest refs`);

        process.chdir(projectInfo.name);
        spawn("git", ["fetch", "origin"]);
    } else {
        console.log(`Cloning ${projectInfo.repo}`);

        spawn("git", ["clone", projectInfo.repo, "--single-branch", projectInfo.name]);
        process.chdir(projectInfo.name);
    }

    spawn("git", ["checkout", projectInfo.commit]);

    let npmInstallArgs = [];

    if (fs.existsSync("package.json")) {
        const packageFile = JSON.parse(fs.readFileSync("package.json", "utf8"));
        const dependencyVersions = Object.assign({}, packageFile.dependencies, packageFile.devDependencies);

        npmInstallArgs = Array.from(new Set(Object.keys(dependencyVersions).concat(projectInfo.dependencies || [])))
            .filter(dependency => shouldInstall(projectInfo, dependency))
            .map(dependency => (dependencyVersions[dependency] ? `${dependency}@${dependencyVersions[dependency]}` : dependency));
    }

    console.log(`Installing dependencies for ${projectInfo.name}`);

    /*
     * Create an empty node_modules folder to ensure that npm installs dependencies into the project, rather than into
     * eslint-canary/node_modules. (This is only necessary for projects that don't have a package.json file, such as Node.)
     */
    if (!fs.existsSync("node_modules")) {
        fs.mkdirSync("node_modules");
    }

    spawn("npm", ["install", "--ignore-scripts", eslintPath].concat(npmInstallArgs));

    console.log(`Linting ${projectInfo.name}`);

    const result = spawnSync(eslintBinPath, projectInfo.args.concat("--format=codeframe"));

    if (result.status === 0) {
        console.log(`Successfully linted ${projectInfo.name} with no errors`);
    } else {
        console.error(`Linting ${projectInfo.name} resulted in an error:`);
        console.error(result.output && result.output[1].toString());
        console.error(result.output && result.output[2].toString());
        process.exitCode = 1;
    }
    console.log("\n");
});

if (process.exitCode) {
    console.error("There were some linting errors.");
} else {
    console.log(`Successfully linted ${projects.length} projects.`);
}
