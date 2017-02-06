"use strict";

const fs = require("fs");
const assert = require("chai").assert;
const yaml = require("js-yaml");
const projects = yaml.safeLoad(fs.readFileSync("projects.yml", "utf8"));

assert.isArray(projects, "projects.yml must parse as an array");

projects.forEach(projectInfo => {
    assert.typeOf(projectInfo.name, "string", "Project names must be strings");
    assert.match(projectInfo.name, /^[\w-]+$/, `Project name must only contain alphanumeric characters and dashes. ('${projectInfo.name}' contains special characters.)`);
    assert.typeOf(projectInfo.repo, "string");
    assert.isArray(projectInfo.args, `Expected the arguments for ${projectInfo.name} to be an array`);

    projectInfo.args.forEach(arg => {
        assert.typeOf(arg, "string", `All project arguments must be strings (the project ${projectInfo.name} contains the argument ${arg})`);
    });
    if (projectInfo.dependencies) {
        assert.isArray(projectInfo.dependencies, "Project dependencies must be in an array");
    }

    assert.match(projectInfo.commit, /^[0-9a-f]{40}$/, "Project commit must be a full commit hash");
});

assert.deepEqual(projects.map(project => project.name), projects.map(project => project.name).sort(), "Project names should be sorted");
